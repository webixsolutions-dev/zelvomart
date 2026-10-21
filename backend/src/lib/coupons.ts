import { prisma } from "./db";
export const couponCode = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase();
export function couponDiscount(
  coupon: { type: string; amount: unknown; active: boolean; expiresAt: Date | null },
  subtotal: number,
  now = new Date(),
) {
  if (!coupon.active || (coupon.expiresAt && coupon.expiresAt < now))
    throw new Error("This coupon is inactive or expired.");
  const amount = Number(coupon.amount);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(subtotal) || subtotal < 0)
    throw new Error("Invalid coupon amount.");
  return Math.round(Math.min(subtotal, coupon.type === "PERCENT" ? (subtotal * amount) / 100 : amount) * 100) / 100;
}
export async function validateCoupon(code: unknown, subtotal: number, db: Pick<typeof prisma, "coupon"> = prisma) {
  const normalized = couponCode(code);
  if (!normalized) return { code: null, discount: 0 };
  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon) throw new Error("Coupon code not found.");
  if (normalized.startsWith("RCV-") && coupon.usedCount > 0)
    throw new Error("This recovery offer has already been used.");
  return { code: normalized, discount: couponDiscount(coupon, subtotal) };
}
export function couponInput(body: any) {
  const code = couponCode(body.code),
    amount = Number(body.amount),
    type = String(body.type);
  const expiresAt = body.expiresAt ? new Date(`${String(body.expiresAt).slice(0, 10)}T23:59:59.999+05:00`) : null;
  if (
    body.expiresAt &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.expiresAt)) ||
      !expiresAt ||
      Number.isNaN(expiresAt.getTime()) ||
      new Date(expiresAt.getTime() + 5 * 3600000).toISOString().slice(0, 10) !== String(body.expiresAt))
  )
    throw new Error("Choose a valid expiry date.");
  if (
    !/^[A-Z0-9_-]{2,40}$/.test(code) ||
    !["PERCENT", "FIXED"].includes(type) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    (type === "PERCENT" && (amount < 1 || amount > 100)) ||
    (expiresAt && Number.isNaN(expiresAt.getTime())) ||
    typeof body.active !== "boolean"
  )
    throw new Error("Enter a unique code, valid discount amount, expiry date and active status.");
  return { code, type, amount, expiresAt, active: body.active };
}
