import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { Prisma } from "../generated/prisma/client";
import { consumeDatabaseRateLimit, createMemoryRateLimiter } from "./rate-limit-store";
import {
  ingestReplayChunk,
  reconcileReplayTotals,
  startReplaySession,
  REPLAY_MAX_BYTES,
  REPLAY_MAX_CHUNKS,
} from "./replay-ingest";

// An isolated PostgreSQL copy with a small Prisma-shaped adapter. The production
// atomic statement and transaction boundaries run as written; no network DB opens.
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "RateLimitBucket" (id text PRIMARY KEY, "bucketKey" text UNIQUE NOT NULL,
      count integer NOT NULL, "windowStart" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL);
    CREATE TABLE "SessionReplay" (id text PRIMARY KEY, metadata jsonb, "startedAt" timestamptz NOT NULL,
      "lastSeenAt" timestamptz NOT NULL DEFAULT now(), "lastUrl" text NOT NULL DEFAULT '/',
      "updatedAt" timestamptz NOT NULL DEFAULT now(), "hasSnapshot" boolean NOT NULL DEFAULT false,
      "durationMs" integer NOT NULL DEFAULT 0, "eventCount" integer NOT NULL DEFAULT 0,
      "chunkCount" integer NOT NULL DEFAULT 0);
    CREATE TABLE "SessionReplayChunk" (id text PRIMARY KEY, "sessionId" text REFERENCES "SessionReplay"(id),
      sequence integer, "storageKey" text, "byteSize" integer, "firstTimestamp" double precision,
      "lastTimestamp" double precision, "eventCount" integer, "hasSnapshot" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("sessionId",sequence));
  `);
  const statements: string[] = [];
  const adapter = (connection: Pick<PGlite, "query">) => ({
    $queryRaw: async (query: Prisma.Sql | TemplateStringsArray, ...values: unknown[]) => {
      const sql = Array.isArray(query)
        ? Prisma.sql(query as unknown as TemplateStringsArray, ...values)
        : (query as Prisma.Sql);
      statements.push(sql.text);
      return (await connection.query(sql.text, sql.values)).rows;
    },
    sessionReplay: {
      findUnique: async ({ where }: any) =>
        (await connection.query('SELECT * FROM "SessionReplay" WHERE id=$1', [where.id])).rows[0] || null,
      upsert: async ({ create, update }: any) =>
        connection.query(
          'INSERT INTO "SessionReplay" (id,metadata,"startedAt","lastSeenAt") VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET metadata=COALESCE($5,"SessionReplay".metadata)',
          [create.id, create.metadata ?? null, create.startedAt, create.lastSeenAt, update.metadata ?? null],
        ),
    },
    sessionReplayChunk: {
      findUnique: async ({ where }: any) =>
        (
          await connection.query('SELECT id FROM "SessionReplayChunk" WHERE "sessionId"=$1 AND sequence=$2', [
            where.sessionId_sequence.sessionId,
            where.sessionId_sequence.sequence,
          ])
        ).rows[0] || null,
      aggregate: async ({ where }: any) => {
        const result = await connection.query<{ count: number; bytes: number }>(
          'SELECT count(*)::int AS count,coalesce(sum("byteSize"),0)::int AS bytes FROM "SessionReplayChunk" WHERE "sessionId"=$1',
          [where.sessionId],
        );
        return { _count: { _all: result.rows[0].count }, _sum: { byteSize: result.rows[0].bytes } };
      },
    },
    eventLog: { findMany: async () => [] },
  });
  const store = {
    $transaction: (callback: (tx: any) => Promise<unknown>) => db.transaction((tx) => callback(adapter(tx))),
  } as unknown as Parameters<typeof startReplaySession>[0];
  const create = (id: string): Prisma.SessionReplayUncheckedCreateInput => ({
    id,
    visitorId: randomUUID(),
    startedAt: new Date(),
    lastSeenAt: new Date(),
    landingUrl: "/",
    lastUrl: "/",
  });
  const register = (id: string, ip = "192.0.2.1", record = true) =>
    startReplaySession(store, ip, create(id), {}, record);
  const chunk = (sessionId: string, sequence: number, body = Buffer.from("test events"), at = Date.now()) => ({
    sessionId,
    sequence,
    body,
    eventCount: 100,
    hasSnapshot: sequence === 0,
    firstTimestamp: at,
    lastTimestamp: at,
    currentUrl: "/product/test",
  });
  // Chunk ingestion runs straight on the connection: no transaction, no lock.
  const chunks = adapter(db) as unknown as Parameters<typeof ingestReplayChunk>[0];
  let uploads = 0;
  const upload = async (id: string, sequence: number, body: Buffer) => {
    uploads++;
    return { storageKey: `replays/${id}/${sequence}.json.gz`, byteSize: body.length };
  };
  return {
    db,
    raw: adapter(db),
    store,
    chunks,
    statements,
    register,
    chunk,
    upload,
    get uploads() {
      return uploads;
    },
  };
}

test("atomic SQL admits exactly the limit during floods and concurrent window resets", async () => {
  const f = await fixture();
  try {
    const consume = () => consumeDatabaseRateLimit(f.raw as any, "flood", 20, 60000);
    const results = await Promise.all(Array.from({ length: 100 }, consume));
    assert.equal(results.filter((result) => result.allowed).length, 20);
    assert.equal(results.filter((result) => !result.allowed).length, 80);
    assert.ok(results.every((result) => result.remaining >= 0 && result.retryAfterSeconds > 0));
    const saturated = await f.db.query<{ count: number }>('SELECT count FROM "RateLimitBucket" WHERE "bucketKey"=$1', [
      "flood",
    ]);
    assert.equal(saturated.rows[0].count, 21);
    await f.db.query(
      'UPDATE "RateLimitBucket" SET "windowStart"=statement_timestamp()-interval \'2 minutes\' WHERE "bucketKey"=$1',
      ["flood"],
    );
    assert.equal(
      (await Promise.all(Array.from({ length: 40 }, consume))).filter((result) => result.allowed).length,
      20,
    );
  } finally {
    await f.db.close();
  }
});

test("daily starts stop at 200 across sessions; retries do not spend a second allowance", async () => {
  const f = await fixture();
  try {
    const ids = Array.from({ length: 210 }, () => randomUUID());
    const results = await Promise.all(ids.map((id) => f.register(id)));
    assert.equal(results.filter((result) => result.status === 200).length, 200);
    assert.equal(results.filter((result) => result.error === "REPLAY_DAILY_START_LIMIT").length, 10);
    assert.equal((await f.register(ids[0])).status, 200);
    assert.equal((await f.register(ids[200])).status, 429);
    assert.equal((await f.register(ids[200], "192.0.2.2")).status, 200);
    const same = randomUUID();
    await Promise.all(Array.from({ length: 8 }, () => f.register(same, "192.0.2.3")));
    const quota = await f.db.query<{ count: number }>('SELECT count FROM "RateLimitBucket" WHERE "bucketKey"=$1', [
      "replay-start-day:192.0.2.3",
    ]);
    assert.equal(quota.rows[0].count, 1);
  } finally {
    await f.db.close();
  }
});

test("chunks stop at the hard limit, duplicate sequences never overwrite, and no lock is taken", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    await f.register(id);
    f.statements.length = 0;
    for (let sequence = 0; sequence < REPLAY_MAX_CHUNKS; sequence++)
      assert.equal((await ingestReplayChunk(f.chunks, f.chunk(id, sequence), f.upload)).status, 200);
    assert.equal(
      (await ingestReplayChunk(f.chunks, f.chunk(id, REPLAY_MAX_CHUNKS), f.upload)).error,
      "REPLAY_SESSION_LIMIT",
    );
    assert.equal(f.uploads, REPLAY_MAX_CHUNKS);
    const duplicate = await ingestReplayChunk(f.chunks, f.chunk(id, 0, Buffer.alloc(500)), f.upload);
    assert.equal(duplicate.duplicate, true);
    assert.equal(f.uploads, REPLAY_MAX_CHUNKS, "a retry never uploads again");
    assert.ok(!f.statements.some((sql) => /advisory/i.test(sql)), "no pg_advisory_xact_lock per chunk");
    const stored = await f.db.query<{ byteSize: number }>(
      'SELECT "byteSize" FROM "SessionReplayChunk" WHERE "sessionId"=$1 AND sequence=0',
      [id],
    );
    assert.equal(stored.rows[0].byteSize, Buffer.from("test events").length, "the first copy stays");
    assert.equal(
      (await f.db.query('SELECT * FROM "RateLimitBucket"')).rows.length,
      1,
      "chunks have no DB rate-limit counter",
    );
  } finally {
    await f.db.close();
  }
});

test("the same chunk sent many times at once is stored once (ON CONFLICT DO NOTHING)", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    await f.register(id);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => ingestReplayChunk(f.chunks, f.chunk(id, 0), f.upload)),
    );
    assert.ok(results.every((result) => result.status === 200));
    assert.equal(results.filter((result) => !result.duplicate).length, 1);
    const rows = await f.db.query('SELECT id FROM "SessionReplayChunk" WHERE "sessionId"=$1', [id]);
    assert.equal(rows.rows.length, 1);
  } finally {
    await f.db.close();
  }
});

test("the session row is rewritten at most about once a minute; totals stay exact", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    await f.register(id);
    const t0 = Date.now();
    const at = (seconds: number) => new Date(t0 + seconds * 1000);
    const session = async () =>
      (
        await f.db.query<{ chunkCount: number; eventCount: number; durationMs: number; lastSeenAt: Date }>(
          'SELECT "chunkCount","eventCount","durationMs","lastSeenAt" FROM "SessionReplay" WHERE id=$1',
          [id],
        )
      ).rows[0];
    const send = (sequence: number, seconds: number) =>
      ingestReplayChunk(f.chunks, f.chunk(id, sequence, undefined, at(seconds).getTime()), f.upload, at(seconds));
    const writes = () => f.statements.filter((sql) => sql.startsWith('UPDATE "SessionReplay"')).length;
    f.statements.length = 0;
    await send(0, 0);
    assert.equal((await session()).chunkCount, 1, "the first chunk (with the snapshot) is written at once");
    await send(1, 15);
    await send(2, 30);
    assert.equal(writes(), 1, "chunks inside the minute do not touch the session row");
    assert.equal((await session()).chunkCount, 1);
    await send(3, 61);
    assert.equal(writes(), 2);
    const written = await session();
    assert.equal(written.chunkCount, 4);
    assert.equal(written.eventCount, 400);
    assert.equal(new Date(written.lastSeenAt).getTime(), at(61).getTime());
    await send(4, 70);
    assert.equal((await session()).chunkCount, 4, "still inside the next minute");
    await reconcileReplayTotals(f.raw as any, new Date(t0 - 3600_000));
    const reconciled = await session();
    assert.equal(reconciled.chunkCount, 5, "the admin list brings the last minute in");
    assert.equal(reconciled.eventCount, 500);
    assert.ok(reconciled.durationMs >= 69_000);
  } finally {
    await f.db.close();
  }
});

test("a visitor outside the sample keeps the analytics row but cannot record", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    assert.equal((await f.register(id, "192.0.2.9", false)).status, 200);
    assert.equal((await f.db.query('SELECT id FROM "SessionReplay" WHERE id=$1', [id])).rows.length, 1);
    assert.equal(
      (await f.db.query('SELECT * FROM "RateLimitBucket" WHERE "bucketKey"=$1', ["replay-start-day:192.0.2.9"])).rows
        .length,
      0,
      "no daily start quota spent",
    );
    assert.ok(!f.statements.some((sql) => /advisory/i.test(sql)), "no lock");
    assert.equal((await ingestReplayChunk(f.chunks, f.chunk(id, 0), f.upload)).error, "REPLAY_SESSION_NOT_STARTED");
    assert.equal(f.uploads, 0);
    // A later record:false call never removes a real registration.
    const recorded = randomUUID();
    await f.register(recorded);
    await f.register(recorded, "192.0.2.1", false);
    assert.equal((await ingestReplayChunk(f.chunks, f.chunk(recorded, 0), f.upload)).status, 200);
  } finally {
    await f.db.close();
  }
});

test("byte cap and registration checks reject before R2; failed uploads leave capacity available", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    assert.equal((await ingestReplayChunk(f.chunks, f.chunk(id, 0), f.upload)).error, "REPLAY_SESSION_NOT_STARTED");
    await f.db.query('INSERT INTO "SessionReplay" (id,metadata,"startedAt") VALUES ($1,$2,$3)', [id, {}, new Date()]);
    assert.equal((await ingestReplayChunk(f.chunks, f.chunk(id, 0), f.upload)).error, "REPLAY_SESSION_NOT_STARTED");
    assert.equal(f.uploads, 0);
    await f.register(id);
    assert.equal((await ingestReplayChunk(f.chunks, f.chunk(id, 0), async () => null)).status, 503);
    await assert.rejects(
      ingestReplayChunk(f.chunks, f.chunk(id, 0), async () => {
        throw new Error("storage failed");
      }),
      /storage failed/,
    );
    await f.db.query(
      'INSERT INTO "SessionReplayChunk" (id,"sessionId",sequence,"byteSize","eventCount") VALUES ($1,$2,0,$3,100)',
      [randomUUID(), id, REPLAY_MAX_BYTES - 10],
    );
    assert.equal((await ingestReplayChunk(f.chunks, f.chunk(id, 1, Buffer.alloc(10)), f.upload)).status, 200);
    assert.equal((await ingestReplayChunk(f.chunks, f.chunk(id, 2, Buffer.alloc(1)), f.upload)).status, 429);
    assert.equal(f.uploads, 1);
  } finally {
    await f.db.close();
  }
});

test("memory counters are bounded, do not evict live limits, and expire without a database", () => {
  let now = 0;
  const consume = createMemoryRateLimiter(() => now, 2);
  assert.equal(consume("a", 2, 1000).allowed, true);
  assert.equal(consume("a", 2, 1000).allowed, true);
  assert.equal(consume("a", 2, 1000).allowed, false);
  assert.equal(consume("b", 2, 1000).allowed, true);
  assert.equal(consume("c", 2, 1000).allowed, false);
  assert.equal(consume("a", 2, 1000).allowed, false);
  now = 1000;
  assert.equal(consume("c", 2, 1000).allowed, true);
  assert.equal(consume("a", 2, 1000).allowed, true);
});
