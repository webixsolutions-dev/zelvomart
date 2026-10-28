import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };
export type RateLimitStore = Pick<Prisma.TransactionClient, "$queryRaw">;
export type RateLimitRule = { key: string; limit: number; windowMs: number };

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

/** Atomically increments two independent buckets in one database round trip. */
export async function consumeDatabaseRateLimits(
  store: RateLimitStore,
  rules: [RateLimitRule, RateLimitRule],
): Promise<RateLimitResult[]> {
  const [first, second] = rules;
  const rows = await store.$queryRaw<{ bucketKey: string; count: number; retryAfterSeconds: number }[]>(Prisma.sql`
    WITH limits("bucketKey", "limitCount", "windowMs") AS (
      VALUES (${first.key}, ${first.limit}, ${first.windowMs}), (${second.key}, ${second.limit}, ${second.windowMs})
    ), upserted AS (
      INSERT INTO "RateLimitBucket" ("id", "bucketKey", "count", "windowStart", "updatedAt")
      SELECT gen_random_uuid()::text, "bucketKey", 1, statement_timestamp(), statement_timestamp() FROM limits
      ON CONFLICT ("bucketKey") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."windowStart" <= statement_timestamp() -
          (SELECT "windowMs" FROM limits WHERE limits."bucketKey" = EXCLUDED."bucketKey") * interval '1 millisecond'
          THEN 1 ELSE LEAST("RateLimitBucket"."count",
            (SELECT "limitCount" FROM limits WHERE limits."bucketKey" = EXCLUDED."bucketKey")) + 1 END,
        "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" <= statement_timestamp() -
          (SELECT "windowMs" FROM limits WHERE limits."bucketKey" = EXCLUDED."bucketKey") * interval '1 millisecond'
          THEN statement_timestamp() ELSE "RateLimitBucket"."windowStart" END,
        "updatedAt" = statement_timestamp()
      RETURNING "bucketKey", "count", "windowStart"
    )
    SELECT upserted."bucketKey", upserted."count", GREATEST(1, CEIL(EXTRACT(EPOCH FROM
      (upserted."windowStart" + limits."windowMs" * interval '1 millisecond' - statement_timestamp()))))::int AS "retryAfterSeconds"
    FROM upserted JOIN limits USING ("bucketKey")
  `);
  const byKey = new Map(rows.map((row) => [row.bucketKey, row]));
  return rules.map(({ key, limit }) => {
    const row = byKey.get(key);
    if (!row) throw new Error("RATE_LIMIT_RESULT_MISSING");
    return {
      allowed: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      retryAfterSeconds: row.retryAfterSeconds,
    };
  });
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
