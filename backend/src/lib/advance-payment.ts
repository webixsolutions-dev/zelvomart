import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  advanceDiscountFor,
  amountUntilAdvanceDiscount,
  resolveAdvancePolicy,
  type AdvancePolicy,
} from "@zelvomart/delivery";
import { getSetting } from "./settings";
import { adsEnvironment } from "./ads-policy";

/**
 * Advance payment by Easypaisa Till / Raast QR. There is no payment API: the customer pays in their own app and sends
 * proof; staff verify the credit in the Easypaisa merchant app before dispatch. Everything here is read from the one
 * admin setting `payments.advance` (Settings -> Payments -> Advance payment).
 */
export const ADVANCE_SETTING_KEY = "payments.advance";
export const DEMO_TILL_ID = "DEMO-TILL";

export type AdvanceSettings = {
  enabled: boolean;
  accountName: string;
  tillId: string;
  /** Public media URL of the merchant Raast QR, exactly as uploaded. Empty: the built-in demo image. */
  qrImageUrl: string;
  discount: number;
  minSubtotal: number;
  reminderHours: number;
  expiryHours: number;
  verificationHours: string;
  autoRead: boolean;
};

export const ADVANCE_DEFAULTS: AdvanceSettings = {
  enabled: false,
  accountName: "Zelvomart",
  tillId: DEMO_TILL_ID,
  qrImageUrl: "",
  discount: 200,
  minSubtotal: 0,
  reminderHours: 2,
  expiryHours: 24,
  verificationHours: "9am – 9pm",
  autoRead: false,
};

/** Stored value merged over the defaults; unknown or wrong-typed fields fall back. */
export function normalizeAdvanceSettings(value: unknown): AdvanceSettings {
  const v = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const text = (key: keyof AdvanceSettings) =>
    typeof v[key] === "string" ? String(v[key]).trim() : (ADVANCE_DEFAULTS[key] as string);
  const whole = (key: keyof AdvanceSettings, min: number) => {
    const n = Number(v[key]);
    return Number.isFinite(n) && n >= min ? Math.floor(n) : (ADVANCE_DEFAULTS[key] as number);
  };
  return {
    enabled: v.enabled === true,
    accountName: text("accountName") || ADVANCE_DEFAULTS.accountName,
    tillId: text("tillId"),
    qrImageUrl: text("qrImageUrl"),
    discount: whole("discount", 0),
    minSubtotal: whole("minSubtotal", 0),
    reminderHours: whole("reminderHours", 1),
    expiryHours: whole("expiryHours", 1),
    verificationHours: text("verificationHours") || ADVANCE_DEFAULTS.verificationHours,
    autoRead: v.autoRead === true,
  };
}

export async function loadAdvanceSettings() {
  return normalizeAdvanceSettings(await getSetting<unknown>(ADVANCE_SETTING_KEY, null));
}

/** Demo while the Till ID is missing or the demo one, or no real QR image has been uploaded. */
export function advanceUsesDemoValues(settings: AdvanceSettings) {
  const till = settings.tillId.trim().toUpperCase();
  return !till || till === DEMO_TILL_ID || !settings.qrImageUrl || /demo/i.test(settings.qrImageUrl);
}

/**
 * Whether customers may choose advance payment.
 * - Production (APP_ENV=production): only when enabled AND real Till ID and QR are saved. Never a demo.
 * - Anywhere else (local, previews): always available for testing, with the DEMO banner unless real and enabled.
 */
export function advanceAvailability(settings: AdvanceSettings, env: { APP_ENV?: string } = process.env) {
  const demoValues = advanceUsesDemoValues(settings);
  if (adsEnvironment(env)) return { available: settings.enabled && !demoValues, demo: false };
  return { available: true, demo: demoValues || !settings.enabled };
}

export function advancePolicy(settings: AdvanceSettings): AdvancePolicy {
  return resolveAdvancePolicy(settings);
}

/** The discount saved on an advance order (same function the storefront shows, packages/delivery). */
export function advanceDiscount(settings: AdvanceSettings, subtotal: number, payableBefore: number) {
  return advanceDiscountFor(subtotal, payableBefore, advancePolicy(settings));
}

export function advanceShortfall(settings: AdvanceSettings, subtotal: number) {
  return amountUntilAdvanceDiscount(subtotal, advancePolicy(settings));
}

// ---- Guest payment link ----
// The token is derived from the order number with a server secret, so the confirmation email can carry the link
// later without storing the token. Only its SHA-256 is saved on the order.

function linkSecret() {
  const secret = process.env.PAYMENT_LINK_SECRET || process.env.JWT_SECRET || "";
  if (secret.length < 16) throw new Error("PAYMENT_LINK_SECRET or JWT_SECRET must be set for payment links");
  return secret;
}

export function paymentToken(orderNumber: string) {
  return createHmac("sha256", linkSecret()).update(`advance-pay:${orderNumber}`).digest("base64url");
}

export function paymentTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time check of a token against the hash saved on the order. */
export function paymentTokenMatches(token: unknown, storedHash: string | null | undefined) {
  if (typeof token !== "string" || !token || token.length > 200 || !storedHash) return false;
  const given = Buffer.from(paymentTokenHash(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}

export function paymentPath(orderNumber: string, token = paymentToken(orderNumber)) {
  return `/pay/${encodeURIComponent(orderNumber)}/?t=${encodeURIComponent(token)}`;
}

// ---- Courier ----

type CodOrder = {
  paymentMethod: string;
  paymentStatus?: string | null;
  total: number | string | { toString(): string };
  advanceReceived?: number | string | { toString(): string } | null;
};

/**
 * Cash the courier collects on delivery (the COD amount to enter when booking with PostEx).
 * - COD: the order total.
 * - Advance, verified: 0 (fully paid).
 * - Advance, partial payment accepted (MISMATCH with an amount received): only the remaining balance.
 * - Advance, not verified: the full total, so an unverified order is never shipped as paid.
 */
export function codToCollect(order: CodOrder) {
  const total = Math.max(0, Math.round(Number(order.total) || 0));
  if (order.paymentMethod !== "ADVANCE_EASYPAISA") return total;
  if (order.paymentStatus === "VERIFIED") return 0;
  const received = Math.max(0, Math.round(Number(order.advanceReceived ?? 0) || 0));
  if (order.paymentStatus === "MISMATCH" && received > 0) return Math.max(0, total - received);
  return total;
}
