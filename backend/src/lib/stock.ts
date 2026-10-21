// One availability rule for products and variations, used by the product JSON, the shop
// filter, checkout, the Meta feed and the schema.
//
//   Track ON            -> quantity is live: in stock while stock > 0, orders reduce it.
//   Track OFF + instock -> in stock; orders are not checked against or reduce a quantity.
//   Track OFF + out     -> out of stock; cannot be ordered.
//
// A product with active variations is in stock when at least one of them is. That is
// worked out here on read, never from the parent `stock` column (it goes stale after orders).
import type { Prisma } from "../generated/prisma/client";

export type StockStatus = "instock" | "outofstock";

export type StockFields = {
  trackStock?: boolean | null;
  stockStatus?: string | null;
  stock?: number | null;
};

export function cleanStockStatus(value: unknown): StockStatus {
  return value === "outofstock" || value === "onbackorder" ? "outofstock" : "instock";
}

/** Can `quantity` pieces of this product/variation be ordered right now? */
export function canSell(item: StockFields, quantity = 1) {
  if (item.trackStock) return Number(item.stock || 0) >= quantity;
  return cleanStockStatus(item.stockStatus) === "instock";
}

export function itemStockStatus(item: StockFields): StockStatus {
  return canSell(item, 1) ? "instock" : "outofstock";
}

type WithVariants = StockFields & { variants?: Array<StockFields & { active?: boolean | null }> | null };

function activeVariants(product: WithVariants) {
  return (product.variants || []).filter((variant) => variant.active !== false);
}

export function productStockStatus(product: WithVariants): StockStatus {
  const variants = activeVariants(product);
  if (!variants.length) return itemStockStatus(product);
  return variants.some((variant) => canSell(variant, 1)) ? "instock" : "outofstock";
}

/** Tracked quantity the admin sees: the product's own stock, or the sum over tracked active variations. */
export function trackedQuantity(product: WithVariants) {
  const variants = activeVariants(product);
  if (!variants.length) return product.trackStock ? Number(product.stock || 0) : null;
  const tracked = variants.filter((variant) => variant.trackStock);
  return tracked.length ? tracked.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) : null;
}

const SELLABLE: Prisma.VariantWhereInput & Prisma.ProductWhereInput = {
  OR: [
    { trackStock: true, stock: { gt: 0 } },
    { trackStock: false, stockStatus: "instock" },
  ],
};

/** SQL version of productStockStatus(...) === "instock" for the shop's availability filter. */
export const IN_STOCK_WHERE: Prisma.ProductWhereInput = {
  OR: [{ variants: { none: { active: true } }, ...SELLABLE }, { variants: { some: { active: true, ...SELLABLE } } }],
};
