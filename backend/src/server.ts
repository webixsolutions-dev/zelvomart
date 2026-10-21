import { reviewRouter, customerReviewUpload, storeReviewFiles } from './admin-reviews';
import {stageReviewUpload,hydrateReviewUploads,reviewChunkUpload,writeReviewChunk,completeReviewChunks} from './lib/review-staging';
import {validateSettingsUpdate,validateCitySettings} from './lib/settings-validation';
import {orderEditRouter,orderExtras} from './admin-order-edit';
import {registerRecovery} from './recovery';
import {overviewRouter} from './admin-overview';
import {couponRouter} from './admin-coupons';
import {validateCoupon} from './lib/coupons';
import {catalogQuery} from './lib/catalog-query';
import {publicSettingKeys} from './lib/public-settings';
import {SITE_ORIGIN,isStorefrontUrl} from './lib/site-url';
import {privateSafeUrl} from "./lib/url-privacy";
import {storeReplayChunk,replayChunkUrl,replayStorageConfigured,deleteReplayChunks,readReplayChunk} from "./lib/replay-storage";
import {catalogFeed} from "./lib/catalog-feed";
import {saveCatalogImage} from "./lib/catalog-images";
import {sendTikTokServerEvent} from "./lib/tiktok";
import {trackingHealth} from "./lib/tracking-health";
import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { Prisma, ProductStatus, OrderStatus, Role, ReviewStatus, ExperimentStatus } from './generated/prisma/client';
import { prisma } from './lib/db';
import { signAdminToken, requireAuth, signTwoFactorChallenge, decodeTwoFactorChallenge, forgetAdminUser, passwordStamp, ADMIN_TOKEN_SECONDS, type AuthedRequest } from './lib/auth';
import { generateTotpSecret, verifyTotp, totpUri } from './lib/totp';
import { validAdminBody, productCreateSchema, productUpdateSchema, variantCreateSchema, categoryCreateSchema, categoryUpdateSchema, pageCreateSchema, pageUpdateSchema, redirectSchema, salePriceProblem } from './lib/admin-validators';
import QRCode from 'qrcode';
import { createOrder, transitionOrder } from './lib/order';
import { checkoutSchema } from './lib/validators';
import { normalizePakistanPhone } from './lib/phone';
import { getSetting, getSettings, setSetting } from './lib/settings';
import { postexTrackingUrl } from './lib/postex';
import { getLocalUploadDir, isCloudStorageConfigured, StorageError, uploadObject } from './lib/storage';
import { sendMetaServerEvent } from './lib/meta';
import { fetchMetaAds, getMetaMarketingConfig, testMetaMarketingConnection } from './lib/meta-marketing';
import { invalidateFrontendCache } from './lib/cache-invalidation';
import { cleanCatalogMeta, sanitizeGlobalProductTabs, sanitizeProductTabOverrides } from './lib/catalog-meta';
import { productBadges } from './lib/product-badges';
import { parseVideoUrl, VIDEO_URL_ERROR } from './lib/product-video';
import { cleanStockStatus, IN_STOCK_WHERE, canSell, itemStockStatus, productStockStatus, trackedQuantity } from './lib/stock';
import { BUY_TWO_DISCOUNT_PERCENT, bundleLineTotal, priceSummary, variantPriceSummary } from './lib/pricing';
import { sendContactTeamEmail } from './lib/email';
import { consumeRateLimit, requestIp, isLikelyBot } from './lib/rate-limit';
import { dispatchJobRow } from './lib/jobs';
import { waitUntil } from '@vercel/functions';
import { buildProductWrite, demoteH1, MAX_PRODUCT_IMAGES, MAX_VARIATION_IMAGES, planImport, slugify as importSlugify, templateCsv, titleKey as importTitleKey, validateHeaders } from './lib/product-import';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
const port = Number(process.env.PORT || 4000);
// Without a database URL nothing can work. Answer every request with the missing variable name
// (never its value) so a misconfigured deployment explains itself instead of crashing.
if (!process.env.DATABASE_URL) {
  console.error('[config] DATABASE_URL is not set in the backend environment');
  app.use((_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ ok: false, error: 'BACKEND_MISCONFIGURED', missing: ['DATABASE_URL'] }); });
}
const frontendOrigins = [...new Set([...(process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(v => v.trim()).filter(Boolean),SITE_ORIGIN,'https://zelvomart.vercel.app','https://zelvomart.com','https://www.zelvomart.com'])];
app.use(cors({ origin(origin, cb) { if (!origin || frontendOrigins.includes(origin)) return cb(null, true); cb(new Error('CORS_NOT_ALLOWED')); }, credentials: false }));
app.use('/uploads', express.static(getLocalUploadDir(), { maxAge: '365d', immutable: true, index: false, fallthrough: true }));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));

function routeParam(req: express.Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function setPublicCache(res: express.Response, ttlSeconds: number, staleSeconds: number, tags: string[] = []) {
  const value = `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${staleSeconds}, stale-if-error=86400`;
  res.setHeader('Cache-Control', value);
  res.setHeader('CDN-Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=${staleSeconds}, stale-if-error=86400`);
  res.setHeader('Vercel-CDN-Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=${staleSeconds}, stale-if-error=86400`);
  if (tags.length) res.setHeader('Vercel-Cache-Tag', [...new Set(tags)].join(','));
}

function setNoStore(res: express.Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
}

app.use((req, res, next) => {
  if (/^\/api\/(auth|customer-auth|admin|orders|checkout|reviews|events|session-replays|contact)(?:\/|$)/.test(req.path)) setNoStore(res);
  next();
});

function readCatalogMeta(sourceUrl: unknown) {
  if (typeof sourceUrl !== 'string' || !sourceUrl.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(sourceUrl);
    if (parsed && typeof parsed === 'object' && parsed.zvmCatalog && typeof parsed.zvmCatalog === 'object') return parsed.zvmCatalog;
  } catch {
    return null;
  }
  return null;
}

function normalizeRedirectDestination(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw || /^(javascript|data|vbscript):/i.test(raw)) return "";
  try {
    const site = new URL(`${(SITE_ORIGIN).replace(/\/$/, "")}/`);
    const url = raw.startsWith("/") ? new URL(raw, site) : new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const hosts = new Set([site.hostname, site.hostname.replace(/^www\./, ""), `www.${site.hostname.replace(/^www\./, "")}`, "localhost", "127.0.0.1"]);
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

function writeCatalogMeta(meta: unknown) {
  if (!meta || typeof meta !== 'object') return null;
  const next = cleanCatalogMeta(meta as Record<string, any>);
  if (next.productTabs && typeof next.productTabs === 'object') {
    next.productTabs = sanitizeProductTabOverrides(next.productTabs);
  }
  next.redirectUrl = normalizeRedirectDestination(next.redirectUrl);
  if (!next.redirectUrl) delete next.redirectUrl;
  return JSON.stringify({ zvmCatalog: next });
}

/** Vimeo has no fixed thumbnail URL; its public oEmbed API returns one. Best effort. */
async function vimeoThumbnail(url: string) {
  try {
    const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=640`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return '';
    const body: any = await response.json();
    return typeof body?.thumbnail_url === 'string' ? body.thumbnail_url : '';
  } catch {
    return '';
  }
}

/**
 * Product video: a YouTube or Vimeo link only (no uploads). Rejects other links, stores the
 * normalised link, and keeps the date the link was added (schema uploadDate) plus its thumbnail.
 */
async function resolveProductVideo(input: unknown, previousMeta: any, previousUrl: string | null) {
  const raw = String(input ?? '').trim();
  if (!raw) return { videoUrl: null as string | null, meta: { videoAddedAt: '', videoThumbnail: '' } };
  const video = parseVideoUrl(raw);
  if (!video) throw new Error(VIDEO_URL_ERROR);
  const unchanged = previousUrl && parseVideoUrl(previousUrl)?.url === video.url;
  const addedAt = unchanged && previousMeta?.videoAddedAt ? String(previousMeta.videoAddedAt) : new Date().toISOString();
  let thumbnail = video.thumbnailUrl || (unchanged ? String(previousMeta?.videoThumbnail || '') : '');
  if (!thumbnail && video.provider === 'vimeo') thumbnail = await vimeoThumbnail(video.url);
  return { videoUrl: video.url, meta: { videoAddedAt: addedAt, videoThumbnail: thumbnail } };
}

type CustomRedirect = { source: string; destination: string };

/** "Old URL" field: a path on this site (full URLs of this site are reduced to their path). */
function normalizeRedirectSource(value: unknown) {
  const normalized = normalizeRedirectDestination(value);
  if (!normalized) return '';
  if (!normalized.startsWith('/')) throw new Error('REDIRECT_OLD_URL_MUST_BE_ON_THIS_SITE');
  let path = normalized.replace(/[?#].*$/, '') || '/';
  const last = path.split('/').pop() || '';
  if (!path.endsWith('/') && !last.includes('.')) path += '/';
  return path;
}

/**
 * The product's redirect: Old URL (defaults to the product's own URL, can be any old path such as
 * a WordPress URL) -> Destination URL as a 301. Throws when the destination equals the old URL.
 */
function customRedirect(meta: any, slug: string): CustomRedirect | null {
  const destination = normalizeRedirectDestination(meta?.redirectUrl);
  if (!destination) return null;
  const source = normalizeRedirectSource(meta?.redirectFrom) || `/product/${slug}/`;
  if (destination.replace(/[?#].*$/, '') === source) throw new Error('REDIRECT_DESTINATION_SAME_AS_OLD_URL');
  return { source, destination };
}

function previousCustomRedirect(meta: any, slug: string): CustomRedirect | null {
  try {
    return customRedirect(meta, slug);
  } catch {
    return null;
  }
}

async function syncProductRedirect(options: { slug: string; previousSlug?: string; status: string; redirectFallback: boolean; custom: CustomRedirect | null; previousCustom?: CustomRedirect | null }) {
  const shop = '/shop';
  const current = `/product/${options.slug}/`;
  const { custom, previousCustom } = options;
  // Drop the row this product wrote last time when its old URL changed or the redirect was cleared.
  if (previousCustom && previousCustom.source !== custom?.source) {
    await prisma.redirect.deleteMany({ where: { sourcePath: previousCustom.source, destination: previousCustom.destination } });
  }
  // Saved into the same Redirect table Admin -> SEO Redirects uses.
  if (custom) {
    await prisma.redirect.upsert({
      where: { sourcePath: custom.source },
      update: { destination: custom.destination, permanent: true },
      create: { sourcePath: custom.source, destination: custom.destination, permanent: true },
    });
  }
  const ownUrlRedirect = custom && custom.source === current ? custom.destination : '';
  if (options.previousSlug && options.previousSlug !== options.slug) {
    const from = `/product/${options.previousSlug}/`;
    const destination = ownUrlRedirect || (options.status === 'PUBLISHED' ? current : shop);
    await prisma.redirect.upsert({
      where: { sourcePath: from },
      update: { destination, permanent: true },
      create: { sourcePath: from, destination, permanent: true },
    });
  }
  if (ownUrlRedirect) {
    // The product's own URL already points at the destination (written above).
  } else if (options.status === 'PUBLISHED' || !options.redirectFallback) {
    await prisma.redirect.deleteMany({ where: { sourcePath: current } });
  } else {
    await prisma.redirect.upsert({
      where: { sourcePath: current },
      update: { destination: shop, permanent: false },
      create: { sourcePath: current, destination: shop, permanent: false },
    });
  }
  await invalidateFrontendCache(['redirects']);
}

function jsonProduct(row: any, bundleDiscount = BUY_TWO_DISCOUNT_PERCENT) {
  const pricing = priceSummary(row.price, row.salePrice);
  const images = Array.isArray(row.images) ? row.images.filter((x: unknown) => typeof x === 'string') : [];
  const catalog = readCatalogMeta(row.sourceUrl) || {};
  const imageAlt = String(catalog.imageMeta?.alt || row.title || '');
  const imageTitle = String(catalog.imageMeta?.title || '').trim() || null;
  const reviews = (row.reviews || []).filter((r:any)=>r.status==='APPROVED'&&!r.deletedAt&&r.origin!=='TEST').map((review: any) => ({ id: review.id, name: review.name, rating: review.rating, body: review.body, verified: review.verified, avatarUrl:review.avatarUrl, media:review.media||[], images:review.images, createdAt: (review.reviewDate||review.createdAt)?.toISOString?.() || review.createdAt }));
  const averageRating = reviews.length ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length : undefined;
  return {
    id: row.id, slug: row.slug, name: row.title, title: row.title, sku: row.sku, orderCount:row._count?.orderItems||0,
    categories: row.category ? [{ id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description, image: row.category.imageUrl }] : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    category: row.category || null,
    ...pricing, salePrice: row.salePrice == null ? null : Number(row.salePrice),
    // stockStatus = can it be bought (lib/stock.ts); stockSetting = what the admin picked for Track OFF.
    stockStatus: productStockStatus(row), trackStock: Boolean(row.trackStock), stockSetting: cleanStockStatus(row.stockStatus),
    stockQuantity: trackedQuantity(row), stock: row.stock, featured: row.featured, averageRating, reviewCount: reviews.length,
    image: images[0], images: images.map((src: string, index: number) => ({ src, alt: imageAlt, ...(index === 0 && imageTitle ? { title: imageTitle } : {}) })), rawImages: images,
    imageAlt, imageTitle,
    tags: Array.isArray(catalog.tags) ? catalog.tags : [],
    badges: productBadges(catalog, pricing), freeShipping: Boolean(catalog.freeShipping),
    buyTwoDiscountPercent: bundleDiscount,
    shortDescription: row.shortDescription, description: row.descriptionHtml, descriptionHtml: row.descriptionHtml,
    videoUrl: row.videoUrl, videoThumbnail: catalog.videoThumbnail || null, videoAddedAt: catalog.videoAddedAt || null,
    permalink: `/product/${row.slug}/`, hasOptions: (row.variants || []).length > 0,
    variants: (row.variants || []).map((v: any) => {
      const extras = Array.isArray(catalog.variations)
        ? catalog.variations.find((item: any) => (item.sku && item.sku === v.sku) || (item.name && item.name === v.name)) || {}
        : {};
      const images = Array.isArray(extras.images) ? extras.images.filter((src: unknown) => typeof src === "string" && src) : [];
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
    bundleEnabled: row.bundleEnabled, bundleDiscountPercent: bundleDiscount, reviews,
    seoTitle: row.seoTitle, seoDescription: row.seoDescription, canonicalUrl: row.canonicalUrl, catalogMeta: readCatalogMeta(row.sourceUrl),
    costPrice: row.costPrice == null ? null : Number(row.costPrice), status: row.status, categoryId: row.categoryId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

const productInclude = { category: true, variants: { where: { active: true }, orderBy: { createdAt: 'asc' as const } }, reviews: { where: { status: 'APPROVED' as const, deletedAt:null, origin:{not:'TEST'} }, include:{media:true}, orderBy: { createdAt: 'desc' as const } } };

const productListSelect = {
  id: true, slug: true, title: true, sku: true, images: true, price: true, salePrice: true, stock: true, trackStock: true, stockStatus: true, featured: true, sourceUrl: true,
  shortDescription: true, bundleEnabled: true, bundleDiscountPercent: true, createdAt:true,updatedAt:true,
  category: { select: { id: true, name: true, slug: true, description: true, imageUrl: true, seoTitle: true, seoDescription: true } },
  variants: { where: { active: true }, select: { id: true, sku: true, name: true, stock: true, trackStock: true, stockStatus: true, active: true, priceOverride: true, imageUrl: true, attributes: true } },
  reviews: { where: { status: 'APPROVED' as const, deletedAt:null, origin:{not:'TEST'} }, select: { rating: true } },
} satisfies Prisma.ProductSelect;

function jsonProductSummary(row: any, bundleDiscount = BUY_TWO_DISCOUNT_PERCENT) {
  const pricing = priceSummary(row.price, row.salePrice);
  const images = Array.isArray(row.images) ? row.images.filter((x: unknown) => typeof x === 'string') : [];
  const catalog = readCatalogMeta(row.sourceUrl) || {};
  const reviewCount = Array.isArray(row.reviews) ? row.reviews.length : 0;
  const averageRating = reviewCount ? row.reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviewCount : undefined;
  const hasOptions = Array.isArray(row.variants) && row.variants.length > 0;
  const imageAlt = String(catalog.imageMeta?.alt || row.title || '');
  const imageTitle = String(catalog.imageMeta?.title || '').trim() || null;
  return {
    id: row.id, slug: row.slug, name: row.title, title: row.title, sku: row.sku, createdAt:row.createdAt,updatedAt:row.updatedAt,orderCount:row._count?.orderItems||0,
    categories: row.category ? [{ id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description, image: row.category.imageUrl }] : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    ...pricing, salePrice: row.salePrice == null ? null : Number(row.salePrice),
    stockStatus: productStockStatus(row), trackStock: Boolean(row.trackStock),
    stockQuantity: trackedQuantity(row), featured: row.featured, averageRating, reviewCount,
    image: images[0], images: images[0] ? [{ src: images[0], alt: imageAlt, ...(imageTitle ? { title: imageTitle } : {}) }] : [],
    imageAlt, imageTitle,
    tags: Array.isArray(catalog.tags) ? catalog.tags : [],
    badges: productBadges(catalog, pricing), freeShipping: Boolean(catalog.freeShipping),
    buyTwoDiscountPercent: bundleDiscount,
    shortDescription: row.shortDescription, description: null, videoUrl: null, permalink: `/product/${row.slug}/`,
    hasOptions, variants: (row.variants || []).map((variant: any) => ({
      id: variant.id, sku: variant.sku, name: variant.name, attributes: variant.attributes || {},
      priceOverride: variant.priceOverride == null ? null : Number(variant.priceOverride),
      pricing: variantPriceSummary(pricing, {
        priceOverride: variant.priceOverride,
        regularPrice: Array.isArray(catalog.variations)
          ? catalog.variations.find((item: any) => (item.sku && item.sku === variant.sku) || (item.name && item.name === variant.name))?.regularPrice
          : null,
      }),
      stock: Number(variant.stock || 0), trackStock: Boolean(variant.trackStock), stockStatus: itemStockStatus(variant),
      imageUrl: variant.imageUrl || null, images: variant.imageUrl ? [variant.imageUrl] : [], active: true,
    })), bundleEnabled: row.bundleEnabled,
    bundleDiscountPercent: bundleDiscount, reviews: [],
  };
}

async function audit(req: AuthedRequest, action: string, entity: string, entityId?: string, details?: unknown) {
  await prisma.auditLog.create({ data: { userId: req.admin?.id, action, entity, entityId, details: (details || {}) as any } });
}

function isSensitiveSettingKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes('token') || normalized.includes('secret') || normalized.includes('password');
}

function normalizeTrafficSource(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'direct' || raw === '(direct)') return 'direct';
  if (['fb','facebook','facebook.com','m.facebook.com','l.facebook.com'].includes(raw) || raw.includes('facebook')) return 'facebook';
  if (['ig','instagram','instagram.com','l.instagram.com'].includes(raw) || raw.includes('instagram')) return 'instagram';
  if (raw.includes('google')) return 'google';
  if (raw.includes('tiktok')) return 'tiktok';
  if (raw.includes('youtube')) return 'youtube';
  return raw;
}


const storeDb = prisma as any;
const STORE_SESSION_DAYS = Math.max(1, Math.min(90, Number(process.env.STORE_SESSION_DAYS || 30)));

function storeTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function bearerToken(req: express.Request) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function createStoreSession(req: express.Request, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + STORE_SESSION_DAYS * 24 * 60 * 60 * 1000);
  await storeDb.storeSession.create({
    data: {
      userId,
      tokenHash: storeTokenHash(token),
      expiresAt,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
    },
  });
  return { token, expiresAt };
}

async function findStoreSession(req: express.Request) {
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
  void storeDb.storeSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return session;
}

function publicStoreUser(user: { id: string; name: string; email: string; createdAt: Date }) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

async function allowRequest(req: express.Request, res: express.Response, namespace: string, limit: number, windowMs: number, discriminator = '') {
  const key = `${namespace}:${requestIp(req)}:${discriminator}`;
  const result = await consumeRateLimit(key, limit, windowMs);
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({ error: 'RATE_LIMITED', retryAfterSeconds: result.retryAfterSeconds });
    return false;
  }
  return true;
}


async function catalogCacheTags(slug: string, categoryId?: string | null) {
  const tags = ['products', 'featured-products', 'categories', 'store', 'redirects', `product:${slug}`];
  if (!categoryId) return tags;
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { slug: true } });
  if (category?.slug) tags.push(`category:${category.slug}`);
  return tags;
}

async function loadAdminProduct(id: string) {
  const row = await prisma.product.findUnique({ where: { id }, include: { category: true, variants: true, reviews: true } });
  return row ? jsonProduct(row,Number(await getSetting('store.bundleDefaultDiscountPercent',5))) : null;
}

// The database is far from the server (Supabase ap-southeast-2), so opening a connection can take
// longer than Prisma's 2s default wait for an interactive transaction ("Unable to start a
// transaction in the given time"). Give product writes room to start and finish.
const PRODUCT_TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

/**
 * Updates variations by SKU instead of deleting and recreating them, so variant IDs stay the
 * same (carts keep working) and live stock is only written when the caller sends `stock`
 * (the admin changed that quantity). Variations no longer sent are deactivated.
 */
async function writeVariants(tx: Prisma.TransactionClient, productId: string, variants: any[]) {
  const existing = await tx.variant.findMany({ where: { productId }, select: { id: true, sku: true } });
  const bySku = new Map(existing.map((row) => [row.sku, row]));
  const used = new Set<string>();
  for (const variant of variants) {
    const sku = String(variant?.sku || '').trim();
    const name = String(variant?.name || '').trim();
    if (!sku || !name || used.has(sku)) continue;
    used.add(sku);
    const fields = {
      name,
      attributes: variant.attributes || {},
      priceOverride: variant.priceOverride ? new Prisma.Decimal(Number(variant.priceOverride)) : null,
      imageUrl: variant.imageUrl || null,
      active: variant.active !== false,
      // Stock settings are only changed when sent (the CSV import does not send them).
      ...('trackStock' in variant ? { trackStock: Boolean(variant.trackStock) } : {}),
      ...('stockStatus' in variant ? { stockStatus: cleanStockStatus(variant.stockStatus) } : {}),
    };
    const hasStock = variant.stock !== undefined && variant.stock !== null && variant.stock !== '';
    const stock = Math.max(0, Math.floor(Number(variant.stock) || 0));
    const row = bySku.get(sku);
    if (row) await tx.variant.update({ where: { id: row.id }, data: { ...fields, ...(hasStock ? { stock } : {}) } });
    else await tx.variant.create({ data: { productId, sku, ...fields, stock: hasStock ? stock : 0 } });
  }
  const gone = existing.filter((row) => !used.has(row.sku)).map((row) => row.id);
  if (gone.length) await tx.variant.updateMany({ where: { id: { in: gone } }, data: { active: false } });
}

const META_EVENT_NAMES = new Set(['PageView','ViewContent','Search','AddToCart','InitiateCheckout','Purchase','Contact','Lead']);

let replayCleanupAt = 0;
async function maybeCleanupOldSessionReplays() {
  const settingDays = await getSetting<number | string | null>('tracking.sessionReplayRetentionDays', null).catch(() => null);
  const parsedSettingDays = settingDays !== null && settingDays !== undefined ? Number(settingDays) : NaN;
  const days = Number.isFinite(parsedSettingDays) && parsedSettingDays > 0
    ? parsedSettingDays
    : Number(process.env.SESSION_REPLAY_RETENTION_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) return;
  const now = Date.now();
  if (now - replayCleanupAt < 6 * 60 * 60 * 1000) return;
  replayCleanupAt = now;
  const cutoff = new Date(now - days * 86400000);
  await prisma.sessionReplay.deleteMany({ where: { startedAt: { lt: cutoff } } }).catch(() => undefined);
}

// The backend is an API only; the root just says it is running (the shop is on the frontend).
app.get('/', (_req, res) => { setNoStore(res); res.json({ ok: true, service: 'zelvomart-backend', health: '/api/health' }); });
app.get('/api/health', async (_req, res) => { setNoStore(res); try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true, version: '2.0.0', features: { cro: true, marketing: true, sessionReplays: true, tracking: true, capi: true } }); } catch (e: any) { res.status(503).json({ ok: false, version: '2.0.0', error: e?.message || 'DB_UNAVAILABLE' }); } });

app.post('/api/contact', async (req, res) => {
  setNoStore(res);
  if (!(await allowRequest(req, res, 'contact', 10, 60 * 60 * 1000))) return;
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  const problem = String(req.body?.problem || '').trim();
  const website = String(req.body?.website || '').trim();

  // Honeypot: silently accept likely bot submissions.
  if (website) return res.status(201).json({ ok: true });
  if (!name || name.length > 100) return res.status(400).json({ error: 'INVALID_NAME', message: 'Please enter your name.' });
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 160) return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please enter a valid email address.' });
  if (phone.length < 7 || phone.length > 40) return res.status(400).json({ error: 'INVALID_PHONE', message: 'Please enter a valid phone number.' });
  if (problem.length < 5 || problem.length > 2000) return res.status(400).json({ error: 'INVALID_MESSAGE', message: 'Please add a little more detail about the problem.' });

  try {
    await sendContactTeamEmail({ name, email, phone, problem, sourceUrl: String(req.get('referer') || '') });
    return res.status(201).json({ ok: true });
  } catch (error: any) {
    console.error('Contact form email failed', error);
    return res.status(503).json({ error: 'CONTACT_DELIVERY_FAILED', message: 'We could not send your message right now. Please use WhatsApp or try again shortly.' });
  }
});

app.get('/api/store/bootstrap', async (_req, res) => {
  setNoStore(res);
  const [categories, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } } }),
    getSettings([
      'store.info',
      'store.delivery',
      'tracking.metaPixelEnabled',
      'tracking.metaPixelId',
      'tracking.tiktokPixelEnabled',
      'tracking.tiktokPixelId',
      'tracking.sessionReplayEnabled',
      'tracking.sessionReplayRetentionDays',
      'homepage.config',
      'store.bundleDefaultDiscountPercent',
    ])
  ]);
  // Recordings go to the private R2 bucket only. Without it the storefront does not load the recorder at all.
  if (!replayStorageConfigured()) settings['tracking.sessionReplayEnabled'] = false;
  res.json({ categories: categories.map(c => ({ id:c.id,name:c.name,slug:c.slug,description:c.description,image:c.imageUrl,seoTitle:c.seoTitle,seoDescription:c.seoDescription,count:c._count.products })), settings });
});

app.get('/api/categories', async (_req, res) => {
  setPublicCache(res, 900, 3600, ['categories']);
  const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } } });
  res.json(rows.map(c => ({ id:c.id,name:c.name,slug:c.slug,description:c.description,image:c.imageUrl,seoTitle:c.seoTitle,seoDescription:c.seoDescription,count:c._count.products,sortOrder:c.sortOrder,imageUrl:c.imageUrl })));
});

app.get('/api/products', async (req, res) => {
  if (String(req.query.search || '').trim() && !(await allowRequest(req, res, 'search', 60, 60 * 1000))) return;
  const rawPage=Math.floor(Number(req.query.page)),rawLimit=Math.floor(Number(req.query.limit));
  const page=Number.isFinite(rawPage)?Math.max(1,rawPage):1,limit=Number.isFinite(rawLimit)&&rawLimit>0?Math.min(100,rawLimit):12;
  const search = String(req.query.search || '').trim(); const category = String(req.query.category || '').trim(); const sort = String(req.query.sort || 'popular');
  const featured = String(req.query.featured || '') === 'true';
  const minPriceRaw = Number(req.query.minPrice); const maxPriceRaw = Number(req.query.maxPrice);
  const minPrice = Number.isFinite(minPriceRaw) && minPriceRaw >= 0 ? minPriceRaw : undefined;
  const maxPrice = Number.isFinite(maxPriceRaw) && maxPriceRaw >= 0 ? maxPriceRaw : undefined;
  const availability = String(req.query.availability || '').trim();
  const tag = String(req.query.tag || '').trim().replace(/[^a-z0-9-]/gi, '');
  setNoStore(res);
  const query=catalogQuery({search,category,featured,minPrice,maxPrice,availability,tag,sort});
  const [rank,counts]=await Promise.all([
    prisma.$queryRaw<{id:string;orders:bigint}[]>(Prisma.sql`SELECT p.id,COALESCE(s.orders,0) AS orders ${query.from} ORDER BY ${query.order} LIMIT ${limit} OFFSET ${(page-1)*limit}`),
    prisma.$queryRaw<{total:bigint}[]>(Prisma.sql`SELECT COUNT(*) AS total ${query.from}`),
  ]);
  const rows=rank.length?await prisma.product.findMany({where:{id:{in:rank.map(r=>r.id)}},select:productListSelect}):[];
  const byId=new Map(rows.map(row=>[row.id,row])),total=Number(counts[0]?.total||0);
  const discount=Number(await getSetting('store.bundleDefaultDiscountPercent',5));res.json({items:rank.flatMap(r=>{const row=byId.get(r.id);return row?[jsonProductSummary({...row,_count:{orderItems:Number(r.orders)}},discount)]:[];}),page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))});
});
app.get('/api/products/slug/:slug', async (req,res) => { const slug=routeParam(req, 'slug'); setNoStore(res); const row = await prisma.product.findFirst({ where:{ slug, status:'PUBLISHED' }, include: productInclude }); if(!row) return res.status(404).json({error:'NOT_FOUND'}); res.json(jsonProduct(row,Number(await getSetting('store.bundleDefaultDiscountPercent',5)))); });
app.get('/api/pages/:slug', async (req,res) => { setPublicCache(res, 900, 3600, ['pages']); const slugs = [routeParam(req, 'slug'), ...String(req.query.fallback || '').split(',').filter(Boolean)]; const page = await prisma.page.findFirst({ where:{ slug:{in:slugs}, published:true } }); if(!page) return res.status(404).json({error:'NOT_FOUND'}); res.json(page); });
app.get('/api/settings/public', async (req,res) => { setNoStore(res); const keys = publicSettingKeys(req.query.keys); res.json(keys.length?await getSettings(keys):{}); });
app.get('/api/cities', async (_req,res) => { setNoStore(res); res.json(await prisma.city.findMany({ where:{active:true}, orderBy:{name:'asc'} })); });
app.get('/api/seo/sitemap', async (_req,res) => { setPublicCache(res, 3600, 86400, ['seo']); const [products,categories,pages] = await Promise.all([prisma.product.findMany({where:{status:'PUBLISHED'},select:{slug:true,updatedAt:true,sourceUrl:true}}).then(rows=>rows.filter(r=>readCatalogMeta(r.sourceUrl)?.robotsIndex!=='noindex').map(({slug,updatedAt})=>({slug,updatedAt}))),prisma.category.findMany({select:{slug:true,updatedAt:true}}),prisma.page.findMany({where:{published:true},select:{slug:true,updatedAt:true}})]); res.json({products,categories,pages}); });
// Every redirect, for the storefront proxy: it answers old URLs with a real 301 before the page renders.
app.get('/api/redirects/map', async (_req,res)=>{setPublicCache(res,120,600,['redirects']);const rows=await prisma.redirect.findMany({select:{sourcePath:true,destination:true,permanent:true},take:20000});res.json(rows.map(r=>[r.sourcePath,r.destination,r.permanent?1:0]));});
app.get('/api/redirects/resolve', async (req,res)=>{setPublicCache(res,3600,86400,['redirects']);const sourcePath=String(req.query.path||'');const row=await prisma.redirect.findUnique({where:{sourcePath}});if(!row)return res.status(404).json({error:'NOT_FOUND'});res.json(row);});
for(const platform of ['meta','tiktok','google'] as const){app.get(`/api/feed/${platform}.xml`,async(_req,res)=>{setPublicCache(res,300,600,['products','feed']);const feed=await catalogFeed(platform);void setSetting('health.feed.'+platform,{at:new Date().toISOString(),count:feed.count,missingImages:feed.missingImages.length}).catch(()=>undefined);res.setHeader('X-Catalog-Items',String(feed.count));res.setHeader('X-Catalog-Missing-Images',String(feed.missingImages.length));res.type('application/xml').send(feed.xml)})}

app.post('/api/orders', async (req,res) => {
  if (!(await allowRequest(req, res, 'checkout-ip', 12, 15 * 60 * 1000))) return;
  const rawPhone = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
  if (rawPhone && !(await allowRequest(req, res, 'checkout-phone', 6, 15 * 60 * 1000, rawPhone))) return;
  const parsed = checkoutSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'VALIDATION_ERROR',issues:parsed.error.flatten()});
  try {
    // The order is saved when createOrder returns; the customer gets the answer right away. Job dispatch and the
    // cache refresh run after the response (waitUntil). The Job rows are already saved, so the worker's
    // job-recovery picks up any that fail to dispatch here.
    const order = await createOrder({ ...parsed.data, email: parsed.data.email || undefined, postcode: parsed.data.postcode || undefined, orderNotes: parsed.data.orderNotes || undefined, trackingAllowed:isStorefrontUrl(req.get('origin')||req.get('referer')||''), clientIp:req.ip, clientUserAgent:req.get('user-agent') || undefined }, { dispatchJobs: false });
    res.status(201).json({ orderNumber: order.orderNumber, id: order.id, subtotal: Number(order.subtotal), deliveryFee: Number(order.deliveryFee), discount: Number(order.couponDiscount || 0), total: Number(order.total) });
    const jobIds: string[] = (order as { jobIds?: string[] }).jobIds || [];
    const soldOut: string[] = (order as { soldOutSlugs?: string[] }).soldOutSlugs || [];
    waitUntil(Promise.allSettled([
      ...jobIds.map((id) => dispatchJobRow(id)),
      // Only the products this order sold out change on the storefront; a normal order flushes nothing.
      ...(soldOut.length ? [invalidateFrontendCache(soldOut.map((slug) => `product:${slug}`))] : []),
    ]));
  }
  catch(e:any){ res.status(400).json({error:e?.message || 'ORDER_FAILED'}); }
});
app.post('/api/orders/track', async (req,res) => { if (!(await allowRequest(req, res, 'order-track', 30, 15 * 60 * 1000))) return; const orderNumber=String(req.body.orderNumber||'').toUpperCase(); const phone=String(req.body.phone||'').replace(/\D/g,'');if(!normalizePakistanPhone(phone))return res.status(400).json({error:'Enter a valid Pakistani phone number.'}); const order=await prisma.order.findFirst({where:{orderNumber, OR:[{phone:{endsWith:phone.slice(-10)}},{phone:{endsWith:phone.slice(-11)}}]},select:{orderNumber:true,status:true,postexTracking:true,createdAt:true,total:true,city:true}}); if(!order)return res.status(404).json({error:'NOT_FOUND'}); const city=await prisma.city.findUnique({where:{name:order.city}});res.json({...order,deliveryEstimate:`${city?.deliveryMinDays??2}–${city?.deliveryMaxDays??7} working days`,total:Number(order.total),trackingUrl:order.postexTracking?postexTrackingUrl(order.postexTracking):null}); });
app.get('/api/orders/confirmation/:orderNumber', async (req,res) => {
  const order=await prisma.order.findUnique({where:{orderNumber:routeParam(req, 'orderNumber').toUpperCase()},include:{items:true}});
  if(!order)return res.status(404).json({error:'NOT_FOUND'});
  // The confirmation page contains private delivery details, so the public order number alone is not enough.
  // The opaque database ID is returned only to the browser that placed the order and is kept in the success URL.
  if(String(req.query.key||'')!==order.id)return res.status(404).json({error:'NOT_FOUND'});
  const city=await prisma.city.findUnique({where:{name:order.city}});
  res.json({...order,subtotal:Number(order.subtotal),bundleSaving:Number(order.bundleSaving),deliveryFee:Number(order.deliveryFee),codFee:Number(order.codFee),total:Number(order.total),items:order.items.map(i=>({...i,unitPrice:Number(i.unitPrice),lineTotal:Number(i.lineTotal),bundleDiscount:Number(i.bundleDiscount)})),deliveryEstimate:`${city?.deliveryMinDays??2}-${city?.deliveryMaxDays??7} working days`});
});
app.get('/api/settings/delivery',async(_req,res)=>{setNoStore(res);res.json(await getSetting('store.delivery',{}));});
registerRecovery(app,findStoreSession);
app.use('/api/admin/coupons',couponRouter);
app.use('/api/admin/orders',orderEditRouter);
app.use('/api/admin/overview',overviewRouter);
app.use('/api/admin/reviews',reviewRouter);
app.post('/api/checkout/coupon',async(req,res)=>{if(!(await allowRequest(req,res,'coupon',20,60000)))return;try{const cart=Array.isArray(req.body.cart)?req.body.cart:[];if(!cart.length||cart.length>50)throw new Error('Your cart is empty.');const products=await prisma.product.findMany({where:{id:{in:cart.map((i:any)=>String(i.productId))},status:'PUBLISHED'},include:{variants:true}});const discount=Number(await getSetting('store.bundleDefaultDiscountPercent',5));let subtotal=0;for(const item of cart){if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20)throw new Error('Invalid quantity.');const p=products.find(p=>p.id===item.productId);if(!p)throw new Error('Product unavailable.');const v=item.variantId?p.variants.find(v=>v.id===item.variantId&&v.active):undefined;if(item.variantId&&!v||!v&&p.variants.some(v=>v.active))throw new Error('Choose a valid variation.');const price=variantPriceSummary(priceSummary(p.price,p.salePrice),{priceOverride:v?.priceOverride}).price;subtotal+=bundleLineTotal(price,item.quantity,item.bundleSize===2&&p.bundleEnabled?2:1,discount).total;}res.json(await validateCoupon(req.body.code,subtotal));}catch(e:any){res.status(400).json({error:e.message});} });

app.post('/api/reviews/upload-chunk',reviewChunkUpload,async(req,res)=>{if(!(await allowRequest(req,res,'review-upload-part',120,24*60*60*1000)))return;try{res.json(await writeReviewChunk(req));}catch(error:any){res.status(400).json({error:error.message});}});
app.post('/api/reviews/upload-complete',async(req,res)=>{if(!(await allowRequest(req,res,'review-upload-part',120,24*60*60*1000)))return;try{res.json(await completeReviewChunks(req));}catch(error:any){res.status(400).json({error:error.message});}});
app.post('/api/reviews/upload-url',async(req,res)=>{
  if(!(await allowRequest(req,res,'review-upload',60,24*60*60*1000)))return;
  try{
    const productId=String(req.body.productId||''),orderNumber=String(req.body.orderNumber||'').trim().toUpperCase(),phone=String(req.body.phone||'').replace(/\D/g,'').slice(-10);
    if(!productId||!orderNumber||phone.length!==10)return res.status(400).json({error:'Enter the delivered order number and checkout phone.'});
    const order=await prisma.order.findFirst({where:{orderNumber,status:'DELIVERED',phone:{endsWith:phone},items:{some:{productId}}},select:{id:true}});
    if(!order)return res.status(403).json({error:'Use the delivered order number and phone used at checkout.'});
    res.json(await stageReviewUpload(req));
  }catch(error:any){res.status(400).json({error:error.message});}
});
app.post('/api/reviews', async(req,res,next)=>{
  try{if(await allowRequest(req,res,'review',10,24*60*60*1000))next();}catch(error){next(error);}
}, customerReviewUpload, hydrateReviewUploads, async (req,res) => {
  try {
  if(String(req.body.honeypot||''))return res.status(201).json({ok:true});
  const productId=String(req.body.productId||''); const name=String(req.body.name||'').trim(); const body=String(req.body.body||'').trim(); const rating=Number(req.body.rating||0);
  const email=String(req.body.email||'').trim();
  if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||name.length>200||body.length>20000||!Number.isInteger(rating))return res.status(400).json({error:'Invalid name, private email, review text or rating.'});
  const orderNumber=String(req.body.orderNumber||'').trim().toUpperCase(); const phone=String(req.body.phone||'').replace(/\D/g,'').slice(-10);
  if(!productId||!name||!body||rating<1||rating>5||!orderNumber||phone.length!==10)return res.status(400).json({error:'DELIVERED_ORDER_REQUIRED'});
  const order=await prisma.order.findFirst({where:{orderNumber,status:'DELIVERED',phone:{endsWith:phone},items:{some:{productId}}},select:{id:true,customerId:true}});
  if(!order)return res.status(403).json({error:'REVIEW_NOT_VERIFIED',message:'Use the delivered order number and phone used at checkout.'});
  const existing=await prisma.review.findFirst({where:{productId,orderId:order.id}});
  if(existing)return res.status(409).json({error:'REVIEW_ALREADY_SUBMITTED'});
  const {media}=await storeReviewFiles(req);
  const review=await prisma.$transaction(async tx=>{
    // Lock the delivered order to serialize concurrent submissions for this purchase.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
    if(await tx.review.findFirst({where:{productId,orderId:order.id}}))throw new Error('REVIEW_ALREADY_SUBMITTED');
    return tx.review.create({data:{productId,orderId:order.id,customerId:order.customerId,name,email,body,rating,verified:true,status:'PENDING',reviewRef:`CUSTOMER-${crypto.randomUUID()}`,media:{create:media}}});
  });
  res.status(201).json({ok:true,id:review.id,verified:true});
  }catch(e:any){res.status(e.code==='P2002'||e.message==='REVIEW_ALREADY_SUBMITTED'?409:400).json({error:e.message||'Review submission failed.'});}
});
app.post('/api/events', async (req,res) => {
  const userAgent = req.get('user-agent') || undefined;
  if (isLikelyBot(userAgent)) return res.json({ ok: true, ignored: 'bot' });
  if (!(await allowRequest(req, res, 'events', 240, 60 * 1000))) return;

  const eventName = String(req.body.eventName || '');
  const eventId = String(req.body.eventId || '');
  const replayId=String(req.body.replaySessionId||'');
  const sessionReplayId=/^[0-9a-f-]{36}$/i.test(replayId)?replayId:null;
  if ((!META_EVENT_NAMES.has(eventName)&&!['ReplayRageClick','ReplayError'].includes(eventName)) || !eventId || eventId.length > 160) return res.status(400).json({ error: 'INVALID_EVENT' });

  if(await prisma.eventLog.findFirst({where:{channel:'browser',eventId,eventName},select:{id:true}}))return res.json({ok:true,duplicate:true});
  const sourceUrl = privateSafeUrl(String(req.body.sourceUrl || '')).slice(0,4000) || null;
  const params = req.body.params && typeof req.body.params === 'object' && !Array.isArray(req.body.params) ? req.body.params as Record<string, unknown> : {};
  const row = await prisma.eventLog.create({
    data: { eventName, eventId, sessionReplayId, channel: 'browser', sourceUrl, payload: req.body || {} },
  });

  if(sessionReplayId){
    const now=new Date(),flags={...(eventName==='AddToCart'?{reachedCart:true}:{}),...(eventName==='InitiateCheckout'?{reachedCheckout:true}:{})};
    await prisma.sessionReplay.upsert({where:{id:sessionReplayId},update:{lastSeenAt:now,lastUrl:sourceUrl||'',...flags},create:{id:sessionReplayId,visitorId:/^[0-9a-f-]{36}$/i.test(String(req.body.visitorId||''))?req.body.visitorId:sessionReplayId,source:'direct',landingUrl:sourceUrl||'',lastUrl:sourceUrl||'',startedAt:now,lastSeenAt:now,...flags}});
  }

  // Purchase is dispatched from the order transaction. All other storefront events
  // are queued to CAPI and TikTok with the SAME event ID as the browser Pixel event.
  const productionEvent=isStorefrontUrl(sourceUrl||'');
  if (eventName !== 'Purchase' && !eventName.startsWith('Replay') && productionEvent) {
    const job = await prisma.job.create({
      data: {
        name: 'meta-event',
        payload: {
          eventName,
          eventId,
          sourceUrl,
          userAgent,
          eventTime:Math.floor(Date.now()/1000),
          visitorId:req.body.visitorId||null,
          ip: requestIp(req),
          fbp: req.body.fbp || null,
          fbc: req.body.fbc || null,
          customData: params,
        } as Prisma.InputJsonValue,
      },
    });
    dispatchJobRow(job.id).catch(() => undefined);

    const ttJob = await prisma.job.create({
      data: {
        name: 'tiktok-event',
        payload: {
          eventName,
          eventId,
          sourceUrl,
          userAgent,
          eventTime:Math.floor(Date.now()/1000),
          visitorId:req.body.visitorId||null,
          ip: requestIp(req),
          ttp: req.body.ttp || null,
          ttclid:req.body.ttclid||null,
          customData: params,
        } as Prisma.InputJsonValue,
      },
    });
    dispatchJobRow(ttJob.id).catch(() => undefined);
  }

  res.json({ ok: true, id: row.id });
});

// Privacy-safe customer session replay ingestion. Input values are masked in the browser before these events arrive.
// Recording events are stored only in the private R2 bucket; Postgres keeps metadata (storageKey, counts, timestamps).
// Without R2 nothing is recorded: these routes answer 503 before touching the database.
function replayStorageMissing(res: express.Response) {
  if (replayStorageConfigured()) return false;
  res.status(503).json({ error: 'REPLAY_STORAGE_NOT_CONFIGURED' });
  return true;
}
app.post('/api/session-replays/start', async (req,res) => {
  if (replayStorageMissing(res)) return;
  void maybeCleanupOldSessionReplays();
  if(!(await allowRequest(req,res,'replay-start',60,60000)))return;
  const sessionId=String(req.body.sessionId||'').trim();
  const visitorId=String(req.body.visitorId||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(sessionId)||!/^[0-9a-f-]{36}$/i.test(visitorId)) return res.status(400).json({error:'INVALID_SESSION'});
  const source=req.body.source&&typeof req.body.source==='object'?req.body.source:{};
  const sourceName=normalizeTrafficSource((source as any).source||(source as any).utm_source||(source as any).lastTouch?.utm_source||(source as any).firstTouch?.utm_source||'direct');
  const startedAt=new Date(req.body.startedAt||Date.now());
  const landingUrl=privateSafeUrl(String(req.body.landingUrl||req.body.currentUrl||'')).slice(0,4000);
  const lastUrl=privateSafeUrl(String(req.body.currentUrl||landingUrl)).slice(0,4000);
  const now=new Date();
  const medium=String((source as any).medium||(source as any).utm_medium||'').slice(0,120)||null;
  const campaign=String((source as any).campaign||(source as any).utm_campaign||'').slice(0,240)||null;
  const pageView=req.body.pageView===true;
  const metadata={firstTouch:(source as any).firstTouch||null,lastTouch:(source as any).lastTouch||null} as Prisma.InputJsonValue;
  const updateData:Prisma.SessionReplayUpdateInput={
    visitorId,
    source:sourceName,
    medium,
    campaign,
    lastSeenAt:now,
    lastUrl,
    referrer:req.body.referrer?String(req.body.referrer).slice(0,4000):undefined,
    device:req.body.device?String(req.body.device).slice(0,40):undefined,
    viewport:req.body.viewport?String(req.body.viewport).slice(0,40):undefined,
    status:'ACTIVE',
    metadata,
    ...(pageView?{pageViews:{increment:1}}:{}),
  };
  await prisma.sessionReplay.upsert({
    where:{id:sessionId},
    update:updateData,
    create:{id:sessionId,visitorId,source:sourceName,medium,campaign,landingUrl,lastUrl,referrer:req.body.referrer?String(req.body.referrer).slice(0,4000):null,device:req.body.device?String(req.body.device).slice(0,40):null,viewport:req.body.viewport?String(req.body.viewport).slice(0,40):null,status:'ACTIVE',startedAt:Number.isNaN(startedAt.getTime())?now:startedAt,lastSeenAt:now,metadata}
  });
  res.json({ok:true});
});

app.post('/api/session-replays/chunk', async(req,res)=>{
 if(replayStorageMissing(res))return;
 if(!(await allowRequest(req,res,'replay-chunks',180,60000)))return;
 const sessionId=String(req.body.sessionId||''),sequence=Number(req.body.sequence),events=Array.isArray(req.body.events)?req.body.events:[];
 if(!/^[0-9a-f-]{36}$/i.test(sessionId)||!Number.isInteger(sequence)||sequence<0||events.length<1||events.length>100)return res.status(400).json({error:'INVALID_REPLAY_CHUNK'});
 if(events.some((e:any)=>!e||!Number.isFinite(e.timestamp)||e.timestamp<Date.now()-90*86400000||e.timestamp>Date.now()+60000))return res.status(400).json({error:'INVALID_REPLAY_TIMESTAMP'});
 const now=new Date(),currentUrl=privateSafeUrl(String(req.body.currentUrl||'')).slice(0,4000);
 const firstTimestamp=Math.min(...events.map((e:any)=>e.timestamp)),lastTimestamp=Math.max(...events.map((e:any)=>e.timestamp));
 await prisma.sessionReplay.upsert({where:{id:sessionId},update:{lastSeenAt:now,lastUrl:currentUrl},create:{id:sessionId,visitorId:sessionId,source:'direct',landingUrl:currentUrl,lastUrl:currentUrl,status:'ACTIVE',startedAt:new Date(firstTimestamp),lastSeenAt:now}});
 let stored;try{stored=await storeReplayChunk(sessionId,sequence,events)}catch(error){console.error('Private replay upload failed',error instanceof Error?error.message:error);return res.status(503).json({error:'REPLAY_STORAGE_UNAVAILABLE'})}
 if(!stored)return res.status(503).json({error:'REPLAY_STORAGE_NOT_CONFIGURED'});
 // Metadata only: the events column stays at its empty default.
 const data={eventCount:events.length,hasSnapshot:events.some((e:any)=>e.type===2),firstTimestamp,lastTimestamp,...(stored||{} )};
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${sessionId}))`;
  const old=await tx.sessionReplayChunk.findUnique({where:{sessionId_sequence:{sessionId,sequence}},select:{eventCount:true}});
  await tx.sessionReplayChunk.upsert({where:{sessionId_sequence:{sessionId,sequence}},create:{sessionId,sequence,...data},update:data});
  const session=await tx.sessionReplay.findUniqueOrThrow({where:{id:sessionId},select:{startedAt:true,durationMs:true}});
  await tx.sessionReplay.update({where:{id:sessionId},data:{lastSeenAt:now,lastUrl:currentUrl,eventCount:{increment:events.length-(old?.eventCount||0)},...(!old?{chunkCount:{increment:1}}:{}),...(events.some((e:any)=>e.type===2)?{hasSnapshot:true}:{}),durationMs:Math.max(session.durationMs,Math.min(2147483647,lastTimestamp-session.startedAt.getTime()))}});
 },{maxWait:15000,timeout:30000});
 res.json({ok:true});
});

app.post('/api/session-replays/end', async (req,res) => {
  if (replayStorageMissing(res)) return;
  const sessionId=String(req.body.sessionId||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(sessionId)) return res.status(400).json({error:'INVALID_SESSION'});
  const endedAt=new Date(req.body.endedAt||Date.now());
  await prisma.sessionReplay.updateMany({where:{id:sessionId},data:{status:'ENDED',endedAt:Number.isNaN(endedAt.getTime())?new Date():endedAt,lastSeenAt:new Date(),lastUrl:privateSafeUrl(String(req.body.currentUrl||'')).slice(0,4000)}});
  res.json({ok:true});
});


app.post('/api/customer-auth/signup', async (req,res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!(await allowRequest(req, res, 'store-signup', 5, 15 * 60 * 1000, email))) return;
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'INVALID_NAME' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'PASSWORD_REQUIREMENTS' });
  const existing = await storeDb.storeUser.findUnique({ where: { email }, select: { id: true } });
  if (existing) return res.status(409).json({ error: 'EMAIL_IN_USE' });
  const user = await storeDb.storeUser.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
  });
  const session = await createStoreSession(req, user.id);
  return res.status(201).json({ token: session.token, expiresAt: session.expiresAt, user: publicStoreUser(user) });
});

app.post('/api/customer-auth/login', async (req,res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!(await allowRequest(req, res, 'store-login', 10, 15 * 60 * 1000, email))) return;
  const user = email ? await storeDb.storeUser.findUnique({ where: { email } }) : null;
  if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  const session = await createStoreSession(req, user.id);
  return res.json({ token: session.token, expiresAt: session.expiresAt, user: publicStoreUser(user) });
});

app.get('/api/customer-auth/me', async (req,res) => {
  const session = await findStoreSession(req);
  if (!session) return res.status(401).json({ error: 'UNAUTHORIZED' });
  return res.json({ user: publicStoreUser(session.user), expiresAt: session.expiresAt });
});

app.post('/api/customer-auth/logout', async (req,res) => {
  const token = bearerToken(req);
  if (token) await storeDb.storeSession.deleteMany({ where: { tokenHash: storeTokenHash(token) } });
  return res.json({ ok: true });
});

/** The otpauth link and a QR code (SVG data URL) for an authenticator app. */
async function enrolmentDetails(secret: string, email: string) {
  const uri = totpUri(secret, email);
  const qr = `data:image/svg+xml;base64,${Buffer.from(await QRCode.toString(uri, { type: 'svg', margin: 1, width: 220 })).toString('base64')}`;
  return { otpauthUri: uri, secret, qr };
}

/** Admin passwords: at least this many characters (sign-in, change, reset and new users). */
const ADMIN_PASSWORD_MIN = 10;

/** `stamp` is passwordStamp(passwordHash): the token stops working when the password changes. */
function sessionResponse(res: express.Response, user: { id: string; name: string; email: string; role: Role }, stamp: string) {
  const identity = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ token: signAdminToken(identity, stamp), expiresIn: ADMIN_TOKEN_SECONDS, user: identity });
}

// Step 1: email + password. An account that turned 2FA on gets a 5-minute challenge instead of a session.
app.post('/api/auth/login', async (req,res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!(await allowRequest(req, res, 'admin-login', 8, 15 * 60 * 1000, email))) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  res.setHeader('Cache-Control', 'no-store');

  if (user.twoFactorReady && user.totpSecret) return res.json({ twoFactor: 'verify', challenge: signTwoFactorChallenge(user.id, 'verify') });
  return sessionResponse(res, user, passwordStamp(user.passwordHash));
});

// Step 2: the 6-digit code from the authenticator app. Completes enrolment the first time.
app.post('/api/auth/login/verify', async (req,res) => {
  res.setHeader('Cache-Control', 'no-store');
  let challenge: { sub: string; purpose: 'verify' | 'enroll' };
  try { challenge = decodeTwoFactorChallenge(String(req.body.challenge || '')); } catch { return res.status(401).json({ error: 'CHALLENGE_EXPIRED' }); }
  if (!(await allowRequest(req, res, 'admin-2fa', 6, 15 * 60 * 1000, challenge.sub))) return;
  const user = await prisma.user.findUnique({ where: { id: challenge.sub } });
  if (!user?.active || !user.totpSecret) return res.status(401).json({ error: 'CHALLENGE_EXPIRED' });
  if (challenge.purpose === 'verify' && !user.twoFactorReady) return res.status(401).json({ error: 'CHALLENGE_EXPIRED' });
  if (!verifyTotp(user.totpSecret, String(req.body.code || ''))) return res.status(401).json({ error: 'INVALID_CODE' });
  if (!user.twoFactorReady) {
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorReady: true } });
    await prisma.auditLog.create({ data: { userId: user.id, action: 'enable_2fa', entity: 'User', entityId: user.id } });
    forgetAdminUser(user.id);
  }
  return sessionResponse(res, user, passwordStamp(user.passwordHash));
});

// A fresh 2-hour token for an admin who is still signed in (the admin proxy calls this near expiry).
app.post('/api/auth/refresh', requireAuth(), async (req:AuthedRequest,res) => sessionResponse(res, req.admin!, req.adminPasswordStamp!));

// 2FA is optional for every role: turned on (and off) from a signed-in session in Admin → Security.
app.post('/api/auth/2fa/setup', requireAuth(), async (req:AuthedRequest,res) => {
  res.setHeader('Cache-Control', 'no-store');
  const user = await prisma.user.findUnique({ where: { id: req.admin!.id } });
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (user.twoFactorReady) return res.status(409).json({ error: 'TWO_FACTOR_ALREADY_ON' });
  const secret = user.totpSecret || generateTotpSecret();
  if (!user.totpSecret) await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  res.json(await enrolmentDetails(secret, user.email));
});
app.post('/api/auth/2fa/confirm', requireAuth(), async (req:AuthedRequest,res) => {
  if (!(await allowRequest(req, res, 'admin-2fa', 6, 15 * 60 * 1000, req.admin!.id))) return;
  const user = await prisma.user.findUnique({ where: { id: req.admin!.id } });
  if (!user?.totpSecret) return res.status(400).json({ error: 'SETUP_FIRST' });
  if (!verifyTotp(user.totpSecret, String(req.body.code || ''))) return res.status(401).json({ error: 'INVALID_CODE' });
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorReady: true } });
  await audit(req, 'enable_2fa', 'User', user.id);
  forgetAdminUser(user.id);
  res.json({ ok: true });
});

// Turn 2FA off for your own account. Asks for the current password, so an unattended open session cannot do it.
app.post('/api/auth/2fa/disable', requireAuth(), async (req:AuthedRequest,res) => {
  if (!(await allowRequest(req, res, 'admin-password', 5, 15 * 60 * 1000, req.admin!.id))) return;
  const user = await prisma.user.findUnique({ where: { id: req.admin!.id } });
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ error: 'WRONG_PASSWORD' });
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: null, twoFactorReady: false } });
  await audit(req, 'disable_2fa', 'User', user.id);
  forgetAdminUser(user.id);
  res.json({ ok: true });
});

// Change your own password. Every other session of this account ends (their tokens carry the old stamp);
// this one gets a fresh token, which the admin proxy stores as the session cookie.
app.post('/api/auth/password', requireAuth(), async (req:AuthedRequest,res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await allowRequest(req, res, 'admin-password-change', 5, 15 * 60 * 1000, req.admin!.id))) return;
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  const user = await prisma.user.findUnique({ where: { id: req.admin!.id } });
  if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(401).json({ error: 'WRONG_PASSWORD' });
  if (newPassword.length < ADMIN_PASSWORD_MIN) return res.status(400).json({ error: `The new password needs at least ${ADMIN_PASSWORD_MIN} characters.` });
  if (newPassword.length > 200) return res.status(400).json({ error: 'The new password is too long.' });
  if (newPassword === currentPassword) return res.status(400).json({ error: 'Choose a password different from the current one.' });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const row = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await audit(req, 'change_password', 'User', user.id);
  forgetAdminUser(user.id);
  return sessionResponse(res, row, passwordStamp(passwordHash));
});

app.get('/api/auth/me', requireAuth(), async (req:AuthedRequest,res) => { const row = await prisma.user.findUnique({ where: { id: req.admin!.id }, select: { twoFactorReady: true } }); res.json({ user: req.admin, twoFactorReady: Boolean(row?.twoFactorReady) }); });

app.get('/api/admin/dashboard', requireAuth('orders.read'), async (_req,res) => {
  const health=await trackingHealth();
  const start=new Date();start.setHours(0,0,0,0); const yesterday=new Date(start.getTime()-86400000);
  const [todayOrders,yesterdayOrders,products,customers,failedJobs,events,recent,acceptedPurchases,teamEmails]=await Promise.all([
    prisma.order.findMany({where:{createdAt:{gte:start}}}),
    prisma.order.findMany({where:{createdAt:{gte:yesterday,lt:start}}}),
    prisma.product.count({where:{status:'PUBLISHED'}}),
    prisma.customer.count(),
    prisma.job.count({where:{status:'FAILED'}}),
    prisma.eventLog.groupBy({by:['eventName'],where:{createdAt:{gte:start}},_count:{_all:true}}),
    prisma.order.findMany({orderBy:{createdAt:'desc'},take:8}),
    prisma.eventLog.count({where:{createdAt:{gte:start},channel:'server',eventName:'Purchase',accepted:true}}),
    prisma.job.count({where:{createdAt:{gte:start},name:'order-team-email',status:'SUCCEEDED'}}),
  ]);
  const realOrders=todayOrders.filter(o=>!o.test&&!o.staffCreated).length;
  res.json({health,ordersToday:todayOrders.length,revenueToday:todayOrders.reduce((s,o)=>s+Number(o.total),0),ordersYesterday:yesterdayOrders.length,revenueYesterday:yesterdayOrders.reduce((s,o)=>s+Number(o.total),0),delivered:todayOrders.filter(o=>o.status==='DELIVERED').length,failedJobs,products,customers,acceptedPurchases,trackingCoverage:realOrders?Math.round(acceptedPurchases/realOrders*1000)/10:null,teamEmails,emailCoverage:todayOrders.length?Math.round(teamEmails/todayOrders.length*1000)/10:null,events:Object.fromEntries(events.map(e=>[e.eventName,e._count._all])),recent:recent.map(o=>({...o,total:Number(o.total)}))});
});

app.get('/api/admin/products/insights', requireAuth('products.write'), async (_req,res)=>{
  const [sales,activity]=await Promise.all([
    prisma.orderItem.groupBy({by:['productId'],where:{productId:{not:null},order:{status:{notIn:['CANCELLED','RETURNED']}}},_sum:{quantity:true}}),
    prisma.auditLog.findMany({where:{entity:{in:['Product','Variant']}},orderBy:{createdAt:'desc'},take:6}),
  ]);
  res.json({sales:Object.fromEntries(sales.filter(s=>s.productId).map(s=>[s.productId,s._sum.quantity||0])),activity});
});
app.get('/api/admin/products/export.csv', requireAuth('orders.export'), async (_req,res)=>{const rows=await prisma.product.findMany({include:{category:true},orderBy:{updatedAt:'desc'}});const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv=['title,slug,sku,category,price,salePrice,costPrice,stock,status,featured,shortDescription,descriptionHtml,imageUrls,videoUrl,seoTitle,seoDescription',...rows.map(p=>[p.title,p.slug,p.sku,p.category?.name||'',p.price,p.salePrice||'',p.costPrice||'',p.stock,p.status,p.featured,p.shortDescription||'',p.descriptionHtml||'',Array.isArray(p.images)?p.images.join('|'):'',p.videoUrl||'',p.seoTitle||'',p.seoDescription||''].map(esc).join(','))].join('\n');res.type('text/csv').send(csv);});
app.get('/api/admin/products', requireAuth('products.write'), async (req,res) => { const q=String(req.query.q||''); const status=String(req.query.status||''); const categoryId=String(req.query.categoryId||''); const where:Prisma.ProductWhereInput={...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{sku:{contains:q,mode:'insensitive'}}]}:{}),...(status?{status:status as ProductStatus}:{}),...(categoryId?{categoryId}:{})}; const rows=await prisma.product.findMany({where,include:{category:true,variants:true,reviews:true},orderBy:{updatedAt:'desc'}}); const discount=Number(await getSetting('store.bundleDefaultDiscountPercent',5));res.json(rows.map(row=>jsonProduct(row,discount))); });
app.get('/api/admin/products/:id', requireAuth('products.write'), async (req,res) => { const row=await prisma.product.findUnique({where:{id:routeParam(req, 'id')},include:{category:true,variants:true,reviews:true}}); if(!row)return res.status(404).json({error:'NOT_FOUND'}); res.json(jsonProduct(row,Number(await getSetting('store.bundleDefaultDiscountPercent',5)))); });
app.post('/api/admin/products', requireAuth('products.write'), async (req:AuthedRequest,res) => {
  if (!validAdminBody(productCreateSchema, req.body, res)) return;
  try {
    const b=req.body||{};
    const price=Number(b.price||0);
    const salePrice=b.salePrice==null||b.salePrice===''?null:Number(b.salePrice);
    const bundleEnabled=b.bundleEnabled!==false;
    const bundleDiscountPercent=b.bundleDiscountPercent==null||b.bundleDiscountPercent===''?null:Number(b.bundleDiscountPercent);
    const nextStatus=(b.status||'DRAFT') as ProductStatus;
    const custom=customRedirect(b.catalogMeta, String(b.slug));
    if (b.catalogMeta) b.catalogMeta.redirectFrom = custom?.source || b.catalogMeta.redirectFrom || '';
    const video=await resolveProductVideo(b.videoUrl, null, null);
    b.videoUrl=video.videoUrl; b.catalogMeta={...(b.catalogMeta||{}),...video.meta};
    const row=await prisma.$transaction(async (tx) => {
      const created=await tx.product.create({data:{trackStock:Boolean(b.trackStock),stockStatus:cleanStockStatus(b.stockStatus),title:String(b.title),slug:String(b.slug),sku:String(b.sku),categoryId:b.categoryId||null,price:new Prisma.Decimal(price),salePrice:salePrice==null?null:new Prisma.Decimal(salePrice),costPrice:b.costPrice?new Prisma.Decimal(Number(b.costPrice)):null,stock:Number(b.stock||0),status:nextStatus,featured:Boolean(b.featured),bundleEnabled,bundleDiscountPercent:bundleDiscountPercent==null?null:new Prisma.Decimal(bundleDiscountPercent),shortDescription:b.shortDescription||null,descriptionHtml:b.descriptionHtml?demoteH1(String(b.descriptionHtml)):null,images:Array.isArray(b.images)?b.images:[],videoUrl:b.videoUrl||null,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,canonicalUrl:b.canonicalUrl||null,sourceUrl:b.catalogMeta?writeCatalogMeta(b.catalogMeta):null}});
      if (Array.isArray(b.variants)) await writeVariants(tx, created.id, b.variants);
      return created;
    }, PRODUCT_TX_OPTIONS);
    await audit(req,'create','Product',row.id);
    await syncProductRedirect({ slug: row.slug, status: row.status, redirectFallback: b.catalogMeta?.redirectFallback !== false && b.redirectFallback !== false, custom });
    await invalidateFrontendCache(await catalogCacheTags(row.slug, row.categoryId));
    res.status(201).json(await loadAdminProduct(row.id));
  } catch(error:any) {
    res.status(400).json({error:error?.message||'PRODUCT_CREATE_FAILED'});
  }
});
app.patch('/api/admin/products/:id', requireAuth('products.write'), async (req:AuthedRequest,res) => {
  try {
    const id=routeParam(req,'id');
    const current=await prisma.product.findUnique({where:{id}});
    if(!current)return res.status(404).json({error:'NOT_FOUND'});
    const b=req.body||{};
    if (!validAdminBody(productUpdateSchema, b, res)) return;
    const salePriceIssue = salePriceProblem('price' in b ? b.price : current.price, 'salePrice' in b ? b.salePrice : current.salePrice);
    if (salePriceIssue) return res.status(400).json({ error: salePriceIssue, issues: [{ field: 'salePrice', message: salePriceIssue }] });
    const nextStatus=(('status' in b ? b.status : current.status) || 'DRAFT') as ProductStatus;
    const data:any={};
    const previousMeta=readCatalogMeta(current.sourceUrl)||{};
    const nextSlug=String(b.slug||current.slug);
    const custom=b.catalogMeta?customRedirect({...previousMeta,...b.catalogMeta},nextSlug):previousCustomRedirect(previousMeta,current.slug);
    if (b.catalogMeta) b.catalogMeta.redirectFrom = custom?.source || b.catalogMeta.redirectFrom || '';
    if ('videoUrl' in b) {
      const video=await resolveProductVideo(b.videoUrl, previousMeta, current.videoUrl);
      b.videoUrl=video.videoUrl; b.catalogMeta={...(b.catalogMeta||{}),...video.meta};
    }
    // `stock` is only sent when the admin changed the quantity, so a save never overwrites live stock.
    if('trackStock' in b) data.trackStock=Boolean(b.trackStock);
    if('stockStatus' in b) data.stockStatus=cleanStockStatus(b.stockStatus);
    for(const k of ['title','slug','sku','categoryId','stock','status','featured','bundleEnabled','shortDescription','descriptionHtml','images','videoUrl','seoTitle','seoDescription','canonicalUrl']) if(k in b) data[k]=b[k] === '' ? null : b[k];
    if(typeof data.descriptionHtml==='string') data.descriptionHtml=demoteH1(data.descriptionHtml);
    if (b.catalogMeta) data.sourceUrl = writeCatalogMeta({ ...(readCatalogMeta(current.sourceUrl) || {}), ...b.catalogMeta });
    for(const k of ['price','salePrice','costPrice','bundleDiscountPercent']) if(k in b) data[k]=b[k]===''||b[k]==null?null:new Prisma.Decimal(Number(b[k]));
    if('stock'in data)data.stock=Math.max(0,Math.floor(Number(data.stock)||0));
    if('status' in b) data.status = nextStatus;
    const row=await prisma.$transaction(async (tx) => {
      const updated=await tx.product.update({where:{id},data});
      if (Array.isArray(b.variants)) await writeVariants(tx, id, b.variants);
      return updated;
    }, PRODUCT_TX_OPTIONS);
    await audit(req,'update','Product',row.id);
    const meta = b.catalogMeta || readCatalogMeta(row.sourceUrl) || {};
    await syncProductRedirect({ slug: row.slug, previousSlug: String(b.previousSlug || current.slug || ''), status: row.status, redirectFallback: meta.redirectFallback !== false, custom, previousCustom: previousCustomRedirect(previousMeta, current.slug) });
    const tags = await catalogCacheTags(row.slug, row.categoryId);
    if (current.slug && current.slug !== row.slug) tags.push(`product:${current.slug}`);
    await invalidateFrontendCache(tags);
    res.json(await loadAdminProduct(row.id));
  } catch(error:any) {
    res.status(400).json({error:error?.message||'PRODUCT_UPDATE_FAILED'});
  }
});
/** Removes the product row (variations and reviews cascade) and points its URL at the saved redirect. */
async function deleteProductRecord(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return null;
  const meta = readCatalogMeta(existing.sourceUrl) || {};
  await prisma.product.delete({ where: { id } });
  const destination = normalizeRedirectDestination(meta.redirectUrl) || (meta.redirectFallback !== false ? '/shop' : '');
  if (destination) {
    await prisma.redirect.upsert({
      where: { sourcePath: `/product/${existing.slug}/` },
      update: { destination, permanent: true },
      create: { sourcePath: `/product/${existing.slug}/`, destination, permanent: true },
    });
  }
  return existing;
}

app.delete('/api/admin/products/:id', requireAuth('products.write'), async (req:AuthedRequest,res) => {
  const id = routeParam(req, 'id');
  const existing = await deleteProductRecord(id);
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
  await audit(req,'delete','Product',id);
  await invalidateFrontendCache(['products','featured-products','categories','store','redirects', `product:${existing.slug}`]);
  res.json({ ok: true });
});
app.post('/api/admin/products/:id/variants', requireAuth('products.write'), async (req:AuthedRequest,res) => {
  try {
    const b=req.body||{};
    if (!validAdminBody(variantCreateSchema, b, res)) return;
    const product=await prisma.product.findUnique({where:{id:routeParam(req,'id')}});
    if(!product)return res.status(404).json({error:'NOT_FOUND'});


    const row=await prisma.variant.create({data:{productId:product.id,sku:String(b.sku),name:String(b.name),attributes:b.attributes||{},priceOverride:b.priceOverride?new Prisma.Decimal(Number(b.priceOverride)):null,stock:Number(b.stock||0),trackStock:Boolean(b.trackStock),stockStatus:cleanStockStatus(b.stockStatus),imageUrl:b.imageUrl||null,active:b.active!==false}});
    await audit(req,'create','Variant',row.id);await invalidateFrontendCache(['products']);res.status(201).json(row);
  } catch(error:any) { res.status(400).json({error:error?.message||'VARIANT_CREATE_FAILED'}); }
});
app.delete('/api/admin/variants/:id', requireAuth('products.write'), async (req:AuthedRequest,res)=>{await prisma.variant.delete({where:{id:routeParam(req, 'id')}});await audit(req,'delete','Variant',routeParam(req, 'id'));await invalidateFrontendCache(['products']);res.json({ok:true});});

app.get('/api/admin/categories', requireAuth('products.write'), async (_req,res) => { const rows=await prisma.category.findMany({orderBy:{sortOrder:'asc'},include:{_count:{select:{products:true}}}}); res.json(rows.map(r=>({...r,count:r._count.products}))); });
app.post('/api/admin/categories', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; if (!validAdminBody(categoryCreateSchema, b, res)) return; const row=await prisma.category.create({data:{name:String(b.name),slug:String(b.slug),sortOrder:Number(b.sortOrder||0),imageUrl:b.imageUrl||null,description:b.description||null,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null}});await audit(req,'create','Category',row.id);await invalidateFrontendCache(['categories','products','store']);res.status(201).json(row);});
app.patch('/api/admin/categories/:id', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; if (!validAdminBody(categoryUpdateSchema, b, res)) return; const row=await prisma.category.update({where:{id:routeParam(req, 'id')},data:{name:b.name,slug:b.slug,sortOrder:b.sortOrder==null?undefined:Number(b.sortOrder),imageUrl:b.imageUrl===undefined?undefined:(b.imageUrl||null),description:b.description===undefined?undefined:(b.description||null),seoTitle:b.seoTitle===undefined?undefined:(b.seoTitle||null),seoDescription:b.seoDescription===undefined?undefined:(b.seoDescription||null)}});await audit(req,'update','Category',row.id);await invalidateFrontendCache(['categories','products','store']);res.json(row);});
app.delete('/api/admin/categories/:id', requireAuth('products.write'), async (req:AuthedRequest,res)=>{await prisma.category.delete({where:{id:routeParam(req, 'id')}});await audit(req,'delete','Category',routeParam(req, 'id'));await invalidateFrontendCache(['categories','products','store']);res.json({ok:true});});

async function orderFilters(query: Record<string, unknown>): Promise<Prisma.OrderWhereInput> {
  const text = (key: string) => String(query[key] || '').trim();
  const q = text('q'), status = text('status');
  const groups: Record<string, OrderStatus[]> = {Pending:['NEW','ON_HOLD'],Processing:['CONFIRMED'],Shipped:['BOOKED','IN_TRANSIT'],Delivered:['DELIVERED','SETTLED'],Cancelled:['CANCELLED'],Returned:['RETURNED']};
  const date = (key: string, end = false) => {
    const value = text(key);
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('INVALID_DATE');
    const parsed = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}+05:00`);
    if (Number.isNaN(parsed.getTime())) throw new Error('INVALID_DATE');
    return parsed;
  };
  const gte = date('from'), lte = date('to', true);
  if (gte && lte && gte > lte) throw new Error('INVALID_DATE_RANGE');
  if (status && !Object.values(OrderStatus).includes(status as OrderStatus)) throw new Error('INVALID_STATUS');
  return {
    ...(status ? {status: status as OrderStatus} : groups[text('group')] ? {status:{in:groups[text('group')]}} : {}),
    ...(text('hasReplay')==='true'?{replaySessionId:{not:null}}:{}),
    ...(text('repeat')==='true'?{customerId:{in:(await prisma.order.groupBy({by:['customerId'],where:{customerId:{not:null}},_count:{_all:true},having:{customerId:{_count:{gt:1}}}})).map(r=>r.customerId! )}}:{}),
    ...(text('city') ? {city:{contains:text('city'),mode:'insensitive'}} : {}),
    ...(text('source') ? {source:{contains:text('source'),mode:'insensitive'}} : {}),
    ...(gte || lte ? {createdAt:{gte,lte}} : {}),
    ...(q ? {OR:[{orderNumber:{contains:q,mode:'insensitive'}},{fullName:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}},{phone:{contains:q}},{customer:{phone:{contains:q}}},{items:{some:{title:{contains:q,mode:'insensitive'}}}}]} : {}),
  };
}

// Static routes must precede /orders/:id.
app.get('/api/admin/orders/export.csv', requireAuth('orders.export'), async (req,res)=>{
  let where: Prisma.OrderWhereInput;
  try { where=await orderFilters(req.query); } catch(error:any) { return res.status(400).json({error:error.message}); }
  const rows=await prisma.order.findMany({where,orderBy:{createdAt:'desc'}});
  const esc=(v:unknown)=>`"${String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')}"`;
  const csv=['orderNumber,date,customer,phone,email,city,status,paymentMethod,total,source,tracking',...rows.map(o=>[o.orderNumber,o.createdAt.toISOString(),o.fullName,o.phone,o.email,o.city,o.status,o.paymentMethod,o.total,o.source,o.postexTracking].map(esc).join(','))].join('\r\n');
  res.attachment('zelvomart-orders.csv').type('text/csv').send('\uFEFF'+csv);
});
app.get('/api/admin/orders/dashboard', requireAuth('orders.read'), async (req,res)=>{
  let where: Prisma.OrderWhereInput;
  try { where=await orderFilters({...req.query,status:'',group:''}); } catch(error:any) { return res.status(400).json({error:error.message}); }
  // Compare the selected period with the preceding equal-length period in Pakistan time.
  const now=new Date(Date.now()+5*3600000);
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)-5*3600000);
  const range=where.createdAt as Prisma.DateTimeFilter | undefined;
  const currentEnd=range?.lte instanceof Date?range.lte:new Date(Math.max(Date.now(),range?.gte instanceof Date?range.gte.getTime()+86400000-1:0));
  const currentStart=range?.gte instanceof Date?range.gte:(start>currentEnd?new Date(currentEnd.getTime()-30*86400000):start);
  const duration=currentEnd.getTime()-currentStart.getTime()+1;
  const comparisonBase={...where,createdAt:undefined};
  const [counts,current,previous,activity,products]=await Promise.all([
    prisma.order.groupBy({by:['status'],where,_count:{_all:true}}),
    prisma.order.groupBy({by:['status'],where:{...comparisonBase,createdAt:{gte:currentStart,lte:currentEnd}},_count:{_all:true}}),
    prisma.order.groupBy({by:['status'],where:{...comparisonBase,createdAt:{gte:new Date(currentStart.getTime()-duration),lt:currentStart}},_count:{_all:true}}),
    prisma.orderStatusHistory.findMany({where:{order:where},include:{order:{select:{id:true,orderNumber:true,fullName:true}}},orderBy:{createdAt:'desc'},take:6}),
    prisma.orderItem.groupBy({by:['sku','title','imageUrl'],where:{order:{...where,status:{notIn:['CANCELLED','RETURNED']}}},_sum:{quantity:true},orderBy:{_sum:{quantity:'desc'}},take:5}),
  ]);
  const map=(rows:typeof counts)=>Object.fromEntries(rows.map(r=>[r.status,r._count._all]));
  res.json({counts:map(counts),current:map(current),previous:map(previous),comparison:{from:currentStart,to:currentEnd},activity,products:products.map(p=>({sku:p.sku,title:p.title,imageUrl:p.imageUrl,quantity:p._sum.quantity||0}))});
});
app.get('/api/admin/orders/catalog', requireAuth('orders.write'), async (req,res)=>{
  const search=String(req.query.search||'').trim();
  const items=await prisma.product.findMany({where:{status:'PUBLISHED',...(search?{OR:[{title:{contains:search,mode:'insensitive' as const}},{sku:{contains:search,mode:'insensitive' as const}}]}:{})},select:productListSelect,take:10,orderBy:{title:'asc'}});
  const discount=Number(await getSetting('store.bundleDefaultDiscountPercent',5));res.json({items:items.map(row=>jsonProductSummary(row,discount))});
});
app.post('/api/admin/orders', requireAuth('orders.write'), async (req:AuthedRequest,res)=>{
  const parsed=checkoutSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'VALIDATION_ERROR',issues:parsed.error.flatten()});
  try {
    const order=await createOrder({...parsed.data,staffCreated:true,email:parsed.data.email||undefined,source:{utm_source:'admin'}});
    await audit(req,'create','Order',order.id);await invalidateFrontendCache(['products']);
    res.status(201).json({id:order.id,orderNumber:order.orderNumber});
  } catch(error:any) {res.status(400).json({error:error.message||'ORDER_CREATE_FAILED'});}
});
app.get('/api/admin/orders', requireAuth('orders.read'), async (req,res)=>{
  let where: Prisma.OrderWhereInput;
  try {where=await orderFilters(req.query);} catch(error:any) {return res.status(400).json({error:error.message});}
  const paginated=req.query.page!==undefined;
  const page=Math.max(1,Math.floor(Number(req.query.page)||1));
  const limit=Math.min(100,Math.max(1,Math.floor(Number(req.query.limit)||10)));
  const sorts: Record<string,Prisma.OrderOrderByWithRelationInput>={newest:{createdAt:'desc'},oldest:{createdAt:'asc'},highest:{total:'desc'},lowest:{total:'asc'}};
  const [rows,total]=await Promise.all([
    prisma.order.findMany({where,include:{items:true,customer:{select:{refusalCount:true,blocklisted:true,_count:{select:{orders:true}}}}},orderBy:[sorts[String(req.query.sort)]||sorts.newest,{id:'asc'}],skip:paginated?(page-1)*limit:0,take:paginated?limit:1000}),
    prisma.order.count({where}),
  ]);
  const items=rows.map(r=>({...r,total:Number(r.total)}));
  res.json(paginated?{items,total,page,totalPages:Math.max(1,Math.ceil(total/limit))}:items);
});
async function enqueueOrderStatusTracking(orderId:string,status:string){
 const order=await prisma.order.findUnique({where:{id:orderId},select:{test:true,staffCreated:true,blocklistedAtOrder:true}});if(!order||order.test||order.staffCreated||order.blocklistedAtOrder)return;
 const eventName=status==='CONFIRMED'?'OrderConfirmed':'OrderDelivered';
 const jobs=await Promise.all(['meta-purchase','tiktok-purchase'].map(name=>prisma.job.create({data:{name,orderId,payload:{orderId,eventName}}})));
 await Promise.allSettled(jobs.map(job=>dispatchJobRow(job.id)));
}
app.patch('/api/admin/orders/bulk-status', requireAuth('orders.write'), async (req:AuthedRequest,res)=>{
  const ids=Array.isArray(req.body.ids)?req.body.ids.map(String).slice(0,100):[];const next=String(req.body.status) as OrderStatus;
  if(!ids.length||!Object.values(OrderStatus).includes(next))return res.status(400).json({error:'INVALID_BULK_UPDATE'});
  let updated=0;
  for(const id of ids){
    const existing=await prisma.order.findUnique({where:{id}});if(!existing||existing.status===next)continue;
    await transitionOrder(id,next,req.admin?.id,'Bulk status update');
    if(['CONFIRMED','BOOKED','DELIVERED'].includes(next)){const job=await prisma.job.create({data:{name:'customer-status-email',orderId:id,payload:{orderId:id,status:next}}});dispatchJobRow(job.id).catch(()=>undefined);}
    if(['CONFIRMED','DELIVERED'].includes(next))await enqueueOrderStatusTracking(id,next);
    updated+=1;
  }
  await audit(req,'bulk_status_change','Order',undefined,{ids,status:next,updated});if(['CANCELLED','RETURNED'].includes(next))await invalidateFrontendCache(['products']);res.json({ok:true,updated});
});
app.post('/api/admin/orders/:id/resend-purchase',requireAuth('orders.write'),async(req:AuthedRequest,res)=>{const id=routeParam(req,'id'),order=await prisma.order.findUnique({where:{id}});if(!order)return res.status(404).json({error:'NOT_FOUND'});if(order.test||order.staffCreated||order.blocklistedAtOrder)return res.status(400).json({error:'Tracking is excluded for this order.'});for(const name of ['meta-purchase','tiktok-purchase']){const existing=await prisma.job.findFirst({where:{orderId:id,name,status:{in:['QUEUED','RUNNING']}}});if(!existing){const job=await prisma.job.create({data:{orderId:id,name,payload:{orderId:id}}});void dispatchJobRow(job.id).catch(()=>undefined);}}await audit(req,'resend_purchase','Order',id);res.json({ok:true});});
app.get('/api/admin/orders/:id', requireAuth('orders.read'), async (req,res)=>{const row=await prisma.order.findUnique({where:{id:routeParam(req, 'id')},include:{items:true,statusHistory:{include:{user:true},orderBy:{createdAt:'desc'}},customer:true}});if(!row)return res.status(404).json({error:'NOT_FOUND'});res.json({...row,...await orderExtras(row),total:Number(row.total),subtotal:Number(row.subtotal),bundleSaving:Number(row.bundleSaving),deliveryFee:Number(row.deliveryFee),codFee:Number(row.codFee),items:row.items.map(i=>({...i,unitPrice:Number(i.unitPrice),lineTotal:Number(i.lineTotal),bundleDiscount:Number(i.bundleDiscount)})),trackingUrl:row.postexTracking?postexTrackingUrl(row.postexTracking):null});});
app.patch('/api/admin/orders/:id/status', requireAuth('orders.write'), async (req:AuthedRequest,res)=>{
  const id=routeParam(req,'id');
  const next=String(req.body.status) as OrderStatus;
  if(!Object.values(OrderStatus).includes(next)) return res.status(400).json({error:'INVALID_STATUS'});
  const existing=await prisma.order.findUnique({where:{id}});
  if(!existing) return res.status(404).json({error:'NOT_FOUND'});
  await transitionOrder(id,next,req.admin?.id,String(req.body.note||'').slice(0,5000));
  if(existing.status!==next&&['CONFIRMED','DELIVERED'].includes(next))await enqueueOrderStatusTracking(id,next);
  await audit(req,'status_change','Order',id,{from:existing.status,to:next});
  if(['CANCELLED','RETURNED'].includes(next)) await invalidateFrontendCache(['products']);
  if(existing.status!==next && ['CONFIRMED','BOOKED','DELIVERED'].includes(next)) {
    const job=await prisma.job.create({data:{name:'customer-status-email',orderId:id,payload:{orderId:id,status:next}}});
    dispatchJobRow(job.id).catch(()=>undefined);
  }
  res.json({ok:true});
});
app.patch('/api/admin/orders/:id/tracking', requireAuth('orders.write'), async (req:AuthedRequest,res)=>{
  const id=routeParam(req,'id');
  const tracking=String(req.body.tracking||'').trim();
  const existing=await prisma.order.findUnique({where:{id}});
  if(!existing)return res.status(404).json({error:'NOT_FOUND'});
  await transitionOrder(id,tracking?'BOOKED':existing.status,req.admin?.id,tracking?`PostEx tracking ${tracking}`:undefined,tracking||null);
  if(tracking&&existing.status!=='BOOKED') {
    const job=await prisma.job.create({data:{name:'customer-status-email',orderId:id,payload:{orderId:id,status:'BOOKED'}}});
    dispatchJobRow(job.id).catch(()=>undefined);
  }
  await audit(req,'tracking_update','Order',id,{tracking});
  res.json({ok:true,trackingUrl:tracking?postexTrackingUrl(tracking):null});
});

app.get('/api/admin/customers', requireAuth('customers.read'), async (_req,res)=>{
  const rows=await prisma.customer.findMany({include:{orders:{select:{id:true,orderNumber:true,total:true,status:true,city:true,createdAt:true},orderBy:{createdAt:'desc'}}},orderBy:{updatedAt:'desc'}});
  res.json(rows.map(c=>({...c,orders:c.orders.map(o=>({...o,total:Number(o.total)})),totalSpent:c.orders.filter(o=>['DELIVERED','SETTLED'].includes(o.status)).reduce((sum,o)=>sum+Number(o.total),0),orderCount:c.orders.length,city:c.orders[0]?.city||null,lastOrder:c.orders[0]?.createdAt||null})));
});
function customerInput(body:any){
  if(!body||typeof body!=='object'||typeof body.name!=='string'||typeof body.phone!=='string'||(body.email!=null&&typeof body.email!=='string')||(body.notes!=null&&typeof body.notes!=='string'))return null;
  const name=String(body.name||'').trim(),phone=normalizePakistanPhone(String(body.phone||'')),email=String(body.email||'').trim(),notes=String(body.notes||'').trim();
  if(name.length<2||name.length>100||!phone||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||notes.length>2000)return null;
  return {name,phone:phone!,email:email||null,notes:notes||null};
}
app.post('/api/admin/customers', requireAuth('customers.write'), async (req:AuthedRequest,res)=>{
  const data=customerInput(req.body);if(!data)return res.status(400).json({error:'Enter a name, valid Pakistani mobile number, and valid optional email.'});
  try{const row=await prisma.customer.create({data});await audit(req,'create','Customer',row.id);res.status(201).json({id:row.id});}catch(error:any){if(error.code==='P2002')return res.status(409).json({error:'A customer with this phone number already exists.'});throw error;}
});
app.patch('/api/admin/customers/bulk-blocklist', requireAuth('customers.write'), async (req:AuthedRequest,res)=>{
  if(!req.body||!Array.isArray(req.body.ids)||req.body.ids.length>100)return res.status(400).json({error:'INVALID_BULK_UPDATE'});
  const ids:string[]=Array.isArray(req.body.ids)?[...new Set<string>(req.body.ids.map(String))].slice(0,100):[];if(!ids.length||typeof req.body.blocklisted!=='boolean')return res.status(400).json({error:'INVALID_BULK_UPDATE'});
  const result=await prisma.customer.updateMany({where:{id:{in:ids}},data:{blocklisted:req.body.blocklisted}});await audit(req,'bulk_blocklist','Customer',undefined,{ids,blocklisted:req.body.blocklisted});res.json({updated:result.count});
});
app.get('/api/admin/customers/:id',requireAuth('customers.read'),async(req,res)=>{const row=await prisma.customer.findUnique({where:{id:routeParam(req,'id')},include:{orders:{include:{items:true},orderBy:{createdAt:'desc'}}}});if(!row)return res.status(404).json({error:'NOT_FOUND'});const abandoned=await prisma.abandonedCheckout.findMany({where:{OR:[{phone:row.phone},...(row.email?[{email:row.email}]:[])]},orderBy:{createdAt:'desc'},take:30});res.json({...row,orders:row.orders.map(o=>({...o,total:Number(o.total)})),abandoned});});
app.patch('/api/admin/customers/:id', requireAuth('customers.write'), async (req:AuthedRequest,res)=>{
  const data=customerInput(req.body);if(!data)return res.status(400).json({error:'Enter a name, valid Pakistani mobile number, and valid optional email.'});
  try{const row=await prisma.customer.update({where:{id:routeParam(req,'id')},data});await audit(req,'update','Customer',row.id);res.json({id:row.id});}catch(error:any){if(error.code==='P2002')return res.status(409).json({error:'A customer with this phone number already exists.'});if(error.code==='P2025')return res.status(404).json({error:'Customer not found.'});throw error;}
});
app.patch('/api/admin/customers/:id/blocklist', requireAuth('customers.write'), async (req:AuthedRequest,res)=>{const current=await prisma.customer.findUnique({where:{id:routeParam(req, 'id')}});if(!current)return res.status(404).json({error:'NOT_FOUND'});const row=await prisma.customer.update({where:{id:routeParam(req, 'id')},data:{blocklisted:typeof req.body.blocklisted==='boolean'?req.body.blocklisted:!current.blocklisted}});await audit(req,'toggle_blocklist','Customer',row.id,{blocklisted:row.blocklisted});res.json(row);});

app.get('/api/admin/pages', requireAuth('content.write'), async (_req,res)=>res.json(await prisma.page.findMany({orderBy:{slug:'asc'}})));
app.post('/api/admin/pages', requireAuth('content.write'), async (req:AuthedRequest,res)=>{const b=req.body||{};if(!validAdminBody(pageCreateSchema,b,res))return;const slug=String(b.slug||'').trim().toLowerCase();const title=String(b.title||'').trim();if(!slug||!title)return res.status(400).json({error:'TITLE_AND_SLUG_REQUIRED'});const row=await prisma.page.upsert({where:{slug},update:{title,bodyHtml:String(b.bodyHtml||''),seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,published:b.published!==false},create:{slug,title,bodyHtml:String(b.bodyHtml||''),seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,published:b.published!==false}});await audit(req,'upsert','Page',row.id);await invalidateFrontendCache(['pages']);res.status(201).json(row);});
app.patch('/api/admin/pages/:id', requireAuth('content.write'), async (req:AuthedRequest,res)=>{const b=req.body||{};if(!validAdminBody(pageUpdateSchema,b,res))return;const row=await prisma.page.update({where:{id:routeParam(req, 'id')},data:{title:b.title,slug:b.slug,bodyHtml:b.bodyHtml,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,published:b.published!==false}});await audit(req,'update','Page',row.id);await invalidateFrontendCache(['pages']);res.json(row);});

app.get('/api/admin/product-tabs', requireAuth('products.write'), async (_req,res)=>{
  const tabs = await getSetting<Record<string, { title: string; content: string }> | null>('store.productTabs', null);
  res.json({ tabs });
});
app.put('/api/admin/product-tabs', requireAuth('products.write'), async (req:AuthedRequest,res)=>{
  const tabs = sanitizeGlobalProductTabs(req.body?.tabs ?? req.body);
  await setSetting('store.productTabs', tabs);
  await audit(req,'update','ProductTabs',undefined,{keys:Object.keys(tabs)});
  await invalidateFrontendCache(['settings','store','products','setting:store.productTabs']);
  res.json({ ok: true, tabs });
});

app.get('/api/admin/settings', requireAuth('settings.write'), async (_req,res)=>{
  const [settings,cities]=await Promise.all([prisma.setting.findMany(),prisma.city.findMany({orderBy:{name:'asc'}})]);
  const safeSettings:Record<string,unknown>={};
  for(const s of settings){
    if(s.key==='tracking.metaCapiToken'||s.key==='tracking.tiktokEventsApiToken'){
      safeSettings[s.key]=s.value?'••••••••':'';
    }else if(!isSensitiveSettingKey(s.key)){
      safeSettings[s.key]=s.value;
    }
  }
  res.json({settings:safeSettings,cities});
});
app.put('/api/admin/settings', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{
  let values:Record<string,unknown>;
  try{values=validateSettingsUpdate(req.body);}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Invalid settings.'});}
  const entries=Object.entries(values).filter(([key,value])=>!(/Token$|accessToken$/.test(key)&&(!value||value==='••••••••')));
  await prisma.$transaction(entries.map(([key,value])=>prisma.setting.upsert({where:{key},update:{value:value as any},create:{key,value:value as any}})));
  await audit(req,'update','Settings',undefined,{keys:Object.keys(req.body||{})});
  await invalidateFrontendCache(['settings','store','products','setting:store.bundleDefaultDiscountPercent']);
  res.json({ok:true});
});
app.put('/api/admin/cities',requireAuth('settings.write'),async(req:AuthedRequest,res)=>{
  let cities:ReturnType<typeof validateCitySettings>;
  try{cities=validateCitySettings(req.body.cities);}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Invalid cities.'});}
  await prisma.$transaction([prisma.city.updateMany({where:{name:{notIn:cities.map(c=>c.name)}},data:{active:false}}),...cities.map(c=>prisma.city.upsert({where:{name:c.name},update:c,create:c}))]);
  await audit(req,'update','Cities');await invalidateFrontendCache(['cities']);res.json({ok:true});
});

app.get('/api/admin/users', requireAuth('users.write'), async (_req,res)=>res.json(await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,active:true,twoFactorReady:true,createdAt:true,updatedAt:true},orderBy:{createdAt:'desc'}})));
app.post('/api/admin/users', requireAuth('users.write'), async (req:AuthedRequest,res)=>{const password=String(req.body.password||'');if(password.length<ADMIN_PASSWORD_MIN||password.length>200)return res.status(400).json({error:`The password needs ${ADMIN_PASSWORD_MIN} to 200 characters.`});const row=await prisma.user.create({data:{name:String(req.body.name),email:String(req.body.email).toLowerCase(),passwordHash:await bcrypt.hash(password,12),role:(req.body.role||'ORDER_AGENT') as Role,active:req.body.active!==false}});await audit(req,'create','User',row.id);res.status(201).json({id:row.id,name:row.name,email:row.email,role:row.role,active:row.active});});
app.patch('/api/admin/users/:id', requireAuth('users.write'), async (req:AuthedRequest,res)=>{const data:any={};for(const k of ['name','email','role','active'])if(k in req.body)data[k]=req.body[k];if(req.body.password){const nextPassword=String(req.body.password);if(nextPassword.length<ADMIN_PASSWORD_MIN||nextPassword.length>200)return res.status(400).json({error:`The password needs ${ADMIN_PASSWORD_MIN} to 200 characters.`});data.passwordHash=await bcrypt.hash(nextPassword,12);}if(req.body.resetTwoFactor===true){data.totpSecret=null;data.twoFactorReady=false;}const row=await prisma.user.update({where:{id:routeParam(req, 'id')},data});forgetAdminUser(row.id);await audit(req,req.body.resetTwoFactor===true?'reset_2fa':data.passwordHash?'reset_password':'update','User',row.id);res.json({id:row.id,name:row.name,email:row.email,role:row.role,active:row.active,twoFactorReady:row.twoFactorReady});});

app.get('/api/admin/redirects', requireAuth('settings.write'), async (_req,res)=>res.json(await prisma.redirect.findMany({orderBy:{sourcePath:'asc'}})));
app.post('/api/admin/redirects', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{if(!validAdminBody(redirectSchema,req.body,res))return;const row=await prisma.redirect.upsert({where:{sourcePath:String(req.body.sourcePath)},update:{destination:String(req.body.destination),permanent:req.body.permanent!==false},create:{sourcePath:String(req.body.sourcePath),destination:String(req.body.destination),permanent:req.body.permanent!==false}});await audit(req,'upsert','Redirect',row.id);await invalidateFrontendCache(['redirects']);res.json(row);});
app.delete('/api/admin/redirects/:id', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{await prisma.redirect.delete({where:{id:routeParam(req, 'id')}});await audit(req,'delete','Redirect',routeParam(req, 'id'));await invalidateFrontendCache(['redirects']);res.json({ok:true});});
app.get('/api/admin/session-replays', requireAuth('reports.read'),async(req,res)=>{
 if(req.query.minDuration!==undefined&&(!Number.isFinite(Number(req.query.minDuration))||Number(req.query.minDuration)<0))return res.status(400).json({error:'INVALID_DURATION'});
 const q=String(req.query.q||'').trim(),source=String(req.query.source||''),outcome=String(req.query.outcome||'all');
 const page=Math.max(1,Math.floor(Number(req.query.page)||1)),limit=Math.min(100,Math.max(10,Math.floor(Number(req.query.limit)||20)));
 const from=req.query.from?new Date(`${req.query.from}T00:00:00+05:00`):new Date(Date.now()-30*86400000),to=req.query.to?new Date(`${req.query.to}T23:59:59.999+05:00`):new Date();
 if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||from>to)return res.status(400).json({error:'INVALID_DATE_RANGE'});
 const where:Prisma.SessionReplayWhereInput={startedAt:{gte:from,lte:to},hasSnapshot:true,eventCount:{gte:2},durationMs:{gte:Math.max(10000,Number(req.query.minDuration||10)*1000)},...(source&&source!=='all'?{source}:{}),...(req.query.device?{device:String(req.query.device)}:{}),...(req.query.campaign?{campaign:{contains:String(req.query.campaign),mode:'insensitive'}}:{}),...(req.query.product?{OR:[{landingUrl:{contains:String(req.query.product),mode:'insensitive'}},{lastUrl:{contains:String(req.query.product),mode:'insensitive'}}]}:{}),...(q?{AND:[{OR:[{landingUrl:{contains:q,mode:'insensitive'}},{lastUrl:{contains:q,mode:'insensitive'}},{campaign:{contains:q,mode:'insensitive'}},{visitorId:{contains:q}}]}]}:{}),...(req.query.visitor?{visitorId:String(req.query.visitor)}:{}),...(outcome==='ordered'?{ordered:true}:outcome==='no-order'?{ordered:false}:outcome==='cart-no-order'?{reachedCart:true,ordered:false}:outcome==='checkout-no-order'?{reachedCheckout:true,ordered:false}:outcome==='live'?{status:'ACTIVE',lastSeenAt:{gte:new Date(Date.now()-60000)}}:{})};
 if(['product-no-cart','visitor-no-product'].includes(outcome)){const viewed=await prisma.eventLog.findMany({where:{eventName:'ViewContent',channel:'browser',createdAt:{gte:from,lte:to},sessionReplayId:{not:null}},distinct:['sessionReplayId'],select:{sessionReplayId:true}});where.id=outcome==='product-no-cart'?{in:viewed.map(e=>e.sessionReplayId!)}:{notIn:viewed.map(e=>e.sessionReplayId!)};where.ordered=false;if(outcome==='product-no-cart')where.reachedCart=false;}
 if(outcome==='cart-no-checkout'){where.reachedCart=true;where.reachedCheckout=false;where.ordered=false;}
 const [sessions,total,sourceGroups]=await Promise.all([prisma.sessionReplay.findMany({where,orderBy:req.query.sort==='oldest'?{startedAt:'asc'}:req.query.sort==='duration'?{durationMs:'desc'}:{startedAt:'desc'},skip:(page-1)*limit,take:limit}),prisma.sessionReplay.count({where}),prisma.sessionReplay.groupBy({by:['source'],where:{startedAt:{gte:from,lte:to}},_count:{_all:true}})]);
 const orders=await prisma.order.findMany({where:{replaySessionId:{in:sessions.map(s=>s.id)}},select:{id:true,orderNumber:true,replaySessionId:true,total:true,createdAt:true,city:true},orderBy:{createdAt:'desc'}});
 const orderMap=new Map(orders.map(o=>[o.replaySessionId,o]));
 res.json({storageConfigured:replayStorageConfigured(),total,page,totalPages:Math.max(1,Math.ceil(total/limit)),items:sessions.map(s=>({...s,orderDestination:orderMap.get(s.id)?.city||null,order:orderMap.has(s.id)?{...orderMap.get(s.id),total:Number(orderMap.get(s.id)!.total)}:null})),stats:{last30:total,ordered30:await prisma.sessionReplay.count({where:{startedAt:{gte:from,lte:to},ordered:true}}),sources:Object.fromEntries(sourceGroups.map(s=>[s.source,s._count._all]))}});
});
app.get('/api/admin/session-replays/:id/chunks/:sequence',requireAuth('reports.read'),async(req,res)=>{
 if(!Number.isInteger(Number(routeParam(req,'sequence')))||Number(routeParam(req,'sequence'))<0)return res.status(400).json({error:'INVALID_SEQUENCE'});
 const chunk=await prisma.sessionReplayChunk.findUnique({where:{sessionId_sequence:{sessionId:routeParam(req,'id'),sequence:Number(routeParam(req,'sequence'))}},select:{storageKey:true}});
 if(!chunk)return res.status(404).json({error:'NOT_FOUND'});
 setNoStore(res);if(!chunk.storageKey)return res.status(410).json({error:'RECORDING_FILE_EXPIRED'});if(!replayStorageConfigured())return res.status(503).json({error:'REPLAY_STORAGE_NOT_CONFIGURED'});{if(req.query.download==='1'){try{return res.json({events:await readReplayChunk(chunk.storageKey)})}catch(error:any){if(error?.name==='NoSuchKey'||error?.$metadata?.httpStatusCode===404)return res.status(410).json({error:'RECORDING_FILE_EXPIRED'});return res.status(503).json({error:'REPLAY_STORAGE_UNAVAILABLE'});}}return res.json({url:await replayChunkUrl(chunk.storageKey)});}
});
app.get('/api/admin/session-replays/:id',requireAuth('reports.read'),async(req,res)=>{
 const id=routeParam(req,'id');
 const checkpoint=req.query.live==='1'?await prisma.sessionReplayChunk.findFirst({where:{sessionId:id,hasSnapshot:true},select:{sequence:true},orderBy:{sequence:'desc'}}):null;
 const [session,order,markers,chunks]=await Promise.all([prisma.sessionReplay.findUnique({where:{id}}),prisma.order.findFirst({where:{replaySessionId:id},select:{id:true,orderNumber:true,total:true,createdAt:true}}),prisma.eventLog.findMany({where:{sessionReplayId:id,channel:'browser'},orderBy:{createdAt:'asc'},take:1000}),prisma.sessionReplayChunk.findMany({where:{sessionId:id,...(checkpoint?{sequence:{gte:checkpoint.sequence}}:{})},select:{sequence:true,eventCount:true,hasSnapshot:true,storageKey:true,byteSize:true,firstTimestamp:true,lastTimestamp:true},orderBy:{sequence:'asc'}})]);
 if(!session)return res.status(404).json({error:'NOT_FOUND'});setNoStore(res);
 const [width,height]=String(session.viewport||'1280x720').split('x').map(Number);
 const first=chunks[0]?.firstTimestamp;
 const bootstrap=first?{type:4,timestamp:first-1,data:{href:privateSafeUrl(session.landingUrl),width:Number.isFinite(width)&&width>0?width:1280,height:Number.isFinite(height)&&height>0?height:720}}:undefined;
 res.json({replayVersion:2,session,order:order?{...order,total:Number(order.total)}:null,markers,chunks,bootstrap,storage:replayStorageConfigured()?'private-r2':'not-configured'});
});

app.delete('/api/admin/session-replays/:id', requireAuth('reports.read'), async (req:AuthedRequest,res)=>{
  const id=routeParam(req,'id');
  const chunks=await prisma.sessionReplayChunk.findMany({where:{sessionId:id,storageKey:{not:null}},select:{storageKey:true}});
  await deleteReplayChunks(chunks.map(c=>c.storageKey!));
  await prisma.sessionReplay.deleteMany({where:{id}});
  await audit(req,'delete','SessionReplay',id);
  res.json({ok:true});
});

app.get('/api/admin/tracking/health', requireAuth('reports.read'), async (_req,res)=>res.json(await trackingHealth()));
app.post('/api/admin/jobs/:id/retry', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{
 const job=await prisma.job.findUnique({where:{id:routeParam(req,'id')}});if(!job)return res.status(404).json({error:'NOT_FOUND'});
 if(!['FAILED','SKIPPED'].includes(job.status)&&!(job.status==='QUEUED'&&Date.now()-job.createdAt.getTime()>300000))return res.status(409).json({error:'JOB_NOT_RETRYABLE'});
 await prisma.job.update({where:{id:job.id},data:{status:'QUEUED',externalId:null,error:null,finishedAt:null}});await dispatchJobRow(job.id);await audit(req,'retry','Job',job.id);res.json({ok:true});
});
app.post('/api/admin/tracking/test/:platform', requireAuth('settings.write'), async(req:AuthedRequest,res)=>{
 const platform=routeParam(req,'platform');if(!['meta','tiktok'].includes(platform))return res.status(400).json({error:'INVALID_PLATFORM'});
 const testKey=platform==='meta'?'tracking.metaTestEventCode':'tracking.tiktokTestEventCode';if(!await getSetting(testKey,''))return res.status(400).json({error:'Save a platform test event code first.'});
 try{const event={eventName:'PageView',eventId:`admin-test-${randomBytes(12).toString('hex')}`,sourceUrl:`${SITE_ORIGIN}/`,customData:{test:true}};
 const result=platform==='meta'?await sendMetaServerEvent(event):await sendTikTokServerEvent(event);await audit(req,'test_event','Tracking',platform);res.json({platform,result});}catch(error:any){res.status(502).json({error:error.message||'TEST_EVENT_FAILED'})}
});
app.get('/api/admin/jobs', requireAuth('reports.read'), async (_req,res)=>res.json(await prisma.job.findMany({orderBy:{createdAt:'desc'},take:500})));
app.get('/api/admin/tracking', requireAuth('reports.read'), async (_req,res)=>{
  const since=new Date(Date.now()-7*86400000);
  const [events,grouped,orders,settings]=await Promise.all([
    prisma.eventLog.findMany({where:{createdAt:{gte:since}},orderBy:{createdAt:'desc'},take:3000}),
    prisma.eventLog.groupBy({by:['eventName','channel'],where:{createdAt:{gte:since}},_count:{_all:true}}),
    prisma.order.count({where:{createdAt:{gte:since},test:false,staffCreated:false}}),
    getSettings([
      'tracking.metaPixelEnabled',
      'tracking.metaPixelId',
      'tracking.metaCapiEnabled',
      'tracking.metaCapiToken',
      'tracking.metaTestEventCode',
      'tracking.tiktokPixelEnabled',
      'tracking.tiktokPixelId',
      'tracking.tiktokEventsApiEnabled',
      'tracking.tiktokEventsApiToken',
      'tracking.tiktokAccessToken',
      'tracking.tiktokTestEventCode',
      'tracking.sessionReplayEnabled',
      'tracking.sessionReplayRetentionDays',
    ]),
  ]);
  const browser:Record<string,number>={};
  const server:Record<string,number>={};
  const tiktokServer:Record<string,number>={};
  for(const row of grouped){
    if(row.channel==='tiktok-server'){
      tiktokServer[row.eventName]=(tiktokServer[row.eventName]||0)+row._count._all;
    }else if(row.channel==='server'||row.channel==='meta-server'){
      server[row.eventName]=(server[row.eventName]||0)+row._count._all;
    }else{
      browser[row.eventName]=(browser[row.eventName]||0)+row._count._all;
    }
  }

  const browserIds=new Set(events.filter(e=>e.channel==='browser').map(e=>`${e.eventName}:${e.eventId}`));
  const metaServerIds=new Set(events.filter(e=>(e.channel==='server'||e.channel==='meta-server')&&e.accepted===true).map(e=>`${e.eventName}:${e.eventId}`));
  const tiktokServerIds=new Set(events.filter(e=>e.channel==='tiktok-server'&&e.accepted===true).map(e=>`${e.eventName}:${e.eventId}`));

  const pairEligibleIds=[...browserIds].filter(id=>!id.startsWith('Purchase:'));
  const pairEligible=pairEligibleIds.length;

  // Meta deduplication metrics
  const paired=pairEligibleIds.filter(id=>metaServerIds.has(id)).length;
  const dedupeCoverage=pairEligible?Math.round((paired/pairEligible)*1000)/10:100;
  const acceptedPurchases=events.filter(e=>(e.channel==='server'||e.channel==='meta-server')&&e.eventName==='Purchase'&&e.accepted===true).length;
  const purchaseCoverage=orders?Math.round((acceptedPurchases/orders)*1000)/10:100;

  // TikTok deduplication metrics
  const tiktokPaired=pairEligibleIds.filter(id=>tiktokServerIds.has(id)).length;
  const tiktokDedupeCoverage=pairEligible?Math.round((tiktokPaired/pairEligible)*1000)/10:100;
  const tiktokAcceptedPurchases=events.filter(e=>e.channel==='tiktok-server'&&e.eventName==='Purchase'&&e.accepted===true).length;
  const tiktokPurchaseCoverage=orders?Math.round((tiktokAcceptedPurchases/orders)*1000)/10:100;

  // Tracking integration statuses
  const metaPixelEnabled = settings['tracking.metaPixelEnabled'] !== false && settings['tracking.metaPixelEnabled'] !== 'false';
  const metaPixelId = String(settings['tracking.metaPixelId'] || process.env.META_PIXEL_ID || '');
  const metaPixelConfigured = Boolean(metaPixelId);

  const metaCapiEnabled = settings['tracking.metaCapiEnabled'] !== false && settings['tracking.metaCapiEnabled'] !== 'false';
  const metaCapiConfigured = Boolean(settings['tracking.metaCapiToken'] || process.env.META_CAPI_TOKEN);
  const metaTestEventCodeConfigured = Boolean(settings['tracking.metaTestEventCode'] || process.env.META_TEST_EVENT_CODE);

  const tiktokPixelEnabled = settings['tracking.tiktokPixelEnabled'] !== false && settings['tracking.tiktokPixelEnabled'] !== 'false';
  const tiktokPixelId = String(settings['tracking.tiktokPixelId'] || process.env.TIKTOK_PIXEL_ID || '');
  const tiktokPixelConfigured = Boolean(tiktokPixelId);

  const tiktokEventsApiEnabled = settings['tracking.tiktokEventsApiEnabled'] !== false && settings['tracking.tiktokEventsApiEnabled'] !== 'false';
  const tiktokEventsApiConfigured = Boolean(settings['tracking.tiktokEventsApiToken'] || settings['tracking.tiktokAccessToken'] || process.env.TIKTOK_EVENTS_API_TOKEN || process.env.TIKTOK_ACCESS_TOKEN);
  const tiktokTestEventCodeConfigured = Boolean(settings['tracking.tiktokTestEventCode'] || process.env.TIKTOK_TEST_EVENT_CODE);


  const sessionReplayEnabled = settings['tracking.sessionReplayEnabled'] !== false && settings['tracking.sessionReplayEnabled'] !== 'false';
  const sessionReplayRetentionDays = Number(settings['tracking.sessionReplayRetentionDays'] || process.env.SESSION_REPLAY_RETENTION_DAYS || 30);

  const metaLastSuccess = events.find(e=>(e.channel==='server'||e.channel==='meta-server')&&e.accepted===true)?.createdAt||null;
  const tiktokLastSuccess = events.find(e=>e.channel==='tiktok-server'&&e.accepted===true)?.createdAt||null;
  const serverErrors = events.filter(e=>(e.channel==='server'||e.channel==='meta-server'||e.channel==='tiktok-server')&&(e.error||e.accepted===false)).slice(0,100);

  res.json({
    browser,
    server,
    tiktokServer,
    orders,
    // Meta default / backward-compatible properties
    acceptedPurchases,
    purchaseCoverage,
    paired,
    pairEligible,
    dedupeCoverage,
    lastSuccess: metaLastSuccess,
    errors: serverErrors,

    // Dedicated Meta & TikTok metrics blocks
    meta: {
      server,
      acceptedPurchases,
      purchaseCoverage,
      paired,
      pairEligible,
      dedupeCoverage,
      lastSuccess: metaLastSuccess,
    },
    tiktok: {
      server: tiktokServer,
      acceptedPurchases: tiktokAcceptedPurchases,
      purchaseCoverage: tiktokPurchaseCoverage,
      paired: tiktokPaired,
      pairEligible,
      dedupeCoverage: tiktokDedupeCoverage,
      lastSuccess: tiktokLastSuccess,
    },

    // Integration status summary
    integrations: {
      metaPixel: { enabled: metaPixelEnabled, configured: metaPixelConfigured, id: metaPixelId },
      metaCapi: { enabled: metaCapiEnabled, configured: metaCapiConfigured, testEventCodeConfigured: metaTestEventCodeConfigured },
      tiktokPixel: { enabled: tiktokPixelEnabled, configured: tiktokPixelConfigured, id: tiktokPixelId },
      tiktokEventsApi: { enabled: tiktokEventsApiEnabled, configured: tiktokEventsApiConfigured, testEventCodeConfigured: tiktokTestEventCodeConfigured },
      sessionReplay: { enabled: sessionReplayEnabled, configured: replayStorageConfigured(), retentionDays: sessionReplayRetentionDays },
    },

    config: {
      pixelId: metaPixelId,
      capiConfigured: metaCapiConfigured,
      testEventCodeConfigured: metaTestEventCodeConfigured,
      appEnv: process.env.APP_ENV || 'development',
      metaPixel: { enabled: metaPixelEnabled, configured: metaPixelConfigured, id: metaPixelId },
      metaCapi: { enabled: metaCapiEnabled, configured: metaCapiConfigured, testEventCodeConfigured: metaTestEventCodeConfigured },
      tiktokPixel: { enabled: tiktokPixelEnabled, configured: tiktokPixelConfigured, id: tiktokPixelId },
      tiktokEventsApi: { enabled: tiktokEventsApiEnabled, configured: tiktokEventsApiConfigured, testEventCodeConfigured: tiktokTestEventCodeConfigured },
      sessionReplay: { enabled: sessionReplayEnabled, configured: replayStorageConfigured(), retentionDays: sessionReplayRetentionDays },
    },
  });
});
app.get('/api/admin/cro', requireAuth('reports.read'), async (_req,res)=>{
  const since=new Date(Date.now()-30*86400000);
  const [orders,eventGroups,abandonedRows]=await Promise.all([
    prisma.order.findMany({where:{createdAt:{gte:since}},select:{total:true,source:true,firstTouch:true,lastTouch:true}}),
    prisma.eventLog.groupBy({by:['eventName'],where:{createdAt:{gte:since},channel:'browser'},_count:{_all:true}}),
    prisma.abandonedCheckout.findMany({where:{createdAt:{gte:since}},select:{convertedAt:true}}),
  ]);
  const events=Object.fromEntries(eventGroups.map(e=>[e.eventName,e._count._all]));
  const views=Number(events.ViewContent||0);
  const addToCart=Number(events.AddToCart||0);
  const checkout=Number(events.InitiateCheckout||0);
  const orderCount=orders.length;
  const revenue=orders.reduce((sum,o)=>sum+Number(o.total),0);
  const rate=(part:number,total:number)=>total>0?(part/total)*100:0;
  const bySource=new Map<string,{orders:number,revenue:number}>();
  for(const order of orders){
    const first=(order.firstTouch&&typeof order.firstTouch==='object'?order.firstTouch:{}) as any;
    const last=(order.lastTouch&&typeof order.lastTouch==='object'?order.lastTouch:{}) as any;
    const source=normalizeTrafficSource(order.source||last.utm_source||first.utm_source||'direct');
    const row=bySource.get(source)||{orders:0,revenue:0};
    row.orders+=1; row.revenue+=Number(order.total); bySource.set(source,row);
  }
  const sources=[...bySource.entries()].map(([source,value])=>({source,...value})).sort((a,b)=>b.orders-a.orders);
  const abandoned=abandonedRows.length;
  const recovered=abandonedRows.filter(row=>row.convertedAt).length;
  const viewToCart=rate(addToCart,views);
  const cartToCheckout=rate(checkout,addToCart);
  const checkoutToOrder=rate(orderCount,checkout);
  const overallConversion=rate(orderCount,views);
  const recoveryRate=rate(recovered,abandoned);
  const opportunities:Array<{level:string;title:string;detail:string}>=[];
  if(views>=20&&viewToCart<8) opportunities.push({level:'high',title:'Product page → cart drop-off',detail:`Only ${viewToCart.toFixed(1)}% of product views become Add to Cart. Test stronger above-the-fold CTA, clearer price/offer, delivery promise, reviews and trust proof.`});
  if(addToCart>=10&&cartToCheckout<45) opportunities.push({level:'high',title:'Cart → checkout drop-off',detail:`${cartToCheckout.toFixed(1)}% of carts reach checkout. Reduce distractions, make delivery/COD terms obvious and keep the checkout CTA visible.`});
  if(checkout>=10&&checkoutToOrder<55) opportunities.push({level:'high',title:'Checkout completion is weak',detail:`${checkoutToOrder.toFixed(1)}% of initiated checkouts become orders. Review field count, validation errors, mobile form friction and COD confidence messaging.`});
  if(abandoned>=5&&recoveryRate<15) opportunities.push({level:'medium',title:'Recover more abandoned checkouts',detail:`Recovery is ${recoveryRate.toFixed(1)}%. Prioritize WhatsApp follow-up and measure recovered revenue by source/campaign.`});
  if(orderCount>0&&sources.length&&sources[0].source==='direct') opportunities.push({level:'medium',title:'Improve attribution coverage',detail:'Direct is the largest order source. Keep UTM parameters on Facebook/Instagram ads and links so CRO decisions can be split by channel and campaign.'});
  if(!opportunities.length&&views>=20) opportunities.push({level:'low',title:'Funnel is collecting usable data',detail:'Keep testing one variable at a time through Experiments and compare conversion rate, not just clicks.'});
  res.json({periodDays:30,views,addToCart,checkout,orders:orderCount,revenue,viewToCart,cartToCheckout,checkoutToOrder,overallConversion,abandoned,recovered,recoveryRate,averageOrderValue:orderCount?revenue/orderCount:0,sources,opportunities});
});

app.get('/api/admin/reports', requireAuth('reports.read'), async (_req,res)=>{
  const since=new Date(Date.now()-30*86400000);
  const [orders,eventGroups,eventRows]=await Promise.all([
    prisma.order.findMany({where:{createdAt:{gte:since}},include:{items:true}}),
    prisma.eventLog.groupBy({by:['eventName'],where:{createdAt:{gte:since},channel:'browser'},_count:{_all:true}}),
    prisma.eventLog.findMany({where:{createdAt:{gte:since},channel:'browser',eventName:{in:['ViewContent','AddToCart']}},select:{eventName:true,payload:true},take:10000}),
  ]);
  const products=new Map<string,{title:string,qty:number,revenue:number,views:number,carts:number,orders:number}>();
  const ensure=(sku:string,title=sku)=>{const row=products.get(sku)||{title,qty:0,revenue:0,views:0,carts:0,orders:0};products.set(sku,row);return row;};
  for(const o of orders){const ordered=new Set<string>();for(const i of o.items){const row=ensure(i.sku,i.title);row.qty+=i.quantity;row.revenue+=Number(i.lineTotal);ordered.add(i.sku);}for(const sku of ordered)ensure(sku).orders+=1;}
  for(const e of eventRows){
    const payload=(e.payload&&typeof e.payload==='object'&&!Array.isArray(e.payload)
      ? e.payload
      : {}) as Record<string,unknown>;
    const params=(payload.params&&typeof payload.params==='object'&&!Array.isArray(payload.params)
      ? payload.params
      : {}) as Record<string,unknown>;
    const ids:string[]=Array.isArray(params.content_ids)
      ? params.content_ids.map((id:unknown)=>String(id))
      : [];
    for(const sku of new Set<string>(ids)){
      const row=ensure(sku);
      if(e.eventName==='ViewContent') row.views+=1;
      if(e.eventName==='AddToCart') row.carts+=1;
    }
  }
  const productRows=[...products.entries()].map(([sku,v])=>({sku,...v,viewToCart:v.views?Math.round(v.carts/v.views*1000)/10:0,orderRate:v.views?Math.round(v.orders/v.views*1000)/10:0})).sort((a,b)=>b.revenue-a.revenue);
  res.json({orders:orders.length,revenue:orders.reduce((s,o)=>s+Number(o.total),0),events:Object.fromEntries(eventGroups.map(e=>[e.eventName,e._count._all])),products:productRows});
});
app.get('/api/admin/marketing', requireAuth('reports.read'), async (_req,res)=>{
  const since=new Date(Date.now()-30*86400000);
  const orders=await prisma.order.findMany({where:{createdAt:{gte:since}},orderBy:{createdAt:'desc'},take:1000,select:{id:true,orderNumber:true,fullName:true,total:true,source:true,firstTouch:true,lastTouch:true,createdAt:true}});
  const bySource=new Map<string,{orders:number,revenue:number}>();
  for(const order of orders){
    const last=(order.lastTouch&&typeof order.lastTouch==='object'&&!Array.isArray(order.lastTouch)?order.lastTouch:{}) as Record<string,unknown>;
    const first=(order.firstTouch&&typeof order.firstTouch==='object'&&!Array.isArray(order.firstTouch)?order.firstTouch:{}) as Record<string,unknown>;
    const source=normalizeTrafficSource(order.source||last.utm_source||first.utm_source||'direct');
    const row=bySource.get(source)||{orders:0,revenue:0};row.orders+=1;row.revenue+=Number(order.total);bySource.set(source,row);
  }
  const sources=[...bySource.entries()].map(([source,v])=>({source,...v})).sort((a,b)=>b.orders-a.orders);
  const recent=orders.slice(0,50).map(order=>{
    const last=(order.lastTouch&&typeof order.lastTouch==='object'&&!Array.isArray(order.lastTouch)?order.lastTouch:{}) as Record<string,unknown>;
    const first=(order.firstTouch&&typeof order.firstTouch==='object'&&!Array.isArray(order.firstTouch)?order.firstTouch:{}) as Record<string,unknown>;
    return {id:order.id,orderNumber:order.orderNumber,fullName:order.fullName,total:Number(order.total),createdAt:order.createdAt,source:normalizeTrafficSource(order.source||last.utm_source||first.utm_source||'direct'),medium:String(last.utm_medium||first.utm_medium||''),campaign:String(last.utm_campaign||first.utm_campaign||''),content:String(last.utm_content||first.utm_content||''),adId:String(last.ad_id||first.ad_id||''),adsetId:String(last.adset_id||first.adset_id||''),campaignId:String(last.campaign_id||last.utm_id||first.campaign_id||first.utm_id||'')};
  });
  const config=await getMetaMarketingConfig();
  let meta:any={configured:Boolean(config.accessToken&&config.adAccountId),ads:[],currency:null,adAccountName:null,error:null};
  if(meta.configured){try{meta=await fetchMetaAds();}catch(error:any){meta={...meta,error:error?.message||'META_API_ERROR'};}}
  res.json({periodDays:30,totalOrders:orders.length,totalRevenue:orders.reduce((sum,o)=>sum+Number(o.total),0),facebookOrders:sources.find(x=>x.source==='facebook')?.orders||0,instagramOrders:sources.find(x=>x.source==='instagram')?.orders||0,attributedOrders:orders.filter(o=>normalizeTrafficSource(o.source)!=='direct').length,sources,recent,meta:{...meta,pixelId:config.pixelId,adAccountId:config.adAccountId,pageId:config.pageId,instagramAccountId:config.instagramAccountId,accessTokenConfigured:Boolean(config.accessToken)}});
});
app.put('/api/admin/marketing/meta', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{
  const b=req.body||{};
  const updates:Record<string,unknown>={
    'tracking.metaPixelId':String(b.pixelId||'').trim(),
    'marketing.meta.adAccountId':String(b.adAccountId||'').trim(),
    'marketing.meta.pageId':String(b.pageId||'').trim(),
    'marketing.meta.instagramAccountId':String(b.instagramAccountId||'').trim(),
  };
  if(String(b.accessToken||'').trim()) updates['marketing.meta.accessToken']=String(b.accessToken).trim();
  for(const [key,value] of Object.entries(updates)) await setSetting(key,value);
  await audit(req,'update','MetaMarketing',undefined,{keys:Object.keys(updates).filter(key=>!isSensitiveSettingKey(key))});
  await invalidateFrontendCache(['settings','store']);
  res.json({ok:true,accessTokenConfigured:Boolean(String(b.accessToken||'').trim()||(await getMetaMarketingConfig()).accessToken)});
});
app.post('/api/admin/marketing/meta/test', requireAuth('settings.write'), async (_req,res)=>{try{res.json({ok:true,details:await testMetaMarketingConnection()});}catch(error:any){res.status(400).json({error:'META_CONNECTION_FAILED',message:error?.message||'Unable to connect to Meta'});}});



// CSV import. Create-only: a row whose SKU, slug or title (or a variation SKU) matches an
// existing product, drafts included, is rejected as "Already exists". New products are DRAFTS.
// Categories are never created: each row needs one of the store's categories, matched from
// the CSV cell or chosen in the preview (`categoryByRow`: { [row]: categoryId }).
// `dryRun: true` validates and reports what would happen without writing anything.
app.post('/api/admin/products/import', requireAuth('products.write'), async (req:AuthedRequest,res)=>{
  const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
  const dryRun=Boolean(req.body?.dryRun);
  const categoryByRow:Record<string,string>=req.body?.categoryByRow&&typeof req.body.categoryByRow==='object'?req.body.categoryByRow:{};
  const categories=await prisma.category.findMany({orderBy:[{sortOrder:'asc'},{name:'asc'}],select:{id:true,name:true,slug:true}});
  // Removed or unknown columns are ignored with a warning; only a missing required column rejects the file.
  const headers:string[]=Array.isArray(req.body?.headers)?req.body.headers.map(String):[...new Set<string>(rows.flatMap((r:any)=>Object.keys(r||{})))].filter(k=>k!=='__row');
  const {errors:fileErrors,warnings:fileWarnings}=validateHeaders(headers);
  if(!rows.length) fileErrors.push('The file has no product rows.');
  if(rows.length>5000) fileErrors.push('The file has more than 5,000 rows. Split it into smaller files.');
  if(fileErrors.length) return res.status(dryRun?200:400).json({error:'INVALID_TEMPLATE',message:fileErrors.join(' '),fileErrors,fileWarnings,categories,created:0,exists:0,skipped:0,errors:fileErrors,dryRun,results:[]});
  const planned=planImport(rows, Number(req.body?.firstRow)||2);
  const categoryByKey=new Map<string,{id:string;name:string;slug:string}>();
  for(const c of categories){categoryByKey.set(c.slug.toLowerCase(),c);categoryByKey.set(c.name.trim().toLowerCase(),c);categoryByKey.set(importSlugify(c.name),c);}
  const categoryById=new Map(categories.map(c=>[c.id,c]));
  // Everything already in the shop (drafts included), for the "Already exists" check.
  const [existingProducts,existingVariants]=await Promise.all([
    prisma.product.findMany({select:{id:true,sku:true,slug:true,title:true}}),
    prisma.variant.findMany({select:{sku:true,product:{select:{title:true}}}}),
  ]);
  const productBySku=new Map(existingProducts.map(p=>[p.sku.toLowerCase(),p]));
  const productBySlug=new Map(existingProducts.map(p=>[p.slug.toLowerCase(),p]));
  const productByTitle=new Map(existingProducts.map(p=>[importTitleKey(p.title),p]));
  const variantBySku=new Map(existingVariants.map(v=>[v.sku.toLowerCase(),v.product.title]));
  const results:any[]=[]; const tags=new Set(['products','featured-products','categories','store']);
  for(const product of planned){
    const cellCategory=product.cells.category||'';
    const matched=cellCategory?(categoryByKey.get(cellCategory.trim().toLowerCase())||categoryByKey.get(importSlugify(cellCategory))):undefined;
    const chosenId=categoryByRow[String(product.row)];
    const category=(chosenId?categoryById.get(String(chosenId)):undefined)||matched||null;
    const warnings=[...product.warnings];
    // Shown in red under the Category dropdown until one of the store's categories is picked.
    const categoryError=cellCategory&&!matched?`Category "${cellCategory}" is not one of the store's categories. Choose one from the list.`:'';
    const result:any={row:product.row,sku:product.sku,title:product.title,productType:product.productType,variations:product.variations.length,warnings,errors:[...product.errors],action:'error',id:null,status:null,slug:product.slug||null,category:cellCategory,categoryId:category?.id||null,categoryError};
    results.push(result);
    if(result.errors.length){result.errors.push(...product.duplicates);continue;}
    const exists:string[]=[...product.duplicates];
    const sku=product.sku.toLowerCase();
    if(productBySku.has(sku)) exists.push(`SKU "${product.sku}" is used by "${productBySku.get(sku)!.title}".`);
    else if(variantBySku.has(sku)) exists.push(`SKU "${product.sku}" is used by a variation of "${variantBySku.get(sku)}".`);
    const bySlug=product.slug?productBySlug.get(product.slug):undefined;
    if(bySlug) exists.push(`Slug "${product.slug}" is used by "${bySlug.title}".`);
    const byTitle=productByTitle.get(importTitleKey(product.title));
    if(byTitle) exists.push(`Title matches "${byTitle.title}" (SKU ${byTitle.sku}).`);
    for(const variation of product.variations){
      const key=variation.sku.toLowerCase();
      const owner=variantBySku.get(key)||productBySku.get(key)?.title;
      if(owner) exists.push(`Variation SKU "${variation.sku}" is used by "${owner}".`);
    }
    if(exists.length){result.action='exists';result.errors=[`Already exists. ${exists.join(' ')}`];continue;}
    result.status='DRAFT';
    if(dryRun){result.action='create';continue;}
    if(!category){result.errors.push('Choose a category for this row.');continue;}
    try{
      const write=buildProductWrite(product);
      const data:any={...write.columns,slug:write.slug,sku:product.sku,status:'DRAFT',categoryId:category.id,sourceUrl:writeCatalogMeta(write.meta)};
      for(const k of ['price','salePrice','bundleDiscountPercent']) if(k in data) data[k]=data[k]==null?null:new Prisma.Decimal(Number(data[k]));
      const row=await prisma.$transaction(async(tx)=>{
        const saved=await tx.product.create({data});
        if(write.variants.length) await writeVariants(tx,saved.id,write.variants);
        return saved;
      }, PRODUCT_TX_OPTIONS);
      await syncProductRedirect({slug:row.slug,status:row.status,redirectFallback:true,custom:previousCustomRedirect(write.meta,row.slug),previousCustom:null});
      tags.add(`product:${row.slug}`); tags.add(`category:${category.slug}`);
      productBySku.set(sku,row); productBySlug.set(row.slug,row); productByTitle.set(importTitleKey(row.title),row);
      result.action='created'; result.id=row.id; result.status=row.status; result.slug=row.slug;
    }catch(e:any){
      result.action='error'; result.errors.push(e?.code==='P2002'?`Already exists: a product or variation with the same ${(e?.meta?.target||['sku']).join(', ')} is in the shop.`:(e?.message||'Import failed'));
    }
  }
  const count=(action:string)=>results.filter(r=>r.action===action).length;
  const summary={created:count(dryRun?'create':'created'),exists:count('exists'),skipped:count('error')+count('exists'),errors:results.filter(r=>r.action==='error'||r.action==='exists').map(r=>`Row ${r.row}: ${r.errors.join(' ')}`)};
  if(!dryRun){await audit(req,'csv_import','Product',undefined,{...summary,errors:summary.errors.slice(0,25)}); await invalidateFrontendCache([...tags]);}
  res.json({...summary,dryRun,fileWarnings,categories,results});
});
app.get('/api/admin/product-import/template/:kind', requireAuth('products.write'), (req,res)=>{
  const kind=routeParam(req,'kind').replace(/\.csv$/i,'')==='variable'?'variable':'simple';
  res.type('text/csv').setHeader('Content-Disposition',`attachment; filename="zelvomart-${kind}-products-template.csv"`);
  res.send(templateCsv(kind));
});
// Post or un-post many products in one click (used after a CSV import and on the drafts list).
app.post('/api/admin/products/bulk-status', requireAuth('products.write'), async (req:AuthedRequest,res)=>{
  const ids=(Array.isArray(req.body?.ids)?req.body.ids:[]).map(String).slice(0,1000);
  const status=String(req.body?.status||'').toUpperCase();
  if(!ids.length||!['DRAFT','PUBLISHED'].includes(status)) return res.status(400).json({error:'INVALID_REQUEST'});
  const rows=await prisma.product.findMany({where:{id:{in:ids}},include:{category:{select:{slug:true}}}});
  const updated:string[]=[]; const failed:{id:string;title:string;error:string}[]=[]; const tags=new Set(['products','featured-products','categories','store','redirects']);
  for(const row of rows){
    if(status==='PUBLISHED'&&Number(row.price)<=0){failed.push({id:row.id,title:row.title,error:'Add a regular price before posting.'});continue;}
    try{
      if(row.status!==status) await prisma.product.update({where:{id:row.id},data:{status:status as ProductStatus}});
      const meta=readCatalogMeta(row.sourceUrl)||{};
      await syncProductRedirect({slug:row.slug,status,redirectFallback:meta.redirectFallback!==false,custom:previousCustomRedirect(meta,row.slug),previousCustom:previousCustomRedirect(meta,row.slug)});
      updated.push(row.id); tags.add(`product:${row.slug}`); if(row.category?.slug) tags.add(`category:${row.category.slug}`);
    }catch(e:any){failed.push({id:row.id,title:row.title,error:e?.message||'Update failed'});}
  }
  await audit(req,'bulk_status','Product',undefined,{status,updated:updated.length,failed:failed.length});
  await invalidateFrontendCache([...tags]);
  res.json({status,updated,failed});
});
app.post('/api/admin/products/bulk-delete', requireAuth('products.write'), async (req:AuthedRequest,res)=>{
  const ids=(Array.isArray(req.body?.ids)?req.body.ids:[]).map(String).filter(Boolean).slice(0,200);
  if(!ids.length) return res.status(400).json({error:'INVALID_REQUEST'});
  const deleted:string[]=[]; const failed:{id:string;error:string}[]=[]; const tags=new Set(['products','featured-products','categories','store','redirects']);
  for(const id of ids){
    try{
      const row=await deleteProductRecord(id);
      if(!row){failed.push({id,error:'NOT_FOUND'});continue;}
      deleted.push(id); tags.add(`product:${row.slug}`);
    }catch(e:any){failed.push({id,error:e?.message||'Delete failed'});}
  }
  await audit(req,'bulk_delete','Product',undefined,{deleted:deleted.length,failed:failed.length});
  await invalidateFrontendCache([...tags]);
  res.json({deleted,failed});
});
// Attach already-uploaded image URLs to a product and its variations (bulk image ZIP upload).
app.post('/api/admin/products/:id/images', requireAuth('products.write'), async (req:AuthedRequest,res)=>{
  try{
    const id=routeParam(req,'id');
    const product=await prisma.product.findUnique({where:{id},include:{variants:true}});
    if(!product) return res.status(404).json({error:'NOT_FOUND'});
    const b=req.body||{};
    const replace=b.mode==='replace';
    const urls=(value:unknown)=>(Array.isArray(value)?value:[]).filter((x:unknown):x is string=>typeof x==='string'&&/^(https?:\/\/|\/)/.test(x));
    const merge=(current:string[],next:string[],max:number)=>[...new Set(replace&&next.length?next:[...current,...next])].slice(0,max);
    const current=Array.isArray(product.images)?(product.images as unknown[]).filter((x):x is string=>typeof x==='string'):[];
    // featuredFirst: the upload's first image (the one named "1") becomes the main image, ahead of the existing ones.
    const incoming=urls(b.images);
    const images=b.featuredFirst&&!replace&&incoming.length?[...new Set([incoming[0],...current,...incoming.slice(1)])].slice(0,MAX_PRODUCT_IMAGES):merge(current,incoming,MAX_PRODUCT_IMAGES);
    const meta:any=readCatalogMeta(product.sourceUrl);
    const variantImages=b.variantImages&&typeof b.variantImages==='object'?b.variantImages as Record<string,unknown>:{};
    const variantUpdates:{id:string;imageUrl:string}[]=[];
    for(const variant of product.variants){
      const next=urls(variantImages[variant.id]);
      if(!next.length) continue;
      const extras=Array.isArray(meta?.variations)?meta.variations.find((item:any)=>(item.sku&&item.sku===variant.sku)||(item.name&&item.name===variant.name)):null;
      const before=extras&&Array.isArray(extras.images)?extras.images.filter((x:unknown)=>typeof x==='string'&&x):variant.imageUrl?[variant.imageUrl]:[];
      const merged=merge(before,next,MAX_VARIATION_IMAGES);
      if(extras) extras.images=merged;
      variantUpdates.push({id:variant.id,imageUrl:merged[0]});
    }
    await prisma.$transaction(async(tx)=>{
      await tx.product.update({where:{id},data:{images,...(meta&&variantUpdates.length?{sourceUrl:writeCatalogMeta(meta)}:{})}});
      for(const update of variantUpdates) await tx.variant.update({where:{id:update.id},data:{imageUrl:update.imageUrl}});
    }, PRODUCT_TX_OPTIONS);
    await audit(req,'bulk_images','Product',id,{images:images.length,variants:variantUpdates.length,mode:replace?'replace':'append'});
    await invalidateFrontendCache(await catalogCacheTags(product.slug,product.categoryId));
    res.json(await loadAdminProduct(id));
  }catch(error:any){
    res.status(400).json({error:error?.message||'PRODUCT_IMAGES_FAILED'});
  }
});
// Images are converted to WebP in the browser first (frontend/lib/image-convert.ts).
// Each file is stored in R2 as products/<sha256>.<ext>: the same image uploaded again gets
// the same URL, so the admin can skip it as a duplicate. There is no local-disk fallback:
// on Vercel those files disappear after a restart.
const UPLOAD_EXTENSIONS:Record<string,string>={'image/webp':'webp','image/gif':'gif','image/jpeg':'jpg','image/png':'png','image/avif':'avif'};
app.post('/api/admin/upload', requireAuth('products.write'), (req,res,next)=>{
  upload.single('file')(req,res,(err:any)=>{
    if(!err) return next();
    const tooLarge=err?.code==='LIMIT_FILE_SIZE';
    res.status(tooLarge?413:400).json({error:tooLarge?'FILE_TOO_LARGE':'UPLOAD_FAILED',message:tooLarge?'Unable to upload: the image is larger than 4 MB after conversion.':`Unable to upload: ${err?.message||'the file could not be read'}.`});
  });
}, async (req,res)=>{
  if(!req.file) return res.status(400).json({error:'FILE_REQUIRED',message:'Unable to upload: no file was received.'});
  const ext=UPLOAD_EXTENSIONS[req.file.mimetype];
  if(!ext) return res.status(400).json({error:'IMAGE_REQUIRED',message:'Unable to upload: only JPG, PNG, WEBP or GIF images are allowed.'});
  if(!isCloudStorageConfigured()) return res.status(503).json({error:'STORAGE_NOT_CONFIGURED',message:'Unable to upload: image storage (Cloudflare R2) is not configured on the backend. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_BASE_URL.'});
  try {
    const hash=createHash('sha256').update(req.file.buffer).digest('hex');
    const url=await uploadObject(`products/${hash}.${ext}`,req.file.buffer,req.file.mimetype);
    let feedImageUrl:string|undefined;try{feedImageUrl=await saveCatalogImage(url,req.file.buffer)}catch(error){console.error('Catalog JPG copy failed; backfill can retry',error instanceof Error?error.message:error)}
    res.json({url,hash,feedImageUrl});
  } catch (error:any) {
    const status=error instanceof StorageError&&error.code==='STORAGE_NOT_CONFIGURED'?503:502;
    res.status(status).json({error:error?.code||'UPLOAD_FAILED',message:error?.message||'Unable to upload: Cloudflare R2 did not accept the image.'});
  }
});

app.use((err:any,req:any,res:any,_next:any)=>{
  if(err?.code==='P1001'||err?.code==='P1002'){console.error(`[db] unreachable for ${req.method} ${req.path} - check internet/DNS and DATABASE_URL`);res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'DATABASE_UNAVAILABLE'});}
  if(err?.message==='CORS_NOT_ALLOWED'){res.setHeader('Cache-Control','no-store');return res.status(403).json({error:'CORS_NOT_ALLOWED',message:'Add this site origin to FRONTEND_URL on the backend.'});}
  if(err?.message==='JWT_SECRET is not configured'){console.error('[config] JWT_SECRET is not set in the backend environment');res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'BACKEND_MISCONFIGURED',missing:['JWT_SECRET']});}
  console.error(err);res.status(500).json({error:'SERVER_ERROR',message:process.env.NODE_ENV==='development'?err?.message:undefined});});
export { app };
export default app;
if (!process.env.VERCEL) app.listen(port,()=>console.log(`Zelvomart backend listening on http://localhost:${port}`));
