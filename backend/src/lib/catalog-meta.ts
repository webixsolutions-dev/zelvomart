import { cleanHtml } from "./sanitize";

const TAB_KEYS = ["whyChoose", "shippingProcess", "generalFaq"] as const;

export function readCatalogMeta(sourceUrl: unknown): Record<string, any> | null {
  if (typeof sourceUrl !== "string" || !sourceUrl.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(sourceUrl);
    if (parsed && typeof parsed === "object" && parsed.zvmCatalog && typeof parsed.zvmCatalog === "object") {
      return parsed.zvmCatalog as Record<string, any>;
    }
  } catch {
    return null;
  }
  return null;
}

export function productHasFreeShipping(sourceUrl: unknown) {
  return Boolean(readCatalogMeta(sourceUrl)?.freeShipping);
}

// Fields the product form used to save that nothing reads (orders, shop, feed, schema).
// trackStock / stockStatus / quantity now live in real Product and Variant columns (lib/stock.ts);
// shippingClass became the freeShipping flag; the Social SEO tab was removed.
const DROPPED_META_KEYS = [
  "virtual",
  "downloadable",
  "taxStatus",
  "taxClass",
  "purchaseNote",
  "menuOrder",
  "brand",
  "trackStock",
  "stockStatus",
  "shippingClass",
  "socialTitle",
  "socialDescription",
];
const DROPPED_VARIATION_KEYS = ["virtual", "downloadable", "trackStock", "stockStatus", "quantity", "shippingClass"];
const DROPPED_IMAGE_META_KEYS = ["caption", "description", "excludeFromSitemap"];

/** Removes the retired product fields before the meta is stored. */
export function cleanCatalogMeta(meta: Record<string, any>) {
  const next: Record<string, any> = { ...meta };
  for (const key of DROPPED_META_KEYS) delete next[key];
  if (next.imageMeta && typeof next.imageMeta === "object") {
    const imageMeta = { ...next.imageMeta };
    for (const key of DROPPED_IMAGE_META_KEYS) delete imageMeta[key];
    next.imageMeta = imageMeta;
  }
  if (Array.isArray(next.variations)) {
    next.variations = next.variations.map((variation: unknown) => {
      if (!variation || typeof variation !== "object") return variation;
      const item: Record<string, any> = { ...(variation as Record<string, any>) };
      for (const key of DROPPED_VARIATION_KEYS) delete item[key];
      return item;
    });
  }
  return next;
}

export function writeCatalogMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return null;
  const next = cleanCatalogMeta(meta as Record<string, any>);
  next.freeShipping = Boolean(next.freeShipping);
  if (next.productTabs && typeof next.productTabs === "object") {
    next.productTabs = sanitizeProductTabOverrides(next.productTabs);
  }
  return JSON.stringify({ zvmCatalog: next });
}

export function sanitizeProductTabOverrides(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, any>) : {};
  const tabs: Record<string, { override: boolean; content: string }> = {};
  for (const key of TAB_KEYS) {
    const tab = source[key];
    if (!tab || typeof tab !== "object") continue;
    tabs[key] = {
      override: Boolean(tab.override),
      content: typeof tab.content === "string" ? cleanHtml(tab.content) : "",
    };
  }
  return tabs;
}

export function sanitizeGlobalProductTabs(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, any>) : {};
  const tabs: Record<string, { title: string; content: string }> = {};
  for (const key of TAB_KEYS) {
    const tab = source[key];
    if (!tab || typeof tab !== "object") continue;
    tabs[key] = {
      title: String(tab.title || "").slice(0, 120),
      content: typeof tab.content === "string" ? cleanHtml(tab.content) : "",
    };
  }
  return tabs;
}
