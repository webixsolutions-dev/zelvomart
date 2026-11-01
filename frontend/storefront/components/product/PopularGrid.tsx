"use client";

import { listUrl, useProducts } from "@store/lib/catalog-client";
import { ProductGrid } from "./ProductGrid";

/**
 * Bestsellers loaded in the browser. Used on the 404 page: Next.js embeds the not-found page in every page's
 * payload, so a server-side list there would be fetched and sent with every page view.
 */
export function PopularGrid({ count = 4 }: { count?: number }) {
  const items = useProducts(listUrl("bestsellers", count));
  return items?.length ? <ProductGrid items={items} /> : null;
}
