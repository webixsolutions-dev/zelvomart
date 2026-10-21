import { createHash } from "node:crypto";
export const RECOVERY_OFFER_HOURS = 24;
export function recoveryOfferCode(token: string) {
  return "RCV-" + createHash("sha256").update(token).digest("hex").slice(0, 24).toUpperCase();
}
export function recoveryOfferExpiry(now: Date, parentExpiry: Date | null) {
  return new Date(Math.min(now.getTime() + RECOVERY_OFFER_HOURS * 3600000, parentExpiry?.getTime() ?? Infinity));
}
