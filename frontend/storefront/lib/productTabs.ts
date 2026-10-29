import type { Product } from "./catalog";
import { getCategory } from "./catalog";
import { site } from "./site";
import { storeProductTabs } from "./settings";
import { fillDeliveryAmounts, resolveStoreProductTabs } from "@/lib/product-tabs";

/**
 * Product page detail sections. The middle tabs are the ones edited in Admin → Product tabs (a product's own
 * override wins over the store-wide text); empty ones are left out. Delivery amounts in their text
 * ({free_delivery_over}, {delivery_fee}) are filled from the live delivery setting.
 */
export type ProductTab =
  | { id: "description"; label: string }
  | { id: string; label: string; html: string }
  | { id: "info"; label: string; rows: [string, string][] };

export function resolveProductTabs(p: Product): ProductTab[] {
  const cat = getCategory(p.category);
  const rows: [string, string][] = [
    ...(cat ? ([["Category", cat.name]] as [string, string][]) : []),
    ...p.specs,
    ...(p.variants ? ([[`${p.variants.label} options`, p.variants.options.map((o) => o.name).join(", ")]] as [string, string][]) : []),
    ["SKU", p.sku],
  ];
  const amounts = { freeOver: site.shipping.freeOver, flatFee: site.shipping.flatFee };
  const edited = resolveStoreProductTabs(storeProductTabs.value, { productTabs: p.tabOverrides }).map((tab) => ({
    id: tab.key,
    label: tab.title,
    html: fillDeliveryAmounts(tab.html, amounts),
  }));
  const tabs: ProductTab[] = [{ id: "description", label: "Description" }, ...edited, { id: "info", label: "Additional information", rows }];
  return tabs.filter((t) => !("rows" in t) || t.rows.length > 0);
}
