"use client";

import { setCatalog, upsertProducts, type Product } from "./catalog";
import { applyStoreSettings, type StoreSettings } from "./settings";

/**
 * Hands the backend catalog and store settings (loaded by the store layout on the server)
 * to the design's browser-side helpers before any page renders. Renders nothing itself.
 */
export function CatalogBridge({ products, settings, children }: { products: Product[]; settings: StoreSettings; children: React.ReactNode }) {
  setCatalog(products);
  applyStoreSettings(settings);
  return <>{children}</>;
}

/** Puts the full product (description, all bullets) into the browser catalog before its page renders. */
export function ProductBridge({ product, children }: { product: Product; children: React.ReactNode }) {
  upsertProducts([product]);
  return <>{children}</>;
}
