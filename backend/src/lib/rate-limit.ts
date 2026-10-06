import { prisma } from "./db";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const fallbackBuckets = new Map<string, { count: number; windowStart: number }>();

function consumeMemoryRateLimit(bucketKey: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = fallbackBuckets.get(bucketKey);
  if (!existing || now - existing.windowStart >= windowMs) {
    fallbackBuckets.set(bucketKey, { count: 1, windowStart: now });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - existing.windowStart)) / 1000));
  if (existing.count >= limit) return { allowed: false, remaining: 0, retryAfterSeconds };
  existing.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - existing.count), retryAfterSeconds };
}

/**
 * Database-backed rate limiter so limits still work across serverless instances.
 * The bucket is intentionally simple and durable; expired buckets are reset on use.
 */
export async function consumeRateLimit(bucketKey: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const existing = await prisma.rateLimitBucket.findUnique({ where: { bucketKey } });

    if (!existing || now.getTime() - existing.windowStart.getTime() >= windowMs) {
      await prisma.rateLimitBucket.upsert({
        where: { bucketKey },
        update: { count: 1, windowStart: now },
        create: { bucketKey, count: 1, windowStart: now },
      });
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: Math.ceil(windowMs / 1000) };
    }

    const elapsed = now.getTime() - existing.windowStart.getTime();
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    const updated = await prisma.rateLimitBucket.update({
      where: { bucketKey },
      data: { count: { increment: 1 } },
    });
    return { allowed: true, remaining: Math.max(0, limit - updated.count), retryAfterSeconds };
  } catch (error) {
    // Do not take checkout/tracking offline solely because the durable limiter table is unavailable.
    // Serverless instances still get a short-lived in-memory safety net while the DB issue is fixed.
    console.error("Database rate limiter unavailable; using in-memory fallback", error);
    return consumeMemoryRateLimit(bucketKey, limit, windowMs);
  }
}

export function requestIp(req: { ip?: string; headers: Record<string, unknown> | any }) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0]?.trim();
  return forwarded || String(req.ip || req.headers?.["x-real-ip"] || "unknown");
}

export function isLikelyBot(userAgent: string | undefined) {
  if (!userAgent) return false;
  return /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|facebot|googlebot|adsbot|headlesschrome|lighthouse|pagespeed|pingdom|uptimerobot|monitoring)/i.test(userAgent);
}
