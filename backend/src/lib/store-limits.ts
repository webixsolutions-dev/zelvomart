import { timingSafeEqual } from "node:crypto";

/**
 * Request limits for the shop's public endpoints. Pakistani mobile networks put many shoppers behind one public IP
 * (carrier NAT), so the per-IP limits are generous; the real protection on orders is the per-phone limit, which
 * counts one phone number on every IP.
 */
export const STORE_LIMITS = {
  checkoutPerIp: { limit: 60, windowMs: 15 * 60 * 1000 },
  checkoutPerPhone: { limit: 6, windowMs: 15 * 60 * 1000 },
  eventsPerVisitor: { limit: 240, windowMs: 60 * 1000 },
  eventsPerIp: { limit: 1200, windowMs: 60 * 1000 },
  searchPerIp: { limit: 120, windowMs: 60 * 1000 },
  couponPerIp: { limit: 40, windowMs: 60 * 1000 },
} as const;

export type LimitRule = { key: string; limit: number; windowMs: number };

/** The two checkout buckets: one per IP, one per phone number (the same on every IP). */
export function checkoutRateRules(ip: string, phoneDigits: string): [LimitRule, LimitRule] {
  return [
    { key: `checkout-ip:${ip}:`, ...STORE_LIMITS.checkoutPerIp },
    { key: `checkout-phone:*:${phoneDigits}`, ...STORE_LIMITS.checkoutPerPhone },
  ];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tracking events are counted per visitor (the browser's visitor id) when it is sent, otherwise per IP. */
export function eventsRateRule(ip: string, visitorId: unknown): LimitRule {
  const id = typeof visitorId === "string" ? visitorId.trim() : "";
  if (UUID.test(id)) return { key: `events-visitor:${id.toLowerCase()}`, ...STORE_LIMITS.eventsPerVisitor };
  return { key: `events:${ip}:`, ...STORE_LIMITS.eventsPerIp };
}

/**
 * The shopper's IP. The storefront's proxy forwards it in `x-zm-client-ip`; that header is trusted only when
 * `x-zm-proxy-secret` matches STORE_PROXY_SECRET, so a browser cannot pick its own IP.
 */
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
