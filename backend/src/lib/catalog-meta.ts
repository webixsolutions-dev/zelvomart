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

export function writeCatalogMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return null;
  const next: Record<string, any> = { ...(meta as Record<string, any>) };
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
