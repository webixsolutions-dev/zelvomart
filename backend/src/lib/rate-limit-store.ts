import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };
export type RateLimitStore = Pick<Prisma.TransactionClient, "$queryRaw">;

/** One PostgreSQL statement serializes both window resets and increments across instances. */
export async function consumeDatabaseRateLimit(
  store: RateLimitStore,
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const [row] = await store.$queryRaw<{ count: number; retryAfterSeconds: number }[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("id", "bucketKey", "count", "windowStart", "updatedAt")
    VALUES (${randomUUID()}, ${bucketKey}, 1, statement_timestamp(), statement_timestamp())
    ON CONFLICT ("bucketKey") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" <= statement_timestamp() - ${windowMs} * interval '1 millisecond'
        THEN 1 ELSE LEAST("RateLimitBucket"."count", ${limit}) + 1 END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."windowStart" <= statement_timestamp() - ${windowMs} * interval '1 millisecond'
        THEN statement_timestamp() ELSE "RateLimitBucket"."windowStart" END,
      "updatedAt" = statement_timestamp()
    RETURNING "count", GREATEST(1, CEIL(EXTRACT(EPOCH FROM
      ("windowStart" + ${windowMs} * interval '1 millisecond' - statement_timestamp()))))::int AS "retryAfterSeconds"
  `);
  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    retryAfterSeconds: row.retryAfterSeconds,
  };
}

/** The high-volume chunk path needs no database-backed request counter. Hard session caps stay in PostgreSQL. */
export function createMemoryRateLimiter(now = Date.now, maxBuckets = 10_000) {
  const buckets = new Map<string, { count: number; expires: number }>();
  return (key: string, limit: number, windowMs: number): RateLimitResult => {
    const time = now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.expires <= time) {
      if (!bucket && buckets.size >= maxBuckets) {
        for (const [name, entry] of buckets) if (entry.expires <= time) buckets.delete(name);
        // Do not evict live counters: high-cardinality traffic cannot reset its limit.
        if (buckets.size >= maxBuckets) return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
      }
      bucket = { count: 0, expires: time + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count = Math.min(limit + 1, bucket.count + 1);
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.expires - time) / 1000)),
    };
  };
}
