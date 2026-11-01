"use client";

import { upsertProducts, type Product } from "./catalog";
import { applyStoreSettings, type StoreSettings } from "./settings";

/**
 * Hands the store settings (loaded by the store layout on the server) to the design's browser-side helpers before
 * any page renders. The full catalog is no longer sent to every page: pages pass the products they show
 * (ProductsBridge) and the cart loads its own products by id (store.tsx).
 */
export function CatalogBridge({ settings, children }: { settings: StoreSettings; children: React.ReactNode }) {
  applyStoreSettings(settings);
  return <>{children}</>;
}

/** Puts the products a page shows (cards) into the browser catalog, so add-to-cart and the cart can use them. */
export function ProductsBridge({ products, children }: { products: Product[]; children?: React.ReactNode }) {
  upsertProducts(products);
  return <>{children}</>;
}

/** Puts the full product (description, all bullets) into the browser catalog before its page renders. */
export function ProductBridge({ product, children }: { product: Product; children: React.ReactNode }) {
  upsertProducts([product]);
  return <>{children}</>;
}
