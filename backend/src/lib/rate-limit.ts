import { prisma } from "./db";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Database-backed rate limiter so limits still work across serverless instances.
 * The bucket is intentionally simple and durable; expired buckets are reset on use.
 */
export async function consumeRateLimit(bucketKey: string, limit: number, windowMs: number): Promise<RateLimitResult> {
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
}

export function requestIp(req: { ip?: string; headers: Record<string, unknown> | any }) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0]?.trim();
  return forwarded || String(req.ip || req.headers?.["x-real-ip"] || "unknown");
}

export function isLikelyBot(userAgent: string | undefined) {
  if (!userAgent) return false;
  return /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|facebot|googlebot|adsbot|headlesschrome|lighthouse|pagespeed|pingdom|uptimerobot|monitoring)/i.test(userAgent);
}
