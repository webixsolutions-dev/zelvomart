import type { PriceSummary, Product, Variant } from "@/types/product";

/** Prices, savings and discount percent are calculated by the backend; this only picks the right summary. */
export function productPricing(product: Product, variant?: Variant | null): PriceSummary {
  if (variant?.pricing) return variant.pricing;

  const override = variant?.priceOverride == null ? null : Number(variant.priceOverride);
  if (override != null && override > 0) {
    return { price: override, regularPrice: override, salePrice: null, onSale: false, saveAmount: 0, discountPercent: 0 };
  }

  const price = Number(product.price || 0);
  const regularPrice = Number(product.regularPrice || price);
  const onSale = Boolean(product.onSale) && regularPrice > price;
  return {
    price,
    regularPrice,
    salePrice: onSale ? price : null,
    onSale,
    saveAmount: onSale ? Number(product.saveAmount ?? regularPrice - price) : 0,
    discountPercent: onSale ? Number(product.discountPercent || 0) : 0,
  };
}
