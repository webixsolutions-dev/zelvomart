import { getProductById } from "./catalog";
import { site } from "./site";
import type { Order } from "./store";

/**
 * Order tracking, frontend side.
 *
 * There is no tracking endpoint in this static build, so `findOrder` looks up the orders saved on this
 * device by the store (checkout writes them to localStorage). When `POST /api/orders/track` exists, swap
 * `findOrder` for a fetch that returns the same `TrackedOrder` shape; the page does not need to change.
 */

export type TrackStatus = "NEW" | "CONFIRMED" | "ON_HOLD" | "BOOKED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "RETURNED";

export type TrackedLine = { name: string; qty: number; price: number; image: string; slug?: string };

export type TrackedOrder = {
  number: string;
  createdAt: string;
  status: TrackStatus;
  city: string;
  lines: TrackedLine[];
  total: number;
  courier: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

/** The five stages shown in the tracker and in "What each stage means" (same order, same icons). */
export const stages = [
  { key: "received", title: "Order received", sub: "Your order is recorded." },
  { key: "confirmed", title: "Confirmed", sub: "We confirm the details with you on a call or WhatsApp." },
  { key: "packed", title: "Packed", sub: `Checked and packed with care, then booked with ${site.shipping.courier}.` },
  { key: "transit", title: "In transit", sub: "On its way with our courier." },
  { key: "delivered", title: "Delivered", sub: "At your door. Pay cash on delivery." },
] as const;

export type StatusTone = "blue" | "amber" | "green" | "grey";

/** Platform status → stage on the tracker (null = shown in a grey card instead), pill label, tone and sentence. */
export const statusInfo: Record<TrackStatus, { stage: number | null; label: string; tone: StatusTone; sentence: string }> = {
  NEW: { stage: 0, label: "Order received", tone: "blue", sentence: "We’ve received your order. Our team will call or WhatsApp you to confirm it." },
  CONFIRMED: { stage: 1, label: "Confirmed", tone: "blue", sentence: "Your order is confirmed and being prepared." },
  ON_HOLD: { stage: 1, label: "On hold", tone: "amber", sentence: "Your order is on hold. Please check WhatsApp; we may need a detail from you." },
  BOOKED: { stage: 2, label: "Packed", tone: "blue", sentence: `Your parcel is packed and booked with ${site.shipping.courier}.` },
  IN_TRANSIT: { stage: 3, label: "In transit", tone: "blue", sentence: "Your parcel is on its way." },
  DELIVERED: { stage: 4, label: "Delivered", tone: "green", sentence: "Delivered. We hope you love it!" },
  CANCELLED: { stage: null, label: "Cancelled", tone: "grey", sentence: "This order was cancelled. Message us if this isn’t right." },
  RETURNED: { stage: null, label: "Returned", tone: "grey", sentence: "This order was returned to us. Message us for help." },
};

/** Accepts the platform spellings (NEW, in-transit, on hold, …); anything unknown reads as a new order. */
export function normaliseStatus(raw: unknown): TrackStatus {
  const s = String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, TrackStatus> = {
    RECEIVED: "NEW",
    PLACED: "NEW",
    PACKED: "BOOKED",
    OUT_FOR_DELIVERY: "IN_TRANSIT",
    SHIPPED: "IN_TRANSIT",
    CANCELED: "CANCELLED",
  };
  if (s in statusInfo) return s as TrackStatus;
  return aliases[s] ?? "NEW";
}

/** "ZM-10004", "#zm 10004" and "zm10004" all compare equal. */
export const orderKey = (s: string) => s.trim().replace(/^#/, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Last ten digits, so 0300…, 92300… and +92 300… match. */
export const phoneKey = (s: string) => s.replace(/\D/g, "").slice(-10);

/** "lahpre" → "Lahpre", "rawal pindi" → "Rawal Pindi". */
export const cityName = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

/** City delivery days when Settings has them; otherwise the store-wide estimate. */
export function deliveryEstimate(city: string): string {
  const cities = (site.shipping as { cities?: Record<string, string> }).cities;
  return cities?.[city.trim().toLowerCase()] ?? site.shipping.estimate;
}

type StoredOrder = Order & { status?: string; trackingNumber?: string; trackingUrl?: string };

function toTracked(o: StoredOrder): TrackedOrder {
  return {
    number: o.id,
    createdAt: o.createdAt,
    status: normaliseStatus(o.status),
    city: cityName(o.customer.city),
    lines: o.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price, image: l.image, slug: getProductById(l.id)?.slug })),
    total: o.total,
    courier: site.shipping.courier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl?.startsWith("https://") ? o.trackingUrl : undefined,
  };
}

/** Order number and mobile number must both match, and a miss never says which one was wrong. */
export function findOrder(orders: Order[], number: string, phone: string): TrackedOrder | null {
  const n = orderKey(number);
  const p = phoneKey(phone);
  if (!n || p.length < 10) return null;
  const hit = orders.find((o) => orderKey(o.id) === n && phoneKey(o.customer.phone) === p);
  return hit ? toTracked(hit as StoredOrder) : null;
}
