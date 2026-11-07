"use client";

import { useEffect, useState } from "react";
import { upsertProducts, type Product } from "./catalog";

/**
 * Browser-side product lists from the storefront's own cached route (app/api/catalog): cart and wishlist products
 * by id, small "you may like" rows and search suggestions. One request per distinct URL per page view; the answers
 * also go into the browser catalog so getProductById works for them.
 */
const cache = new Map<string, Promise<Product[]>>();

export function fetchProducts(url: string): Promise<Product[]> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: Product[] }) => {
        const items = Array.isArray(data.items) ? data.items : [];
        upsertProducts(items);
        return items;
      })
      .catch(() => {
        cache.delete(url);
        return [];
      });
    cache.set(url, pending);
  }
  return pending;
}

/** URL for one of the small lists: bestsellers, upsell (in stock, up to Rs 2,000). */
export const listUrl = (list: "bestsellers" | "upsell", limit: number) => `/api/catalog?list=${list}&limit=${limit}`;
export const idsUrl = (ids: string[]) => `/api/catalog?ids=${[...new Set(ids)].sort().map(encodeURIComponent).join(",")}`;

export async function fetchCartProducts(ids: string[], signal: AbortSignal): Promise<Product[]> {
  const batches = [];
  for (let start = 0; start < ids.length; start += 50) batches.push(ids.slice(start, start + 50));
  return (await Promise.all(batches.map(async (batch) => {
    const response = await fetch(`${idsUrl(batch)}&fresh=1`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("CART_CATALOG_UNAVAILABLE");
    const data: { items?: Product[] } = await response.json();
    if (!Array.isArray(data.items)) throw new Error("CART_CATALOG_UNAVAILABLE");
    return data.items;
  }))).flat();
}
export const searchUrl = (q: string, limit: number) => `/api/catalog?q=${encodeURIComponent(q.trim())}&limit=${limit}`;

/** Products for `url` (null while loading). `url` null = nothing to load. */
export function useProducts(url: string | null) {
  const [items, setItems] = useState<Product[] | null>(url ? null : []);
  useEffect(() => {
    if (!url) {
      setItems([]);
      return;
    }
    let live = true;
    setItems(null);
    void fetchProducts(url).then((list) => live && setItems(list));
    return () => {
      live = false;
    };
  }, [url]);
  return items;
}
