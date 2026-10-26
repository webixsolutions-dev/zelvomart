import type { Product as ApiProduct, Variant as ApiVariant } from "@/types/product";
import { designCategoryId, type Product, type Variant } from "./catalog";

/**
 * One mapping from a backend product to the design's `Product` shape, used by the server
 * adapter (`backend.ts`) and the admin's product preview, so the design's components do not change.
 */

const NEW_FOR_DAYS = 30;

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
  if (!variants.length) {
    const visibleAttributes = (p.catalogMeta?.attributes || []).filter(
      (attribute) => attribute.visible !== false && attribute.name?.trim() && attribute.valuesText?.trim(),
    );
    const visibleAttribute =
      visibleAttributes.find((attribute) => /colou?r/i.test(attribute.name || "")) || visibleAttributes[0];
    if (!visibleAttribute) return undefined;
    const options = visibleAttribute.valuesText!.split("|").map((value) => value.trim()).filter(Boolean);
    const isSize = /size/i.test(visibleAttribute.name!);
    return options.length
      ? {
          label: visibleAttribute.name!.trim(),
          kind: isSize ? "size" : "colour",
          options: options.map((name) => ({ name, ...(!isSize ? { swatch: swatchFor(name) } : {}) })),
        }
      : undefined;
  }
  const attributeNames = Object.keys(variants[0].attributes || {});
  const label =
    attributeNames.find((name) => /colou?r/i.test(name)) ||
    attributeNames.find((name) => !HIDDEN_KEYS.has(name.toLowerCase())) ||
    "Option";
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
      ...(v.images?.length ? { images: v.images } : {}),
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
    gallery: (p.images || []).filter((item) => item?.src).map((item) => ({ src: item.src, alt: item.alt || p.name, ...(item.title ? { title: item.title } : {}) })),
    ...(named ? { badge: named } : isBestseller ? { badge: "Bestseller" as const } : isNew ? { badge: "New in" as const } : {}),
    isNew,
    isBestseller,
    tagline: firstParagraph(p.shortDescription) || stripHtml(p.description).split("\n")[0] || "",
    description: stripHtml((p as ApiProduct & { descriptionHtml?: string | null }).descriptionHtml || p.description),
    descriptionHtml: (p as ApiProduct & { descriptionHtml?: string | null }).descriptionHtml || p.description || "",
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
            avatarUrl: r.avatarUrl,
            media: r.media?.length ? r.media : (((r as unknown as { images?: unknown[] }).images || []) as unknown[])
              .map((u) => String(u))
              .filter(Boolean)
              .map((url) => ({ type: /\.(mp4|webm|mov)(\?|$)/i.test(url) ? ("video" as const) : ("image" as const), url })),
          })),
        }
      : {}),
    reviewCount: Number(p.reviewCount || 0),
    ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}),
    ...(p.seoDescription ? { seoDescription: p.seoDescription } : {}),
    ...(p.catalogMeta?.robotsIndex === "noindex" ? { noindex: true } : {}),
  };
}
