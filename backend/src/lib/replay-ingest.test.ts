import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { Prisma } from "../generated/prisma/client";
import { consumeDatabaseRateLimit, createMemoryRateLimiter } from "./rate-limit-store";
import { ingestReplayChunk, startReplaySession, REPLAY_MAX_BYTES, REPLAY_MAX_CHUNKS } from "./replay-ingest";

// An isolated PostgreSQL copy with a small Prisma-shaped adapter. The production
// atomic statement and transaction boundaries run as written; no network DB opens.
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "RateLimitBucket" (id text PRIMARY KEY, "bucketKey" text UNIQUE NOT NULL,
      count integer NOT NULL, "windowStart" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL);
    CREATE TABLE "SessionReplay" (id text PRIMARY KEY, metadata jsonb, "startedAt" timestamptz NOT NULL,
      "durationMs" integer NOT NULL DEFAULT 0, "eventCount" integer NOT NULL DEFAULT 0,
      "chunkCount" integer NOT NULL DEFAULT 0);
    CREATE TABLE "SessionReplayChunk" (id text PRIMARY KEY, "sessionId" text REFERENCES "SessionReplay"(id),
      sequence integer, "byteSize" integer, "eventCount" integer, UNIQUE ("sessionId",sequence));
  `);
  const adapter = (connection: Pick<PGlite, "query">) => ({
    $queryRaw: async (query: Prisma.Sql | TemplateStringsArray, ...values: unknown[]) => {
      const sql = Array.isArray(query)
        ? Prisma.sql(query as unknown as TemplateStringsArray, ...values)
        : (query as Prisma.Sql);
      return (await connection.query(sql.text, sql.values)).rows;
    },
    sessionReplay: {
      findUnique: async ({ where }: any) =>
        (await connection.query('SELECT * FROM "SessionReplay" WHERE id=$1', [where.id])).rows[0] || null,
      upsert: async ({ create, update }: any) =>
        connection.query(
          'INSERT INTO "SessionReplay" (id,metadata,"startedAt") VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET metadata=$4',
          [create.id, create.metadata, create.startedAt, update.metadata],
        ),
      update: async ({ where, data }: any) =>
        connection.query(
          'UPDATE "SessionReplay" SET "chunkCount"="chunkCount"+$2,"eventCount"="eventCount"+$3,"durationMs"=$4 WHERE id=$1',
          [where.id, data.chunkCount.increment, data.eventCount.increment, data.durationMs],
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
      create: async ({ data }: any) =>
        connection.query(
          'INSERT INTO "SessionReplayChunk" (id,"sessionId",sequence,"byteSize","eventCount") VALUES ($1,$2,$3,$4,$5)',
          [randomUUID(), data.sessionId, data.sequence, data.byteSize, data.eventCount],
        ),
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
  const register = (id: string, ip = "192.0.2.1") => startReplaySession(store, ip, create(id), {});
  const chunk = (sessionId: string, sequence: number, body = Buffer.from("test events")) => ({
    sessionId,
    sequence,
    body,
    eventCount: 100,
    hasSnapshot: sequence === 0,
    firstTimestamp: Date.now(),
    lastTimestamp: Date.now(),
    currentUrl: "/product/test",
  });
  let uploads = 0;
  const upload = async (id: string, sequence: number, body: Buffer) => {
    uploads++;
    return { storageKey: `replays/${id}/${sequence}.json.gz`, byteSize: body.length };
  };
  return {
    db,
    raw: adapter(db),
    store,
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

test("long sessions pass, concurrent chunks stop at 400 and duplicate sequences never overwrite", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    await f.register(id);
    for (let sequence = 0; sequence < 398; sequence++)
      assert.equal((await ingestReplayChunk(f.store, f.chunk(id, sequence), f.upload)).status, 200);
    const results = await Promise.all(
      [398, 399, 400, 401].map((sequence) => ingestReplayChunk(f.store, f.chunk(id, sequence), f.upload)),
    );
    assert.equal(results.filter((result) => result.status === 200).length, 2);
    assert.equal(results.filter((result) => result.error === "REPLAY_SESSION_LIMIT").length, 2);
    assert.equal(f.uploads, REPLAY_MAX_CHUNKS);
    const duplicate = await ingestReplayChunk(f.store, f.chunk(id, 0, Buffer.alloc(500)), f.upload);
    assert.equal(duplicate.duplicate, true);
    assert.equal(f.uploads, REPLAY_MAX_CHUNKS);
    const session = await f.db.query<{ chunkCount: number; eventCount: number }>(
      'SELECT "chunkCount","eventCount" FROM "SessionReplay" WHERE id=$1',
      [id],
    );
    assert.deepEqual(session.rows[0], { chunkCount: 400, eventCount: 40000 });
    assert.equal(
      (await f.db.query('SELECT * FROM "RateLimitBucket"')).rows.length,
      1,
      "chunks have no DB rate-limit counter",
    );
  } finally {
    await f.db.close();
  }
});

test("byte cap and registration checks reject before R2; failed uploads leave capacity available", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    assert.equal((await ingestReplayChunk(f.store, f.chunk(id, 0), f.upload)).error, "REPLAY_SESSION_NOT_STARTED");
    await f.db.query('INSERT INTO "SessionReplay" (id,metadata,"startedAt") VALUES ($1,$2,$3)', [id, {}, new Date()]);
    assert.equal((await ingestReplayChunk(f.store, f.chunk(id, 0), f.upload)).error, "REPLAY_SESSION_NOT_STARTED");
    assert.equal(f.uploads, 0);
    await f.register(id);
    assert.equal((await ingestReplayChunk(f.store, f.chunk(id, 0), async () => null)).status, 503);
    await assert.rejects(
      ingestReplayChunk(f.store, f.chunk(id, 0), async () => {
        throw new Error("storage failed");
      }),
      /storage failed/,
    );
    await f.db.query(
      'INSERT INTO "SessionReplayChunk" (id,"sessionId",sequence,"byteSize","eventCount") VALUES ($1,$2,0,$3,100)',
      [randomUUID(), id, REPLAY_MAX_BYTES - 10],
    );
    assert.equal((await ingestReplayChunk(f.store, f.chunk(id, 1, Buffer.alloc(10)), f.upload)).status, 200);
    assert.equal((await ingestReplayChunk(f.store, f.chunk(id, 2, Buffer.alloc(1)), f.upload)).status, 429);
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
