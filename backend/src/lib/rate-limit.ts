import { prisma } from "./db";
import {
  consumeDatabaseRateLimit,
  consumeDatabaseRateLimits,
  type RateLimitResult,
  type RateLimitRule,
} from "./rate-limit-store";
export type { RateLimitResult } from "./rate-limit-store";
export { requestIp, STORE_LIMITS, checkoutRateRules, eventsRateRule } from "./store-limits";

/**
 * Database-backed rate limiter so limits still work across serverless instances.
 * The bucket is intentionally simple and durable; expired buckets are reset on use.
 */
export async function consumeRateLimit(bucketKey: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return consumeDatabaseRateLimit(prisma, bucketKey, limit, windowMs);
}

export async function consumeRateLimits(rules: [RateLimitRule, RateLimitRule]): Promise<RateLimitResult[]> {
  return consumeDatabaseRateLimits(prisma, rules);
}

export function isLikelyBot(userAgent: string | undefined) {
  if (!userAgent) return false;
  return /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|facebot|googlebot|adsbot|headlesschrome|lighthouse|pagespeed|pingdom|uptimerobot|monitoring)/i.test(
    userAgent,
  );
}
