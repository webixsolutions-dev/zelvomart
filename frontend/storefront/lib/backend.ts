import "server-only";
import { apiFetch } from "@/lib/api";
import type { Product as ApiProduct, ProductListResponse } from "@/types/product";
import { designCategoryId, setCatalog, upsertProducts, type Product } from "./catalog";
import { toDesignProduct } from "./product-map";
import { applyStoreSettings, type StoreSettings } from "./settings";
import { pageToPolicy, type PageRow } from "./policies/html";
import type { PolicyDocument } from "./policies/types";

/**
 * The storefront's only door to the backend catalog (server side).
 * Every backend product is turned into the design's `Product` shape by `toDesignProduct()`
 * (`product-map.ts`), so the design's components and helpers do not change.
 */

export { toDesignProduct };

const REVALIDATE = 300;
const PAGE_SIZE = 100; // the backend caps one page at 100
const MAX_PAGES = 20;
const NEWEST_COUNT = 24;

/** Lighter copy for the list every page carries to the browser (the product page loads the full one). */
export function slimProduct(p: Product): Product {
  const { reviews: _reviews, ...rest } = p;
  return { ...rest, description: "", highlights: p.highlights.slice(0, 4), specs: [], idealFor: [], inBox: [] };
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

/** Every published product, newest first, in the design's shape. Also fills `products` on the server. */
export async function loadCatalog(): Promise<Product[]> {
  const pct = await bundleDefault();
  const items: ApiProduct[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await apiFetch<ProductListResponse>(`/api/products?limit=${PAGE_SIZE}&page=${page}&sort=newest`, {
        next: { revalidate: REVALIDATE, tags: ["products"] },
      });
      items.push(...(res.items || []));
      if (page >= (res.totalPages || 1)) break;
    }
  } catch {
    // Backend unreachable: the shop shows no products rather than invented ones.
  }
  // Bestsellers = the backend's own ranking (sort=popular); New Arrivals = the newest products.
  let popular: string[] = [];
  try {
    const res = await apiFetch<ProductListResponse>(`/api/products?limit=12&sort=popular`, {
      next: { revalidate: REVALIDATE, tags: ["products"] },
    });
    popular = (res.items || []).filter((p) => Number((p as ApiProduct & { orderCount?: number }).orderCount || 0) > 0).map((p) => p.id);
  } catch {
    popular = [];
  }
  const list = items.map((p, i) => {
    const d = toDesignProduct(p, pct);
    if (i < NEWEST_COUNT) d.isNew = true;
    if (popular.includes(p.id)) d.isBestseller = true;
    return d;
  });
  setCatalog(list);
  return list;
}

/** One product with everything its page shows. */
export async function loadProduct(slug: string): Promise<Product | null> {
  try {
    const [p, pct] = await Promise.all([
      apiFetch<ApiProduct>(`/api/products/slug/${encodeURIComponent(slug)}`, {
        next: { revalidate: 120, tags: ["products", `product:${slug}`] },
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

/** Phone, email, WhatsApp, delivery charge and per-city delivery days from Admin → Settings / Cities. */
export async function loadStoreSettings(): Promise<StoreSettings> {
  const out: StoreSettings = {};
  try {
    const s = await apiFetch<Record<string, any>>(`/api/settings/public?keys=store.info,store.delivery`, {
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
 * Everything a storefront page needs from the backend: the catalog and the store settings.
 * Server pages await this first, so the design's helpers (getProduct, products, site…) read real data.
 */
export async function loadStore() {
  const [catalog, settings] = await Promise.all([loadCatalog(), loadStoreSettings()]);
  applyStoreSettings(settings);
  return { catalog, settings };
}

export type SeoIndex = {
  products: { slug: string; updatedAt: string }[];
  categories: { slug: string; updatedAt: string }[];
};

/** What search engines may list: published, indexable products and categories (GET /api/seo/sitemap). */
export async function loadSeoIndex(): Promise<SeoIndex> {
  try {
    return await apiFetch<SeoIndex>(`/api/seo/sitemap`, { next: { revalidate: 3600, tags: ["seo", "products"] } });
  } catch {
    return { products: [], categories: [] };
  }
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
