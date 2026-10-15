// Keep identical to backend/src/lib/shipping.ts: the storefront shows the same fee the order saves.
export const FREE_SHIPPING_ABOVE = 8000;
export const DEFAULT_DELIVERY_CHARGE = 250;

export type DeliverySettings = {
  mode?: string;
  flatRate?: number | null;
  freeAbove?: number | null;
  codFee?: number | null;
};

export type DeliveryPolicy = {
  flatRate: number;
  threshold: number;
  codFee: number;
};

function positive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * The charge comes only from Admin -> Settings -> Delivery. It never defaults to free: an
 * empty or zero charge falls back to DEFAULT_DELIVERY_CHARGE, an empty free-above amount to
 * FREE_SHIPPING_ABOVE.
 */
export function resolveDeliveryPolicy(rule?: DeliverySettings | null): DeliveryPolicy {
  return {
    flatRate: positive(rule?.flatRate) || DEFAULT_DELIVERY_CHARGE,
    threshold: positive(rule?.freeAbove) || FREE_SHIPPING_ABOVE,
    codFee: positive(rule?.codFee),
  };
}

/** Free when the order total is above the free-above amount, or every item has free shipping turned on. */
export function quoteFromPolicy(subtotal: number, everyItemFreeShipping: boolean, policy: DeliveryPolicy) {
  const qualifiesByTotal = subtotal > policy.threshold;
  const fee = qualifiesByTotal || everyItemFreeShipping ? 0 : policy.flatRate;
  return { ...policy, fee, qualifiesByTotal, everyItemFreeShipping };
}

export function quoteDelivery(subtotal: number, everyItemFreeShipping: boolean, rule?: DeliverySettings | null) {
  return quoteFromPolicy(subtotal, everyItemFreeShipping, resolveDeliveryPolicy(rule));
}

export function amountUntilFreeShipping(subtotal: number, threshold: number) {
  if (subtotal > threshold) return 0;
  return Math.max(1, Math.ceil(threshold - subtotal + 0.01));
}
