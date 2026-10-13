/** Buying two of the same product is 5% off the pair. */
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

export type PriceSummary = {
  price: number;
  regularPrice: number;
  salePrice: number | null;
  onSale: boolean;
  saveAmount: number;
  discountPercent: number;
};

function amount(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Single source of truth for what a product costs and how much the sale takes off. */
export function priceSummary(regularInput: unknown, saleInput: unknown): PriceSummary {
  const regularPrice = amount(regularInput) ?? 0;
  const sale = amount(saleInput);
  const onSale = sale != null && sale < regularPrice;
  const price = onSale ? sale : regularPrice;
  const saveAmount = onSale ? regularPrice - price : 0;
  return {
    price,
    regularPrice,
    salePrice: onSale ? sale : null,
    onSale,
    saveAmount,
    discountPercent: onSale ? Math.max(1, Math.round((saveAmount / regularPrice) * 100)) : 0,
  };
}

/** A variant sells at its own price when it has one, otherwise it inherits the product price. */
export function variantPriceSummary(
  product: PriceSummary,
  variant: { priceOverride?: unknown; regularPrice?: unknown; salePrice?: unknown },
): PriceSummary {
  const override = amount(variant.priceOverride);
  if (override == null) return product;
  const regular = amount(variant.regularPrice);
  return regular != null && regular > override ? priceSummary(regular, override) : priceSummary(override, null);
}
