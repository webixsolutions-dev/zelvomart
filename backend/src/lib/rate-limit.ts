import { prisma } from "./db";
import { consumeDatabaseRateLimit, type RateLimitResult } from "./rate-limit-store";
export type { RateLimitResult } from "./rate-limit-store";

/**
 * Database-backed rate limiter so limits still work across serverless instances.
 * The bucket is intentionally simple and durable; expired buckets are reset on use.
 */
export async function consumeRateLimit(bucketKey: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return consumeDatabaseRateLimit(prisma, bucketKey, limit, windowMs);
}

export function requestIp(req: { ip?: string; headers: Record<string, unknown> | any }) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    ?.trim();
  return forwarded || String(req.ip || req.headers?.["x-real-ip"] || "unknown");
}

export function isLikelyBot(userAgent: string | undefined) {
  if (!userAgent) return false;
  return /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|facebot|googlebot|adsbot|headlesschrome|lighthouse|pagespeed|pingdom|uptimerobot|monitoring)/i.test(
    userAgent,
  );
}
