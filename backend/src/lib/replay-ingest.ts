import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { consumeDatabaseRateLimit } from "./rate-limit-store";

export const REPLAY_MAX_CHUNKS = 400;
export const REPLAY_MAX_BYTES = 20 * 1024 * 1024;
export const REPLAY_DAILY_STARTS = 200;
type Store = Pick<PrismaClient, "$transaction">;
type Result = { status: number; error?: string; retryAfterSeconds?: number; duplicate?: boolean };
const registered = (metadata: unknown) =>
  !!metadata && typeof metadata === "object" && (metadata as { ingestRegistered?: unknown }).ingestRegistered === true;

/** Only /start can register ingestion; analytics-only metadata rows cannot bypass the start quota. */
export async function startReplaySession(
  store: Store,
  ip: string,
  create: Prisma.SessionReplayUncheckedCreateInput,
  update: Prisma.SessionReplayUpdateInput,
): Promise<Result> {
  return store.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${create.id}))`;
      const existing = await tx.sessionReplay.findUnique({ where: { id: create.id }, select: { metadata: true } });
      if (!registered(existing?.metadata)) {
        const limit = await consumeDatabaseRateLimit(tx, `replay-start-day:${ip}`, REPLAY_DAILY_STARTS, 86400000);
        if (!limit.allowed)
          return { status: 429, error: "REPLAY_DAILY_START_LIMIT", retryAfterSeconds: limit.retryAfterSeconds };
      }
      const earlyEvents = !registered(existing?.metadata)
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

/** The lock covers admission, R2 PUT and metadata commit, including duplicate requests on other instances. */
export async function ingestReplayChunk(
  store: Store,
  input: ReplayChunkInput,
  upload: (
    sessionId: string,
    sequence: number,
    body: Buffer,
  ) => Promise<{ storageKey: string; byteSize: number } | null>,
  now = new Date(),
): Promise<Result> {
  return store.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${input.sessionId}))`;
      const session = await tx.sessionReplay.findUnique({
        where: { id: input.sessionId },
        select: { metadata: true, startedAt: true, durationMs: true },
      });
      if (!session || !registered(session.metadata)) return { status: 409, error: "REPLAY_SESSION_NOT_STARTED" };
      const old = await tx.sessionReplayChunk.findUnique({
        where: { sessionId_sequence: { sessionId: input.sessionId, sequence: input.sequence } },
        select: { id: true },
      });
      // A sequence is immutable. A retry cannot overwrite a previously admitted R2 key or grow its bytes.
      if (old) return { status: 200, duplicate: true };
      const totals = await tx.sessionReplayChunk.aggregate({
        where: { sessionId: input.sessionId },
        _count: { _all: true },
        _sum: { byteSize: true },
      });
      if (totals._count._all >= REPLAY_MAX_CHUNKS || (totals._sum.byteSize || 0) + input.body.length > REPLAY_MAX_BYTES)
        return { status: 429, error: "REPLAY_SESSION_LIMIT" };

      const stored = await upload(input.sessionId, input.sequence, input.body);
      if (!stored) return { status: 503, error: "REPLAY_STORAGE_NOT_CONFIGURED" };
      await tx.sessionReplayChunk.create({
        data: {
          sessionId: input.sessionId,
          sequence: input.sequence,
          eventCount: input.eventCount,
          hasSnapshot: input.hasSnapshot,
          firstTimestamp: input.firstTimestamp,
          lastTimestamp: input.lastTimestamp,
          storageKey: stored.storageKey,
          byteSize: input.body.length,
        },
      });
      await tx.sessionReplay.update({
        where: { id: input.sessionId },
        data: {
          lastSeenAt: now,
          lastUrl: input.currentUrl,
          eventCount: { increment: input.eventCount },
          chunkCount: { increment: 1 },
          ...(input.hasSnapshot ? { hasSnapshot: true } : {}),
          durationMs: Math.max(
            session.durationMs,
            Math.min(2147483647, input.lastTimestamp - session.startedAt.getTime()),
          ),
        },
      });
      return { status: 200 };
    },
    { maxWait: 15000, timeout: 30000 },
  );
}
