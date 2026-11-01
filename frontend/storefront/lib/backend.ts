import "server-only";
import { cache } from "react";
import { apiFetch } from "@/lib/api";
import type { Product as ApiProduct, ProductListResponse } from "@/types/product";
import { backendCategorySlugs, designCategoryId, upsertProducts, type CategoryId, type Product } from "./catalog";
import { toDesignProduct } from "./product-map";
import { applyStoreSettings, type StoreSettings } from "./settings";
import { pageToPolicy, type PageRow } from "./policies/html";
import { isSeoIndex } from "./sitemaps";
import type { PolicyDocument } from "./policies/types";

/**
 * The storefront's only door to the backend catalog (server side).
 * Every backend product is turned into the design's `Product` shape by `toDesignProduct()`
 * (`product-map.ts`), so the design's components and helpers do not change.
 */

export { toDesignProduct };

const REVALIDATE = 300;
/** Products per shop/category page (owner decision: 24, numbered pages). */
export const PAGE_SIZE = 24;

/** Lighter copy for cards and the browser cart (the product page loads the full one). */
export function slimProduct(p: Product): Product {
  const { reviews: _reviews, ...rest } = p;
  return { ...rest, description: "", descriptionHtml: "", highlights: p.highlights.slice(0, 4), specs: [], idealFor: [], inBox: [] };
}

async function bundleDefault() {
  try {
    const s = await apiFetch<Record<string, unknown>>(`/api/settings/public?keys=store.bundleDefaultDiscountPercent`, {
      next: { revalidate: REVALIDATE, tags: ["settings"] },
    });
    return Number(s["store.bundleDefaultDiscountPercent"] ?? 5);
  } catch {
    return 5;
  }
}

export type CardQuery = {
  category?: CategoryId;
  /** Backend sort: newest (default), popular, price-asc, price-desc, name, discount, relevance. */
  sort?: string;
  /** Backend collection tag: new, bestsellers, discount. */
  tag?: string;
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
  ids?: string[];
  exclude?: string;
};
export type CardPage = { items: Product[]; total: number; page: number; totalPages: number };

/** The backend query string for a card list (GET /api/products?view=card&…). */
export function cardQueryString(q: CardQuery) {
  const params = new URLSearchParams({ view: "card", sort: q.sort || "newest", limit: String(q.limit ?? PAGE_SIZE) });
  if (q.page && q.page > 1) params.set("page", String(q.page));
  if (q.category) params.set("category", backendCategorySlugs[q.category] || q.category);
  if (q.tag) params.set("tag", q.tag);
  if (q.minPrice != null && q.minPrice > 0) params.set("minPrice", String(q.minPrice));
  if (q.maxPrice != null) params.set("maxPrice", String(q.maxPrice));
  if (q.inStock) params.set("availability", "instock");
  if (q.search) params.set("search", q.search);
  if (q.ids) params.set("ids", q.ids.join(","));
  if (q.exclude) params.set("exclude", q.exclude);
  return params.toString();
}

/**
 * One page of product cards, only the fields a card shows (lib/catalog-cards.ts on the backend). Cached 5 minutes
 * under the "products" tag; searches pass the shopper's IP (for the per-IP limit) and are not cached.
 * Backend unreachable: an empty page, never invented products.
 */
export async function loadCards(q: CardQuery, opts: { clientIp?: string } = {}): Promise<CardPage> {
  if (q.ids && !q.ids.length) return { items: [], total: 0, page: q.page || 1, totalPages: 1 };
  return cardsByQuery(cardQueryString(q), q.search ? opts.clientIp || "" : "", q.page || 1);
}

// One request per distinct card query per page render: the page and its metadata (generateMetadata) share it.
const cardsByQuery = cache(async (query: string, clientIp: string, page: number): Promise<CardPage> => {
  const empty = { items: [], total: 0, page, totalPages: 1 };
  const search = new URLSearchParams(query).has("search");
  const proxySecret = process.env.STORE_PROXY_SECRET || process.env.REVALIDATION_SECRET;
  try {
    const [res, pct] = await Promise.all([
      apiFetch<ProductListResponse>(
        `/api/products?${query}`,
        search
          ? {
              cache: "no-store",
              headers: clientIp && proxySecret ? { "x-zm-client-ip": clientIp, "x-zm-proxy-secret": proxySecret } : {},
            }
          : { next: { revalidate: REVALIDATE, tags: ["products"] } },
      ),
      bundleDefault(),
    ]);
    const items = (res.items || []).map((p) => slimProduct(toDesignProduct(p, pct)));
    upsertProducts(items);
    return { items, total: Number(res.total || 0), page: Number(res.page || 1), totalPages: Number(res.totalPages || 1) };
  } catch {
    return empty;
  }
});

/** The three product rows on the home page (8 each, newest first, like the old full-catalog filters). */
export async function loadHomeLists() {
  const [best, fresh, deals] = await Promise.all([
    loadCards({ tag: "bestsellers", limit: 8 }),
    loadCards({ tag: "new", limit: 8 }),
    loadCards({ tag: "discount", limit: 8 }),
  ]);
  return { best: best.items, fresh: fresh.items, deals: deals.items };
}

/** "You may also like": same category first (this product left out), topped up with bestsellers, then anything. */
export async function loadRelated(p: Product, n = 4): Promise<Product[]> {
  const same = await loadCards({ category: p.category, exclude: p.id, limit: n });
  if (same.items.length >= n) return same.items;
  const picked = [...same.items];
  const add = (items: Product[]) => {
    for (const item of items) if (picked.length < n && item.id !== p.id && !picked.some((x) => x.id === item.id)) picked.push(item);
  };
  add((await loadCards({ tag: "bestsellers", exclude: p.id, limit: n * 2 })).items.filter((x) => x.category !== p.category));
  if (picked.length < n) add((await loadCards({ exclude: p.id, limit: n * 3 })).items);
  return picked;
}

/** Published products per design category, from the backend's category list. */
export async function loadCategoryCounts(): Promise<Record<string, number>> {
  try {
    const rows = await apiFetch<{ slug: string; count: number }[]>(`/api/categories`, {
      next: { revalidate: REVALIDATE, tags: ["categories"] },
    });
    const out: Record<string, number> = {};
    for (const row of rows) {
      const id = designCategoryId(row.slug);
      out[id] = (out[id] || 0) + Number(row.count || 0);
    }
    return out;
  } catch {
    return {};
  }
}

/** One product with everything its page shows. */
export async function loadProduct(slug: string): Promise<Product | null> {
  try {
    const [p, pct] = await Promise.all([
      apiFetch<ApiProduct>(`/api/products/slug/${encodeURIComponent(slug)}`, {
        // Only this product's own tag (+ "product-pages" for store-wide changes): saving another product no longer
        // empties every product page.
        next: { revalidate: 120, tags: [`product:${slug}`, "product-pages"] },
      }),
      bundleDefault(),
    ]);
    const product = toDesignProduct(p, pct);
    upsertProducts([product]);
    return product;
  } catch {
    return null;
  }
}

/**
 * The public settings the store layout needs (pixel IDs and on/off switches, session recording) from
 * GET /api/store/bootstrap. Throws when the backend gave no answer and apiFetch had no earlier one: the layout
 * then loads no pixels or recorder.
 */
export async function loadPublicSettings(): Promise<Record<string, unknown>> {
  const result = await apiFetch<{ settings?: Record<string, unknown> }>(`/api/store/bootstrap`, {
    next: { revalidate: 30, tags: ["store", "categories", "settings"] },
  });
  return result.settings || {};
}

/** Phone, email, WhatsApp, delivery charge and per-city delivery days from Admin → Settings / Cities. */
export async function loadStoreSettings(): Promise<StoreSettings> {
  const out: StoreSettings = {};
  try {
    const s = await apiFetch<Record<string, any>>(`/api/settings/public?keys=store.info,store.delivery,store.productTabs`, {
      next: { revalidate: REVALIDATE, tags: ["settings"] },
    });
    const info = s["store.info"] || {};
    const delivery = s["store.delivery"] || {};
    if (info.phone) out.phone = String(info.phone);
    if (info.email) out.email = String(info.email);
    if (info.whatsapp) out.whatsapp = String(info.whatsapp).replace(/\D/g, "");
    if (String(info.supportHours || "").trim()) out.supportHours = String(info.supportHours).trim();
    if (Number(delivery.flatRate) > 0) out.flatFee = Number(delivery.flatRate);
    if (Number(delivery.freeAbove) > 0) out.freeOver = Number(delivery.freeAbove);
    const tabs = s["store.productTabs"];
    out.productTabs = tabs && typeof tabs === "object" ? tabs : null;
  } catch {
    // keep the design values
  }
  try {
    const rows = await apiFetch<{ name: string; deliveryMinDays: number; deliveryMaxDays: number; active: boolean }[]>(`/api/cities`, {
      next: { revalidate: REVALIDATE, tags: ["settings"] },
    });
    out.cities = Object.fromEntries(
      rows.filter((c) => c.active !== false).map((c) => [c.name.trim().toLowerCase(), [c.deliveryMinDays, c.deliveryMaxDays] as [number, number]]),
    );
  } catch {
    // the 2–7 working-day fallback stays
  }
  return out;
}

/**
 * Just the store settings, for pages that print the phone, email, hours or delivery amounts but no products.
 * Server pages render alongside the layout, so each such page applies the settings itself.
 */
export async function loadSettings() {
  const settings = await loadStoreSettings();
  applyStoreSettings(settings);
  return settings;
}

/**
 * What every storefront page needs from the backend: the store settings (phone, delivery amounts, cities).
 * Products are no longer loaded here: each page loads only the products it shows (loadCards, loadProduct).
 */
export async function loadStore() {
  const settings = await loadStoreSettings();
  applyStoreSettings(settings);
  return { settings };
}

export type SeoIndex = {
  /** Published products that are not noindex. `images`: absolute URLs, main image first, at most 10. */
  products: { slug: string; title: string; updatedAt: string; category: string | null; images: string[] }[];
  /** Every backend category, with its number of published products. */
  categories: { slug: string; name: string; updatedAt: string; imageUrl: string | null; publishedProducts: number }[];
};

/**
 * What search engines may list (GET /api/seo/sitemap). Throws when the backend fails: a sitemap must
 * never be published empty because of an outage (that tells Google every product is gone).
 */
export async function loadSeoIndex(): Promise<SeoIndex> {
  // `v=2`: the response shape this storefront expects. A new key also means a cached answer from an older
  // backend is never reused (the backend ignores the parameter).
  const path = `/api/seo/sitemap?v=2`;
  const index = await apiFetch<SeoIndex>(path, { next: { revalidate: 3600, tags: ["seo", "products", "categories"] } });
  if (isSeoIndex(index)) return index;
  // Wrong shape (e.g. an older backend still live during a deploy): ask once more, uncached, then give up
  // so the sitemap answers 503 instead of publishing wrong data.
  const fresh = await apiFetch<SeoIndex>(path, { cache: "no-store" });
  if (isSeoIndex(fresh)) return fresh;
  throw new Error("SEO_INDEX_SHAPE");
}

/** The backend's categories (GET /api/categories), as design category ids. */
export async function loadCategoryIds(): Promise<Set<string>> {
  try {
    const rows = await apiFetch<{ slug: string }[]>(`/api/categories`, { next: { revalidate: REVALIDATE, tags: ["categories"] } });
    return new Set(rows.map((c) => designCategoryId(c.slug)));
  } catch {
    return new Set();
  }
}

/**
 * A policy page: the file version, unless an old Page row still exists for it (GET /api/pages/{slug},
 * cached with the `pages` tag). After 03-drop-cms-pages.sql the backend answers 404 and the file version shows.
 */
export async function loadPolicy(fallback: PolicyDocument): Promise<PolicyDocument> {
  try {
    const page = await apiFetch<PageRow>(`/api/pages/${encodeURIComponent(fallback.slug)}`, {
      next: { revalidate: 600, tags: ["pages", `page:${fallback.slug}`] },
    });
    return pageToPolicy(fallback.slug, page, fallback) || fallback;
  } catch {
    return fallback;
  }
}
