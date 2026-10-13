export const FREE_SHIPPING_ABOVE = 8000;
export const DEFAULT_DELIVERY_CHARGE = 250;

export type DeliverySettings = {
  mode?: string;
  flatRate?: number;
  freeAbove?: number;
  codFee?: number;
};

export type DeliveryPolicy = {
  flatRate: number;
  threshold: number;
  codFee: number;
};

export function isLegacyFreeDelivery(rule?: DeliverySettings | null) {
  if (!rule || typeof rule !== "object") return true;
  return (rule.mode || "FREE") === "FREE" && Number(rule.flatRate || 0) === 0 && Number(rule.freeAbove || 0) === 0;
}

export function resolveDeliveryPolicy(rule?: DeliverySettings | null): DeliveryPolicy {
  const legacy = isLegacyFreeDelivery(rule);
  const configuredThreshold = Number(rule?.freeAbove || 0);
  const threshold = configuredThreshold > 0 ? Math.min(configuredThreshold, FREE_SHIPPING_ABOVE) : FREE_SHIPPING_ABOVE;
  const flatRate = legacy ? DEFAULT_DELIVERY_CHARGE : Math.max(0, Number(rule?.flatRate || 0));
  return {
    flatRate,
    threshold,
    codFee: Number(rule?.codFee || 0),
  };
}

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
