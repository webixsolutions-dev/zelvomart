import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { randomUUID } from "node:crypto";
import { consumeDatabaseRateLimit } from "./rate-limit-store";

/** Hard limits per recording. A 10-minute recording at one chunk every 15 s plus page snapshots stays far below. */
export const REPLAY_MAX_CHUNKS = 120;
/** Events in one chunk (the browser sends up to 500). */
export const REPLAY_CHUNK_MAX_EVENTS = 1000;
export const REPLAY_MAX_BYTES = 20 * 1024 * 1024;
export const REPLAY_DAILY_STARTS = 200;
type Store = Pick<PrismaClient, "$transaction">;
type Result = { status: number; error?: string; retryAfterSeconds?: number; duplicate?: boolean };
const registered = (metadata: unknown) =>
  !!metadata && typeof metadata === "object" && (metadata as { ingestRegistered?: unknown }).ingestRegistered === true;

/**
 * Only /start can register ingestion; analytics-only metadata rows cannot bypass the start quota.
 * `record: false` (a visitor outside the replay sample) keeps the analytics row (source, device, landing page,
 * page views) without the lock, the daily quota or registration: its chunks are refused.
 */
export async function startReplaySession(
  store: Store,
  ip: string,
  create: Prisma.SessionReplayUncheckedCreateInput,
  update: Prisma.SessionReplayUpdateInput,
  record = true,
): Promise<Result> {
  return store.$transaction(
    async (tx) => {
      if (record) await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${create.id}))`;
      const existing = await tx.sessionReplay.findUnique({ where: { id: create.id }, select: { metadata: true } });
      if (record && !registered(existing?.metadata)) {
        const limit = await consumeDatabaseRateLimit(tx, `replay-start-day:${ip}`, REPLAY_DAILY_STARTS, 86400000);
        if (!limit.allowed)
          return { status: 429, error: "REPLAY_DAILY_START_LIMIT", retryAfterSeconds: limit.retryAfterSeconds };
      }
      const earlyEvents =
        !existing || (record && !registered(existing.metadata))
          ? await tx.eventLog.findMany({
              where: {
                sessionReplayId: create.id,
                channel: "browser",
                eventName: { in: ["AddToCart", "InitiateCheckout"] },
              },
              select: { eventName: true },
              distinct: ["eventName"],
            })
          : [];
      const flags = {
        ...(earlyEvents.some((event) => event.eventName === "AddToCart") ? { reachedCart: true } : {}),
        ...(earlyEvents.some((event) => event.eventName === "InitiateCheckout") ? { reachedCheckout: true } : {}),
      };
      if (!record) {
        // Never adds (or removes) the registration mark.
        const { metadata: _metadata, ...rest } = update;
        await tx.sessionReplay.upsert({
          where: { id: create.id },
          create: { ...create, ...flags },
          update: { ...rest, ...flags },
        });
        return { status: 200 };
      }
      const metadata = {
        ...(create.metadata as Record<string, unknown>),
        ingestRegistered: true,
      } as Prisma.InputJsonValue;
      await tx.sessionReplay.upsert({
        where: { id: create.id },
        create: { ...create, ...flags, metadata },
        update: { ...update, ...flags, metadata },
      });
      return { status: 200 };
    },
    { maxWait: 15000, timeout: 30000 },
  );
}

export type ReplayChunkInput = {
  sessionId: string;
  sequence: number;
  eventCount: number;
  hasSnapshot: boolean;
  firstTimestamp: number;
  lastTimestamp: number;
  currentUrl: string;
  body: Buffer;
};

/** How often a session row is rewritten while chunks arrive (lastSeenAt, lastUrl and the totals). */
export const REPLAY_SESSION_WRITE_MS = 60_000;
export const REPLAY_SESSION_WRITE_CHUNKS = 4;
type ChunkStore = Pick<PrismaClient, "sessionReplay" | "sessionReplayChunk" | "$queryRaw">;

/**
 * Exact totals from the chunk rows (count, events, snapshot, duration), with lastSeenAt and lastUrl.
 * One statement, so it is safe while other chunks of the same session arrive.
 */
export async function refreshReplayTotals(
  store: Pick<PrismaClient, "$queryRaw">,
  sessionId: string,
  now: Date,
  lastUrl?: string,
) {
  await store.$queryRaw`UPDATE "SessionReplay" s SET
      "lastSeenAt" = ${now}, "updatedAt" = ${now},
      "lastUrl" = COALESCE(${lastUrl ?? null}::text, s."lastUrl"),
      "chunkCount" = t.n, "eventCount" = t.events, "hasSnapshot" = s."hasSnapshot" OR t.snap,
      "durationMs" = GREATEST(s."durationMs", LEAST(2147483647, COALESCE(t.last - EXTRACT(EPOCH FROM s."startedAt") * 1000, 0)))::int
    FROM (SELECT count(*)::int AS n, COALESCE(sum("eventCount"), 0)::int AS events,
            COALESCE(bool_or("hasSnapshot"), false) AS snap, max("lastTimestamp") AS last
          FROM "SessionReplayChunk" WHERE "sessionId" = ${sessionId}) t
    WHERE s.id = ${sessionId}
    RETURNING s.id`;
}

/**
 * Sessions whose stored chunk count is behind their chunk rows (the 60 s write window above) get their
 * totals recomputed. Run when an admin opens the replay list, so short visits never hide behind stale totals.
 */
export async function reconcileReplayTotals(store: Pick<PrismaClient, "$queryRaw">, since: Date) {
  await store.$queryRaw`WITH t AS (
      SELECT c."sessionId", count(*)::int AS n, COALESCE(sum(c."eventCount"), 0)::int AS events,
        COALESCE(bool_or(c."hasSnapshot"), false) AS snap, max(c."lastTimestamp") AS last
      FROM "SessionReplayChunk" c JOIN "SessionReplay" r ON r.id = c."sessionId"
      WHERE r."startedAt" >= ${since} GROUP BY c."sessionId")
    UPDATE "SessionReplay" s SET "chunkCount" = t.n, "eventCount" = t.events, "hasSnapshot" = s."hasSnapshot" OR t.snap,
      "durationMs" = GREATEST(s."durationMs", LEAST(2147483647, COALESCE(t.last - EXTRACT(EPOCH FROM s."startedAt") * 1000, 0)))::int
    FROM t WHERE s.id = t."sessionId" AND s."chunkCount" <> t.n
    RETURNING s.id`;
}

/**
 * No lock and no transaction: a sequence is admitted once by the unique (sessionId, sequence) key
 * (ON CONFLICT DO NOTHING), and the object store refuses to overwrite an existing chunk file (If-None-Match).
 * The chunk and byte limits are checked before the upload; uploads that run at the same moment for one session
 * can pass the chunk limit by at most their number (a browser sends one chunk at a time).
 */
export async function ingestReplayChunk(
  store: ChunkStore,
  input: ReplayChunkInput,
  upload: (
    sessionId: string,
    sequence: number,
    body: Buffer,
  ) => Promise<{ storageKey: string; byteSize: number } | null>,
  now = new Date(),
): Promise<Result> {
  const session = await store.sessionReplay.findUnique({
    where: { id: input.sessionId },
    select: { metadata: true, lastSeenAt: true, chunkCount: true, hasSnapshot: true },
  });
  if (!session || !registered(session.metadata)) return { status: 409, error: "REPLAY_SESSION_NOT_STARTED" };
  const old = await store.sessionReplayChunk.findUnique({
    where: { sessionId_sequence: { sessionId: input.sessionId, sequence: input.sequence } },
    select: { id: true },
  });
  // A sequence is immutable. A retry cannot overwrite a previously admitted chunk or grow its bytes.
  if (old) return { status: 200, duplicate: true };
  const totals = await store.sessionReplayChunk.aggregate({
    where: { sessionId: input.sessionId },
    _count: { _all: true },
    _sum: { byteSize: true },
  });
  if (totals._count._all >= REPLAY_MAX_CHUNKS || (totals._sum.byteSize || 0) + input.body.length > REPLAY_MAX_BYTES)
    return { status: 429, error: "REPLAY_SESSION_LIMIT" };

  const stored = await upload(input.sessionId, input.sequence, input.body);
  if (!stored) return { status: 503, error: "REPLAY_STORAGE_NOT_CONFIGURED" };
  const inserted = await store.$queryRaw<{ id: string }[]>`INSERT INTO "SessionReplayChunk"
      (id, "sessionId", sequence, "storageKey", "byteSize", "firstTimestamp", "lastTimestamp", "eventCount", "hasSnapshot", "createdAt")
    VALUES (${randomUUID()}, ${input.sessionId}, ${input.sequence}, ${stored.storageKey}, ${input.body.length},
      ${input.firstTimestamp}, ${input.lastTimestamp}, ${input.eventCount}, ${input.hasSnapshot}, ${now})
    ON CONFLICT ("sessionId", sequence) DO NOTHING
    RETURNING id`;
  if (!inserted.length) return { status: 200, duplicate: true };
  // The session row is written for the first chunk, the first snapshot, and then at most about once a minute:
  // when a minute has passed, or when the stored totals are 4 chunks (about a minute of flushes) behind.
  if (
    session.chunkCount === 0 ||
    (input.hasSnapshot && !session.hasSnapshot) ||
    now.getTime() - session.lastSeenAt.getTime() >= REPLAY_SESSION_WRITE_MS ||
    totals._count._all + 1 - session.chunkCount >= REPLAY_SESSION_WRITE_CHUNKS
  )
    await refreshReplayTotals(store, input.sessionId, now, input.currentUrl);
  return { status: 200 };
}
