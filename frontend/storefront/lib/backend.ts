import "server-only";
import { apiFetch } from "@/lib/api";
import type { Product as ApiProduct, ProductListResponse, Variant as ApiVariant } from "@/types/product";
import { designCategoryId, setCatalog, upsertProducts, type Product, type Variant } from "./catalog";
import { applyStoreSettings, type StoreSettings } from "./settings";

/**
 * The storefront's only door to the backend catalog (server side).
 * Every backend product is turned into the design's `Product` shape by `toDesignProduct()`,
 * so the design's components and helpers do not change.
 */

const REVALIDATE = 300;
const NEW_FOR_DAYS = 30;
const PAGE_SIZE = 100; // the backend caps one page at 100
const MAX_PAGES = 20;
const NEWEST_COUNT = 24;

const COLOURS: Record<string, string> = {
  black: "#1f2328", white: "#ffffff", cream: "#efe6d6", beige: "#d9bfa3", nude: "#d9bfa3", ivory: "#fffff0",
  grey: "#a6adb4", gray: "#a6adb4", silver: "#c0c4c8", gold: "#d4a017", "rose gold": "#d7a99a", champagne: "#e5d3b5",
  red: "#c0392b", maroon: "#7f1d1d", burgundy: "#800020", pink: "#eab5bd", blush: "#e8b4b2", rose: "#e4a9a6",
  purple: "#7c3aed", lavender: "#c4b5fd", blue: "#2563eb", navy: "#1e3a8a", sky: "#7dd3fc", teal: "#0d9488",
  green: "#16a34a", sage: "#9caf98", olive: "#6b8e23", mint: "#98f5d0", yellow: "#facc15", orange: "#f97316",
  brown: "#8b5a2b", tan: "#d2b48c", charcoal: "#3a3f45",
};

function swatchFor(name: string) {
  const key = name.trim().toLowerCase();
  if (COLOURS[key]) return COLOURS[key];
  const hit = Object.keys(COLOURS).find((c) => key.includes(c));
  return hit ? COLOURS[hit] : "#d5dde5";
}

const stripHtml = (html?: string | null) =>
  String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

/** Bullet points written as a list in the short description become the design's tick list. */
function listItems(html?: string | null) {
  return [...String(html || "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripHtml(m[1])).filter(Boolean);
}

function firstParagraph(html?: string | null) {
  const withoutList = String(html || "").replace(/<(ul|ol)[\s\S]*?<\/\1>/gi, "");
  return stripHtml(withoutList).split("\n")[0] || "";
}

function variantBuyable(v: ApiVariant) {
  const status = v.stockStatus ?? (v.attributes?.stockStatus as string | undefined);
  if (status === "outofstock") return false;
  return status === "instock" || (v.stock ?? 0) > 0 || !v.trackStock;
}

const HIDDEN_KEYS = new Set(["stockstatus", "gallery", "gtin", "downloadable", "virtual", "images", "weight", "length", "width", "height"]);

/** The design shows one option row; the first visible attribute of the variations drives it. */
function designVariants(p: ApiProduct): Product["variants"] {
  const variants = (p.variants || []).filter((v) => v.active !== false && v.enabled !== false);
  if (!variants.length) return undefined;
  const label =
    Object.keys(variants[0].attributes || {}).find((k) => !HIDDEN_KEYS.has(k.toLowerCase())) || "Option";
  const isSize = /size/i.test(label);
  const options: Variant[] = variants.map((v) => {
    const name = String(v.attributes?.[label] || v.name || "").trim() || v.sku;
    const price = v.pricing?.price ?? (v.priceOverride != null ? Number(v.priceOverride) : undefined);
    return {
      name,
      id: v.id,
      sku: v.sku,
      ...(isSize ? {} : { swatch: swatchFor(name) }),
      ...(v.imageUrl ? { imageUrl: v.imageUrl } : {}),
      ...(variantBuyable(v) ? {} : { soldOut: true }),
      ...(price != null && Number(price) !== Number(p.price) ? { price: Number(price) } : {}),
    };
  });
  return { label, kind: isSize ? "size" : "colour", options };
}

type DesignBadge = NonNullable<Product["badge"]>;
const BADGES: DesignBadge[] = ["Bestseller", "New in", "Popular", "Gift pick", "Limited"];

export function toDesignProduct(p: ApiProduct, defaultBundlePercent = 5): Product {
  const backendSlug = p.categories?.[0]?.slug || p.categorySlugs?.[0];
  const createdAt = p.createdAt ? Date.parse(p.createdAt) : 0;
  const isNew = !!createdAt && Date.now() - createdAt < NEW_FOR_DAYS * 86400000;
  const orderCount = Number((p as ApiProduct & { orderCount?: number }).orderCount || 0);
  const isBestseller = orderCount > 0 || !!p.featured;
  const named = (p.badges || []).map((b) => BADGES.find((x) => x.toLowerCase() === String(b).toLowerCase())).find(Boolean);
  const image = p.image || p.images?.[0]?.src || "/brand/zelvomart-logo.png";
  const highlights = listItems(p.shortDescription);
  const regular = Number(p.regularPrice || p.price);
  const bundlePercent = Number(p.buyTwoDiscountPercent ?? p.bundleDiscountPercent ?? defaultBundlePercent);
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    category: designCategoryId(backendSlug),
    price: Number(p.price),
    ...(p.onSale && regular > Number(p.price) ? { compare: regular } : {}),
    image,
    ...(named ? { badge: named } : isBestseller ? { badge: "Bestseller" as const } : isNew ? { badge: "New in" as const } : {}),
    isNew,
    isBestseller,
    tagline: firstParagraph(p.shortDescription) || stripHtml(p.description).split("\n")[0] || "",
    description: stripHtml((p as ApiProduct & { descriptionHtml?: string | null }).descriptionHtml || p.description),
    highlights,
    idealFor: [],
    specs: [],
    inBox: [],
    variants: designVariants(p),
    ...(p.bundleEnabled && bundlePercent > 0 ? { bundleEnabled: true, bundleDiscountPercent: bundlePercent } : {}),
    keywords: p.tags || [],
    inStock: p.stockStatus !== "outofstock",
    rating: Number(p.averageRating || 0),
    ...(p.reviews?.length
      ? {
          reviews: p.reviews.map((r) => ({
            id: r.id,
            productId: p.id,
            name: r.name,
            rating: Number(r.rating),
            text: r.body,
            createdAt: r.createdAt,
            verified: r.verified,
            media: (((r as unknown as { images?: unknown[] }).images || []) as unknown[])
              .map((u) => String(u))
              .filter(Boolean)
              .map((url) => ({ type: /\.(mp4|webm|mov)(\?|$)/i.test(url) ? ("video" as const) : ("image" as const), url })),
          })),
        }
      : {}),
    reviewCount: Number(p.reviewCount || 0),
    ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}),
    ...(p.seoDescription ? { seoDescription: p.seoDescription } : {}),
  };
}

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
 * Everything a storefront page needs from the backend: the catalog and the store settings.
 * Server pages await this first, so the design's helpers (getProduct, products, site…) read real data.
 */
export async function loadStore() {
  const [catalog, settings] = await Promise.all([loadCatalog(), loadStoreSettings()]);
  applyStoreSettings(settings);
  return { catalog, settings };
}
