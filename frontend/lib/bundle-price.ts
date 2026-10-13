/** Buying two of the same product is 5% off the pair. Matches the checkout formula. */
export const BUY_TWO_DISCOUNT_PERCENT = 5;

export function bundleLineTotal(
  unitPrice: number,
  quantity: number,
  bundleSize: 1 | 2,
  discountPercent = BUY_TWO_DISCOUNT_PERCENT,
) {
  const pieces = Math.max(1, quantity) * (bundleSize === 2 ? 2 : 1);
  const full = Math.max(0, unitPrice) * pieces;
  if (bundleSize !== 2 || discountPercent <= 0) {
    return { full, saving: 0, total: full, pieces };
  }
  const total = Math.round(full * (1 - discountPercent / 100));
  return { full, saving: full - total, total, pieces };
}

export function pairOffer(unitPrice: number, discountPercent = BUY_TWO_DISCOUNT_PERCENT) {
  return bundleLineTotal(unitPrice, 1, 2, discountPercent);
}
