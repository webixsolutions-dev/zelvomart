import { SITE_ORIGIN } from "../lib/site-url";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import express from "express";
import multer from "multer";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db";
import { type AuthedRequest } from "../lib/auth";
import { getSetting } from "../lib/settings";
import { invalidateFrontendCache } from "../lib/cache-invalidation";
import { cleanCatalogMeta, sanitizeProductTabOverrides } from "../lib/catalog-meta";
import { productBadges } from "../lib/product-badges";
import { parseVideoUrl, VIDEO_URL_ERROR } from "../lib/product-video";
import { cleanStockStatus, itemStockStatus, productStockStatus, trackedQuantity } from "../lib/stock";
import { BUY_TWO_DISCOUNT_PERCENT, priceSummary, variantPriceSummary } from "../lib/pricing";
import { consumeRateLimit, consumeRateLimits, requestIp } from "../lib/rate-limit";
import type { LimitRule } from "../lib/store-limits";

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

export function routeParam(req: express.Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

export function setPublicCache(res: express.Response, ttlSeconds: number, staleSeconds: number, tags: string[] = []) {
  const value = `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${staleSeconds}, stale-if-error=86400`;
  res.setHeader("Cache-Control", value);
  res.setHeader(
    "CDN-Cache-Control",
    `public, max-age=${ttlSeconds}, stale-while-revalidate=${staleSeconds}, stale-if-error=86400`,
  );
  res.setHeader(
    "Vercel-CDN-Cache-Control",
    `public, max-age=${ttlSeconds}, stale-while-revalidate=${staleSeconds}, stale-if-error=86400`,
  );
  if (tags.length) res.setHeader("Vercel-Cache-Tag", [...new Set(tags)].join(","));
}

export function setNoStore(res: express.Response) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

export function readCatalogMeta(sourceUrl: unknown) {
  if (typeof sourceUrl !== "string" || !sourceUrl.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(sourceUrl);
    if (parsed && typeof parsed === "object" && parsed.zvmCatalog && typeof parsed.zvmCatalog === "object")
      return parsed.zvmCatalog;
  } catch {
    return null;
  }
  return null;
}

export function normalizeRedirectDestination(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw || /^(javascript|data|vbscript):/i.test(raw)) return "";
  try {
    const site = new URL(`${SITE_ORIGIN.replace(/\/$/, "")}/`);
    const url = raw.startsWith("/") ? new URL(raw, site) : new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const hosts = new Set([
      site.hostname,
      site.hostname.replace(/^www\./, ""),
      `www.${site.hostname.replace(/^www\./, "")}`,
      "localhost",
      "127.0.0.1",
    ]);
    if (hosts.has(url.hostname)) {
      let path = url.pathname || "/";
      const last = path.split("/").pop() || "";
      if (!path.endsWith("/") && !last.includes(".")) path += "/";
      return `${path}${url.search}${url.hash}`;
    }
    return url.href;
  } catch {
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "";
  }
}

export function writeCatalogMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return null;
  const next = cleanCatalogMeta(meta as Record<string, any>);
  if (next.productTabs && typeof next.productTabs === "object") {
    next.productTabs = sanitizeProductTabOverrides(next.productTabs);
  }
  next.redirectUrl = normalizeRedirectDestination(next.redirectUrl);
  if (!next.redirectUrl) delete next.redirectUrl;
  return JSON.stringify({ zvmCatalog: next });
}

/** Vimeo has no fixed thumbnail URL; its public oEmbed API returns one. Best effort. */
export async function vimeoThumbnail(url: string) {
  try {
    const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=640`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return "";
    const body: any = await response.json();
    return typeof body?.thumbnail_url === "string" ? body.thumbnail_url : "";
  } catch {
    return "";
  }
}

/**
 * Product video: a YouTube or Vimeo link only (no uploads). Rejects other links, stores the
 * normalised link, and keeps the date the link was added (schema uploadDate) plus its thumbnail.
 */
export async function resolveProductVideo(input: unknown, previousMeta: any, previousUrl: string | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return { videoUrl: null as string | null, meta: { videoAddedAt: "", videoThumbnail: "" } };
  const video = parseVideoUrl(raw);
  if (!video) throw new Error(VIDEO_URL_ERROR);
  const unchanged = previousUrl && parseVideoUrl(previousUrl)?.url === video.url;
  const addedAt =
    unchanged && previousMeta?.videoAddedAt ? String(previousMeta.videoAddedAt) : new Date().toISOString();
  let thumbnail = video.thumbnailUrl || (unchanged ? String(previousMeta?.videoThumbnail || "") : "");
  if (!thumbnail && video.provider === "vimeo") thumbnail = await vimeoThumbnail(video.url);
  return { videoUrl: video.url, meta: { videoAddedAt: addedAt, videoThumbnail: thumbnail } };
}

export type CustomRedirect = { source: string; destination: string };

/** "Old URL" field: a path on this site (full URLs of this site are reduced to their path). */
export function normalizeRedirectSource(value: unknown) {
  const normalized = normalizeRedirectDestination(value);
  if (!normalized) return "";
  if (!normalized.startsWith("/")) throw new Error("REDIRECT_OLD_URL_MUST_BE_ON_THIS_SITE");
  let path = normalized.replace(/[?#].*$/, "") || "/";
  const last = path.split("/").pop() || "";
  if (!path.endsWith("/") && !last.includes(".")) path += "/";
  return path;
}

/**
 * The product's redirect: Old URL (defaults to the product's own URL, can be any old path such as
 * a WordPress URL) -> Destination URL as a 301. Throws when the destination equals the old URL.
 */
export function customRedirect(meta: any, slug: string): CustomRedirect | null {
  const destination = normalizeRedirectDestination(meta?.redirectUrl);
  if (!destination) return null;
  const source = normalizeRedirectSource(meta?.redirectFrom) || `/product/${slug}/`;
  if (destination.replace(/[?#].*$/, "") === source) throw new Error("REDIRECT_DESTINATION_SAME_AS_OLD_URL");
  return { source, destination };
}

export function previousCustomRedirect(meta: any, slug: string): CustomRedirect | null {
  try {
    return customRedirect(meta, slug);
  } catch {
    return null;
  }
}

export async function syncProductRedirect(options: {
  slug: string;
  previousSlug?: string;
  status: string;
  redirectFallback: boolean;
  custom: CustomRedirect | null;
  previousCustom?: CustomRedirect | null;
}) {
  const shop = "/shop";
  const current = `/product/${options.slug}/`;
  const { custom, previousCustom } = options;
  // Drop the row this product wrote last time when its old URL changed or the redirect was cleared.
  if (previousCustom && previousCustom.source !== custom?.source) {
    await prisma.redirect.deleteMany({
      where: { sourcePath: previousCustom.source, destination: previousCustom.destination },
    });
  }
  // Saved into the same Redirect table Admin -> SEO Redirects uses.
  if (custom) {
    await prisma.redirect.upsert({
      where: { sourcePath: custom.source },
      update: { destination: custom.destination, permanent: true },
      create: { sourcePath: custom.source, destination: custom.destination, permanent: true },
    });
  }
  const ownUrlRedirect = custom && custom.source === current ? custom.destination : "";
  if (options.previousSlug && options.previousSlug !== options.slug) {
    const from = `/product/${options.previousSlug}/`;
    const destination = ownUrlRedirect || (options.status === "PUBLISHED" ? current : shop);
    await prisma.redirect.upsert({
      where: { sourcePath: from },
      update: { destination, permanent: true },
      create: { sourcePath: from, destination, permanent: true },
    });
  }
  if (ownUrlRedirect) {
    // The product's own URL already points at the destination (written above).
  } else if (options.status === "PUBLISHED" || !options.redirectFallback) {
    await prisma.redirect.deleteMany({ where: { sourcePath: current } });
  } else {
    await prisma.redirect.upsert({
      where: { sourcePath: current },
      update: { destination: shop, permanent: false },
      create: { sourcePath: current, destination: shop, permanent: false },
    });
  }
  await invalidateFrontendCache(["redirects"]);
}

export function jsonProduct(row: any, bundleDiscount = BUY_TWO_DISCOUNT_PERCENT) {
  const pricing = priceSummary(row.price, row.salePrice);
  const images = Array.isArray(row.images) ? row.images.filter((x: unknown) => typeof x === "string") : [];
  const catalog = readCatalogMeta(row.sourceUrl) || {};
  const imageAlt = String(catalog.imageMeta?.alt || row.title || "");
  const imageTitle = String(catalog.imageMeta?.title || "").trim() || null;
  const reviews = (row.reviews || [])
    .filter((r: any) => r.status === "APPROVED" && !r.deletedAt && r.origin !== "TEST")
    .map((review: any) => ({
      id: review.id,
      name: review.name,
      rating: review.rating,
      body: review.body,
      verified: review.verified,
      avatarUrl: review.avatarUrl,
      media: review.media || [],
      images: review.images,
      createdAt: (review.reviewDate || review.createdAt)?.toISOString?.() || review.createdAt,
    }));
  const averageRating = reviews.length
    ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length
    : undefined;
  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    title: row.title,
    sku: row.sku,
    orderCount: row._count?.orderItems || 0,
    categories: row.category
      ? [
          {
            id: row.category.id,
            name: row.category.name,
            slug: row.category.slug,
            description: row.category.description,
            image: row.category.imageUrl,
          },
        ]
      : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    category: row.category || null,
    ...pricing,
    salePrice: row.salePrice == null ? null : Number(row.salePrice),
    // stockStatus = can it be bought (lib/stock.ts); stockSetting = what the admin picked for Track OFF.
    stockStatus: productStockStatus(row),
    trackStock: Boolean(row.trackStock),
    stockSetting: cleanStockStatus(row.stockStatus),
    stockQuantity: trackedQuantity(row),
    stock: row.stock,
    featured: row.featured,
    averageRating,
    reviewCount: reviews.length,
    image: images[0],
    images: images.map((src: string, index: number) => ({
      src,
      alt: imageAlt,
      ...(index === 0 && imageTitle ? { title: imageTitle } : {}),
    })),
    rawImages: images,
    imageAlt,
    imageTitle,
    tags: Array.isArray(catalog.tags) ? catalog.tags : [],
    badges: productBadges(catalog, pricing),
    freeShipping: Boolean(catalog.freeShipping),
    buyTwoDiscountPercent: bundleDiscount,
    shortDescription: row.shortDescription,
    description: row.descriptionHtml,
    descriptionHtml: row.descriptionHtml,
    videoUrl: row.videoUrl,
    videoThumbnail: catalog.videoThumbnail || null,
    videoAddedAt: catalog.videoAddedAt || null,
    permalink: `/product/${row.slug}/`,
    hasOptions: (row.variants || []).length > 0,
    variants: (row.variants || []).map((v: any) => {
      const extras = Array.isArray(catalog.variations)
        ? catalog.variations.find(
            (item: any) => (item.sku && item.sku === v.sku) || (item.name && item.name === v.name),
          ) || {}
        : {};
      const images = Array.isArray(extras.images)
        ? extras.images.filter((src: unknown) => typeof src === "string" && src)
        : [];
      return {
        ...v,
        priceOverride: v.priceOverride == null ? null : Number(v.priceOverride),
        regularPrice: extras.regularPrice != null ? Number(extras.regularPrice) : null,
        salePrice: extras.salePrice != null ? Number(extras.salePrice) : null,
        pricing: variantPriceSummary(pricing, { priceOverride: v.priceOverride, regularPrice: extras.regularPrice }),
        images: images.length ? images : v.imageUrl ? [v.imageUrl] : [],
        gtin: extras.gtin || v.attributes?.gtin || "",
        weight: extras.weight || "",
        length: extras.length || "",
        width: extras.width || "",
        height: extras.height || "",
        trackStock: Boolean(v.trackStock),
        stockStatus: itemStockStatus(v),
        stockSetting: cleanStockStatus(v.stockStatus),
      };
    }),
    bundleEnabled: row.bundleEnabled,
    bundleDiscountPercent: bundleDiscount,
    reviews,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    catalogMeta: readCatalogMeta(row.sourceUrl),
    costPrice: row.costPrice == null ? null : Number(row.costPrice),
    status: row.status,
    categoryId: row.categoryId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const productInclude = {
  category: true,
  variants: { where: { active: true }, orderBy: { createdAt: "asc" as const } },
  reviews: {
    where: { status: "APPROVED" as const, deletedAt: null, origin: { not: "TEST" } },
    include: { media: true },
    orderBy: { createdAt: "desc" as const },
  },
};

export const productListSelect = {
  id: true,
  slug: true,
  title: true,
  sku: true,
  images: true,
  price: true,
  salePrice: true,
  stock: true,
  trackStock: true,
  stockStatus: true,
  featured: true,
  sourceUrl: true,
  shortDescription: true,
  bundleEnabled: true,
  bundleDiscountPercent: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      seoTitle: true,
      seoDescription: true,
    },
  },
  variants: {
    where: { active: true },
    select: {
      id: true,
      sku: true,
      name: true,
      stock: true,
      trackStock: true,
      stockStatus: true,
      active: true,
      priceOverride: true,
      imageUrl: true,
      attributes: true,
    },
  },
  reviews: {
    where: { status: "APPROVED" as const, deletedAt: null, origin: { not: "TEST" } },
    select: { rating: true },
  },
} satisfies Prisma.ProductSelect;

export function jsonProductSummary(row: any, bundleDiscount = BUY_TWO_DISCOUNT_PERCENT) {
  const pricing = priceSummary(row.price, row.salePrice);
  const images = Array.isArray(row.images) ? row.images.filter((x: unknown) => typeof x === "string") : [];
  const catalog = readCatalogMeta(row.sourceUrl) || {};
  const reviewCount = Array.isArray(row.reviews) ? row.reviews.length : 0;
  const averageRating = reviewCount
    ? row.reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviewCount
    : undefined;
  const hasOptions = Array.isArray(row.variants) && row.variants.length > 0;
  const imageAlt = String(catalog.imageMeta?.alt || row.title || "");
  const imageTitle = String(catalog.imageMeta?.title || "").trim() || null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    title: row.title,
    sku: row.sku,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orderCount: row._count?.orderItems || 0,
    categories: row.category
      ? [
          {
            id: row.category.id,
            name: row.category.name,
            slug: row.category.slug,
            description: row.category.description,
            image: row.category.imageUrl,
          },
        ]
      : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    ...pricing,
    salePrice: row.salePrice == null ? null : Number(row.salePrice),
    stockStatus: productStockStatus(row),
    trackStock: Boolean(row.trackStock),
    stockQuantity: trackedQuantity(row),
    featured: row.featured,
    averageRating,
    reviewCount,
    image: images[0],
    images: images[0] ? [{ src: images[0], alt: imageAlt, ...(imageTitle ? { title: imageTitle } : {}) }] : [],
    imageAlt,
    imageTitle,
    tags: Array.isArray(catalog.tags) ? catalog.tags : [],
    badges: productBadges(catalog, pricing),
    freeShipping: Boolean(catalog.freeShipping),
    buyTwoDiscountPercent: bundleDiscount,
    shortDescription: row.shortDescription,
    description: null,
    videoUrl: null,
    permalink: `/product/${row.slug}/`,
    hasOptions,
    variants: (row.variants || []).map((variant: any) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      attributes: variant.attributes || {},
      priceOverride: variant.priceOverride == null ? null : Number(variant.priceOverride),
      pricing: variantPriceSummary(pricing, {
        priceOverride: variant.priceOverride,
        regularPrice: Array.isArray(catalog.variations)
          ? catalog.variations.find(
              (item: any) => (item.sku && item.sku === variant.sku) || (item.name && item.name === variant.name),
            )?.regularPrice
          : null,
      }),
      stock: Number(variant.stock || 0),
      trackStock: Boolean(variant.trackStock),
      stockStatus: itemStockStatus(variant),
      imageUrl: variant.imageUrl || null,
      images: variant.imageUrl ? [variant.imageUrl] : [],
      active: true,
    })),
    bundleEnabled: row.bundleEnabled,
    bundleDiscountPercent: bundleDiscount,
    reviews: [],
  };
}

export async function audit(req: AuthedRequest, action: string, entity: string, entityId?: string, details?: unknown) {
  await prisma.auditLog.create({
    data: { userId: req.admin?.id, action, entity, entityId, details: (details || {}) as any },
  });
}

export function isSensitiveSettingKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("token") || normalized.includes("secret") || normalized.includes("password");
}

export function normalizeTrafficSource(value: unknown) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw || raw === "direct" || raw === "(direct)") return "direct";
  if (["fb", "facebook", "facebook.com", "m.facebook.com", "l.facebook.com"].includes(raw) || raw.includes("facebook"))
    return "facebook";
  if (["ig", "instagram", "instagram.com", "l.instagram.com"].includes(raw) || raw.includes("instagram"))
    return "instagram";
  if (raw.includes("google")) return "google";
  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("youtube")) return "youtube";
  return raw;
}

export const storeDb = prisma as any;
export const STORE_SESSION_DAYS = Math.max(1, Math.min(90, Number(process.env.STORE_SESSION_DAYS || 30)));

export function storeTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function bearerToken(req: express.Request) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function createStoreSession(req: express.Request, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + STORE_SESSION_DAYS * 24 * 60 * 60 * 1000);
  await storeDb.storeSession.create({
    data: {
      userId,
      tokenHash: storeTokenHash(token),
      expiresAt,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
    },
  });
  return { token, expiresAt };
}

export async function findStoreSession(req: express.Request) {
  const token = bearerToken(req);
  if (!token) return null;
  const tokenHash = storeTokenHash(token);
  const session = await storeDb.storeSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session || !session.user.active || session.expiresAt.getTime() <= Date.now()) {
    if (session) await storeDb.storeSession.deleteMany({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  void storeDb.storeSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
  return session;
}

export function publicStoreUser(user: { id: string; name: string; email: string; createdAt: Date }) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

export async function allowRequest(
  req: express.Request,
  res: express.Response,
  namespace: string,
  limit: number,
  windowMs: number,
  discriminator = "",
) {
  return allowRules(res, [{ key: `${namespace}:${requestIp(req)}:${discriminator}`, limit, windowMs }]);
}

/** Consume one or two limits with ready-made bucket keys (see lib/store-limits.ts); answers 429 when one is spent. */
export async function allowRules(res: express.Response, rules: [LimitRule] | [LimitRule, LimitRule]) {
  const results =
    rules.length === 2
      ? await consumeRateLimits(rules)
      : [await consumeRateLimit(rules[0].key, rules[0].limit, rules[0].windowMs)];
  res.setHeader("X-RateLimit-Limit", String(Math.min(...rules.map((rule) => rule.limit))));
  res.setHeader("X-RateLimit-Remaining", String(Math.min(...results.map((result) => result.remaining))));
  const denied = results.find((result) => !result.allowed);
  if (denied) {
    res.setHeader("Retry-After", String(denied.retryAfterSeconds));
    res.status(429).json({ error: "RATE_LIMITED", retryAfterSeconds: denied.retryAfterSeconds });
    return false;
  }
  return true;
}

export async function catalogCacheTags(slug: string, categoryId?: string | null) {
  const tags = ["products", "featured-products", "categories", "store", "redirects", `product:${slug}`];
  if (!categoryId) return tags;
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { slug: true } });
  if (category?.slug) tags.push(`category:${category.slug}`);
  return tags;
}

export async function loadAdminProduct(id: string) {
  const row = await prisma.product.findUnique({
    where: { id },
    include: { category: true, variants: true, reviews: true },
  });
  return row ? jsonProduct(row, Number(await getSetting("store.bundleDefaultDiscountPercent", 5))) : null;
}

// The database is far from the server (Supabase ap-southeast-2), so opening a connection can take
// longer than Prisma's 2s default wait for an interactive transaction ("Unable to start a
// transaction in the given time"). Give product writes room to start and finish.
export const PRODUCT_TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

/**
 * Updates variations by SKU instead of deleting and recreating them, so variant IDs stay the
 * same (carts keep working) and live stock is only written when the caller sends `stock`
 * (the admin changed that quantity). Variations no longer sent are deactivated.
 */
export async function writeVariants(tx: Prisma.TransactionClient, productId: string, variants: any[]) {
  const existing = await tx.variant.findMany({ where: { productId }, select: { id: true, sku: true } });
  const bySku = new Map(existing.map((row) => [row.sku, row]));
  const used = new Set<string>();
  for (const variant of variants) {
    const sku = String(variant?.sku || "").trim();
    const name = String(variant?.name || "").trim();
    if (!sku || !name || used.has(sku)) continue;
    used.add(sku);
    const fields = {
      name,
      attributes: variant.attributes || {},
      priceOverride: variant.priceOverride ? new Prisma.Decimal(Number(variant.priceOverride)) : null,
      imageUrl: variant.imageUrl || null,
      active: variant.active !== false,
      // Stock settings are only changed when sent (the CSV import does not send them).
      ...("trackStock" in variant ? { trackStock: Boolean(variant.trackStock) } : {}),
      ...("stockStatus" in variant ? { stockStatus: cleanStockStatus(variant.stockStatus) } : {}),
    };
    const hasStock = variant.stock !== undefined && variant.stock !== null && variant.stock !== "";
    const stock = Math.max(0, Math.floor(Number(variant.stock) || 0));
    const row = bySku.get(sku);
    if (row) await tx.variant.update({ where: { id: row.id }, data: { ...fields, ...(hasStock ? { stock } : {}) } });
    else await tx.variant.create({ data: { productId, sku, ...fields, stock: hasStock ? stock : 0 } });
  }
  const gone = existing.filter((row) => !used.has(row.sku)).map((row) => row.id);
  if (gone.length) await tx.variant.updateMany({ where: { id: { in: gone } }, data: { active: false } });
}

export const META_EVENT_NAMES = new Set([
  "PageView",
  "ViewContent",
  "Search",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
  "Contact",
  "Lead",
]);

export let replayCleanupAt = 0;
export async function maybeCleanupOldSessionReplays() {
  const settingDays = await getSetting<number | string | null>("tracking.sessionReplayRetentionDays", null).catch(
    () => null,
  );
  const parsedSettingDays = settingDays !== null && settingDays !== undefined ? Number(settingDays) : NaN;
  const days =
    Number.isFinite(parsedSettingDays) && parsedSettingDays > 0
      ? parsedSettingDays
      : Number(process.env.SESSION_REPLAY_RETENTION_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) return;
  const now = Date.now();
  if (now - replayCleanupAt < 6 * 60 * 60 * 1000) return;
  replayCleanupAt = now;
  const cutoff = new Date(now - days * 86400000);
  await prisma.sessionReplay.deleteMany({ where: { startedAt: { lt: cutoff } } }).catch(() => undefined);
}
