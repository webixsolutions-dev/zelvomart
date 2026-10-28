import { prisma } from "./db";
import {
  consumeDatabaseRateLimit,
  consumeDatabaseRateLimits,
  type RateLimitResult,
  type RateLimitRule,
} from "./rate-limit-store";
import { timingSafeEqual } from "node:crypto";
export type { RateLimitResult } from "./rate-limit-store";

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

export function requestIp(req: { ip?: string; headers: Record<string, unknown> | any }) {
  const expected = process.env.STORE_PROXY_SECRET || process.env.REVALIDATION_SECRET || "";
  const supplied = String(req.headers?.["x-zm-proxy-secret"] || "");
  const forwardedIp = String(req.headers?.["x-zm-client-ip"] || "").trim();
  if (expected && supplied && forwardedIp) {
    const left = Buffer.from(expected);
    const right = Buffer.from(supplied);
    if (left.length === right.length && timingSafeEqual(left, right) && isValidIp(forwardedIp)) return forwardedIp;
  }
  return String(req.ip || "unknown");
}

function isValidIp(value: string) {
  // Accept plain IPv4/IPv6 values only; never let a proxy turn arbitrary text into an IP key.
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-f:]+$/i.test(value);
}

export function isLikelyBot(userAgent: string | undefined) {
  if (!userAgent) return false;
  return /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|facebot|googlebot|adsbot|headlesschrome|lighthouse|pagespeed|pingdom|uptimerobot|monitoring)/i.test(
    userAgent,
  );
}
