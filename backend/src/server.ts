import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { Prisma, ProductStatus, OrderStatus, Role, ReviewStatus, ExperimentStatus } from './generated/prisma/client';
import { prisma } from './lib/db';
import { signAdminToken, requireAuth, type AuthedRequest } from './lib/auth';
import { createOrder, restoreOrderStock } from './lib/order';
import { checkoutSchema } from './lib/validators';
import { getSetting, getSettings, setSetting } from './lib/settings';
import { postexTrackingUrl } from './lib/postex';
import { getLocalUploadDir, StorageError, uploadObject } from './lib/storage';
import { sendMetaServerEvent } from './lib/meta';
import { fetchMetaAds, getMetaMarketingConfig, testMetaMarketingConnection } from './lib/meta-marketing';
import { invalidateFrontendCache } from './lib/cache-invalidation';
import { sanitizeGlobalProductTabs, sanitizeProductTabOverrides } from './lib/catalog-meta';
import { productBadges } from './lib/product-badges';
import { BUY_TWO_DISCOUNT_PERCENT, priceSummary, variantPriceSummary } from './lib/pricing';
import { sendContactTeamEmail } from './lib/email';
import { consumeRateLimit, requestIp, isLikelyBot } from './lib/rate-limit';
import { dispatchJobRow } from './lib/jobs';
import { buildProductWrite, MAX_PRODUCT_IMAGES, MAX_VARIATION_IMAGES, planImport, slugify as importSlugify, templateCsv, validateHeaders } from './lib/product-import';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const port = Number(process.env.PORT || 4000);
// Without a database URL nothing can work. Answer every request with the missing variable name
// (never its value) so a misconfigured deployment explains itself instead of crashing.
if (!process.env.DATABASE_URL) {
  console.error('[config] DATABASE_URL is not set in the backend environment');
  app.use((_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ ok: false, error: 'BACKEND_MISCONFIGURED', missing: ['DATABASE_URL'] }); });
}
const frontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(v => v.trim()).filter(Boolean);
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
    const site = new URL(`${(process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com").replace(/\/$/, "")}/`);
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
  const next: Record<string, any> = { ...(meta as Record<string, any>) };
  if (next.productTabs && typeof next.productTabs === 'object') {
    next.productTabs = sanitizeProductTabOverrides(next.productTabs);
  }
  next.redirectUrl = normalizeRedirectDestination(next.redirectUrl);
  if (!next.redirectUrl) delete next.redirectUrl;
  return JSON.stringify({ zvmCatalog: next });
}

async function syncProductRedirect(options: { slug: string; previousSlug?: string; status: string; redirectFallback: boolean; redirectUrl?: string }) {
  const shop = '/shop';
  const current = `/product/${options.slug}/`;
  const custom = normalizeRedirectDestination(options.redirectUrl);
  if (options.previousSlug && options.previousSlug !== options.slug) {
    const from = `/product/${options.previousSlug}/`;
    const destination = custom || (options.status === 'PUBLISHED' ? current : shop);
    await prisma.redirect.upsert({
      where: { sourcePath: from },
      update: { destination, permanent: true },
      create: { sourcePath: from, destination, permanent: true },
    });
  }
  if (custom) {
    await prisma.redirect.upsert({
      where: { sourcePath: current },
      update: { destination: custom, permanent: true },
      create: { sourcePath: current, destination: custom, permanent: true },
    });
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

function jsonProduct(row: any) {
  const pricing = priceSummary(row.price, row.salePrice);
  const images = Array.isArray(row.images) ? row.images.filter((x: unknown) => typeof x === 'string') : [];
  const catalog = readCatalogMeta(row.sourceUrl) || {};
  const imageAlt = String(catalog.imageMeta?.alt || row.title || '');
  const reviews = (row.reviews || []).map((review: any) => ({ id: review.id, name: review.name, rating: review.rating, body: review.body, verified: review.verified, createdAt: review.createdAt?.toISOString?.() || review.createdAt }));
  const averageRating = reviews.length ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length : undefined;
  return {
    id: row.id, slug: row.slug, name: row.title, title: row.title, sku: row.sku,
    categories: row.category ? [{ id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description, image: row.category.imageUrl }] : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    category: row.category || null,
    ...pricing, salePrice: row.salePrice == null ? null : Number(row.salePrice),
    stockStatus: row.stock > 0 || (row.variants || []).some((v: any) => v.stock > 0) ? 'instock' : 'outofstock',
    stockQuantity: row.stock, stock: row.stock, featured: row.featured, averageRating, reviewCount: reviews.length,
    image: images[0], images: images.map((src: string) => ({ src, alt: imageAlt })), rawImages: images,
    tags: Array.isArray(catalog.tags) ? catalog.tags : [], brand: catalog.brand || null,
    badges: productBadges(catalog), freeShipping: Boolean(catalog.freeShipping),
    buyTwoDiscountPercent: BUY_TWO_DISCOUNT_PERCENT,
    shortDescription: row.shortDescription, description: row.descriptionHtml, descriptionHtml: row.descriptionHtml,
    videoUrl: row.videoUrl, permalink: `/product/${row.slug}/`, hasOptions: (row.variants || []).length > 0,
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
        shippingClass: extras.shippingClass || "",
        downloadable: Boolean(extras.downloadable),
        virtual: Boolean(extras.virtual),
        stockStatus: extras.stockStatus || v.attributes?.stockStatus || (Number(v.stock) > 0 ? "instock" : "outofstock"),
      };
    }),
    bundleEnabled: row.bundleEnabled, bundleDiscountPercent: BUY_TWO_DISCOUNT_PERCENT, reviews,
    seoTitle: row.seoTitle, seoDescription: row.seoDescription, canonicalUrl: row.canonicalUrl, catalogMeta: readCatalogMeta(row.sourceUrl),
    costPrice: row.costPrice == null ? null : Number(row.costPrice), status: row.status, categoryId: row.categoryId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

const productInclude = { category: true, variants: { where: { active: true }, orderBy: { createdAt: 'asc' as const } }, reviews: { where: { status: 'APPROVED' as const }, orderBy: { createdAt: 'desc' as const } } };

const productListSelect = {
  id: true, slug: true, title: true, sku: true, images: true, price: true, salePrice: true, stock: true, featured: true, sourceUrl: true,
  shortDescription: true, bundleEnabled: true, bundleDiscountPercent: true,
  category: { select: { id: true, name: true, slug: true, description: true, imageUrl: true, seoTitle: true, seoDescription: true } },
  variants: { where: { active: true }, select: { id: true, sku: true, name: true, stock: true, priceOverride: true, imageUrl: true, attributes: true } },
  reviews: { where: { status: 'APPROVED' as const }, select: { rating: true } },
} satisfies Prisma.ProductSelect;

function jsonProductSummary(row: any) {
  const pricing = priceSummary(row.price, row.salePrice);
  const images = Array.isArray(row.images) ? row.images.filter((x: unknown) => typeof x === 'string') : [];
  const catalog = readCatalogMeta(row.sourceUrl) || {};
  const reviewCount = Array.isArray(row.reviews) ? row.reviews.length : 0;
  const averageRating = reviewCount ? row.reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviewCount : undefined;
  const hasOptions = Array.isArray(row.variants) && row.variants.length > 0;
  const variantInStock = hasOptions && row.variants.some((v: any) => Number(v.stock || 0) > 0);
  return {
    id: row.id, slug: row.slug, name: row.title, title: row.title, sku: row.sku,
    categories: row.category ? [{ id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description, image: row.category.imageUrl }] : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    ...pricing, salePrice: row.salePrice == null ? null : Number(row.salePrice),
    stockStatus: row.stock > 0 || variantInStock ? 'instock' : 'outofstock',
    stockQuantity: row.stock, featured: row.featured, averageRating, reviewCount,
    image: images[0], images: images[0] ? [{ src: images[0], alt: String(catalog.imageMeta?.alt || row.title || '') }] : [],
    tags: Array.isArray(catalog.tags) ? catalog.tags : [], brand: catalog.brand || null,
    badges: productBadges(catalog), freeShipping: Boolean(catalog.freeShipping),
    buyTwoDiscountPercent: BUY_TWO_DISCOUNT_PERCENT,
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
      stock: Number(variant.stock || 0), imageUrl: variant.imageUrl || null, images: variant.imageUrl ? [variant.imageUrl] : [], active: true,
    })), bundleEnabled: row.bundleEnabled,
    bundleDiscountPercent: BUY_TWO_DISCOUNT_PERCENT, reviews: [],
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
  return row ? jsonProduct(row) : null;
}

async function writeVariants(tx: Prisma.TransactionClient, productId: string, variants: any[]) {
  await tx.variant.deleteMany({ where: { productId } });
  const used = new Set<string>();
  for (const variant of variants) {
    const sku = String(variant?.sku || '').trim();
    const name = String(variant?.name || '').trim();
    if (!sku || !name || used.has(sku)) continue;
    used.add(sku);
    await tx.variant.create({
      data: {
        productId,
        sku,
        name,
        attributes: variant.attributes || {},
        priceOverride: variant.priceOverride ? new Prisma.Decimal(Number(variant.priceOverride)) : null,
        stock: Number(variant.stock || 0),
        imageUrl: variant.imageUrl || null,
        active: variant.active !== false,
      },
    });
  }
}

const META_EVENT_NAMES = new Set(['PageView','ViewContent','Search','AddToCart','InitiateCheckout','Purchase','Contact','Lead']);

let replayCleanupAt = 0;
async function maybeCleanupOldSessionReplays() {
  const settingDays = await getSetting<number | string | null>('tracking.sessionReplayRetentionDays', null).catch(() => null);
  const parsedSettingDays = settingDays !== null && settingDays !== undefined ? Number(settingDays) : NaN;
  const days = Number.isFinite(parsedSettingDays) && parsedSettingDays > 0
    ? parsedSettingDays
    : Number(process.env.SESSION_REPLAY_RETENTION_DAYS || 14);
  if (!Number.isFinite(days) || days <= 0) return;
  const now = Date.now();
  if (now - replayCleanupAt < 6 * 60 * 60 * 1000) return;
  replayCleanupAt = now;
  const cutoff = new Date(now - days * 86400000);
  await prisma.sessionReplay.deleteMany({ where: { startedAt: { lt: cutoff } } }).catch(() => undefined);
}

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
  setPublicCache(res, 300, 1800, ['store', 'categories', 'settings']);
  const [categories, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } } }),
    getSettings([
      'store.announcement',
      'store.info',
      'tracking.metaPixelEnabled',
      'tracking.metaPixelId',
      'tracking.tiktokPixelEnabled',
      'tracking.tiktokPixelId',
      'tracking.clarityEnabled',
      'tracking.clarityId',
      'tracking.sessionReplayEnabled',
      'homepage.config',
      'store.bundleDefaultDiscountPercent',
    ])
  ]);
  res.json({ categories: categories.map(c => ({ id:c.id,name:c.name,slug:c.slug,description:c.description,image:c.imageUrl,seoTitle:c.seoTitle,seoDescription:c.seoDescription,count:c._count.products })), settings });
});

app.get('/api/categories', async (_req, res) => {
  setPublicCache(res, 900, 3600, ['categories']);
  const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } } });
  res.json(rows.map(c => ({ id:c.id,name:c.name,slug:c.slug,description:c.description,image:c.imageUrl,seoTitle:c.seoTitle,seoDescription:c.seoDescription,count:c._count.products,sortOrder:c.sortOrder,imageUrl:c.imageUrl })));
});

app.get('/api/products', async (req, res) => {
  if (String(req.query.search || '').trim() && !(await allowRequest(req, res, 'search', 60, 60 * 1000))) return;
  const page = Math.max(1, Number(req.query.page || 1)); const limit = Math.min(100, Math.max(1, Number(req.query.limit || 12)));
  const search = String(req.query.search || '').trim(); const category = String(req.query.category || '').trim(); const sort = String(req.query.sort || 'popular');
  const featured = String(req.query.featured || '') === 'true';
  const minPriceRaw = Number(req.query.minPrice); const maxPriceRaw = Number(req.query.maxPrice);
  const minPrice = Number.isFinite(minPriceRaw) && minPriceRaw >= 0 ? minPriceRaw : undefined;
  const maxPrice = Number.isFinite(maxPriceRaw) && maxPriceRaw >= 0 ? maxPriceRaw : undefined;
  const availability = String(req.query.availability || '').trim();
  const tag = String(req.query.tag || '').trim().replace(/[^a-z0-9-]/gi, '');
  setPublicCache(res, 60, 300, ['products', ...(category ? [`category:${category}`] : []), ...(featured ? ['featured-products'] : [])]);
  const andFilters: Prisma.ProductWhereInput[] = [];
  if (minPrice != null || maxPrice != null) {
    const bounds: any = { ...(minPrice != null ? { gte: minPrice } : {}), ...(maxPrice != null ? { lte: maxPrice } : {}) };
    andFilters.push({ OR: [{ salePrice: { not: null, ...bounds } }, { salePrice: null, price: bounds }] });
  }
  if (availability === 'instock') {
    andFilters.push({ OR: [{ stock: { gt: 0 } }, { variants: { some: { active: true, stock: { gt: 0 } } } }] });
  }
  if (tag === 'discount') {
    andFilters.push({ OR: [{ sourceUrl: { contains: '"15-off"' } }, { sourceUrl: { contains: '"20-off"' } }, { sourceUrl: { contains: '"30-off"' } }, { salePrice: { not: null } }] });
  } else if (tag === 'best-selling') {
    andFilters.push({ OR: [{ featured: true }, { sourceUrl: { contains: '"best-selling"' } }] });
  } else if (tag) {
    andFilters.push({ sourceUrl: { contains: `"${tag}"` } });
  }
  const where: Prisma.ProductWhereInput = {
    status: 'PUBLISHED', ...(featured ? { featured: true } : {}), ...(category ? { category: { slug: category } } : {}),
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }, { category: { name: { contains: search, mode: 'insensitive' } } }] } : {}),
    ...(andFilters.length ? { AND: andFilters } : {})
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = sort === 'price-asc' ? [{ salePrice:'asc' },{ price:'asc' }] : sort === 'price-desc' ? [{ salePrice:'desc' },{ price:'desc' }] : sort === 'newest' ? [{ createdAt:'desc' }] : [{ orderItems: { _count: 'desc' } }, { createdAt:'desc' }];
  const [rows,total] = await Promise.all([prisma.product.findMany({ where, select: productListSelect, orderBy, skip:(page-1)*limit, take:limit }), prisma.product.count({ where })]);
  res.json({ items: rows.map(jsonProductSummary), page, limit, total, totalPages: Math.max(1, Math.ceil(total/limit)) });
});
app.get('/api/products/slug/:slug', async (req,res) => { const slug=routeParam(req, 'slug'); setPublicCache(res, 120, 600, ['products', `product:${slug}`]); const row = await prisma.product.findFirst({ where:{ slug, status:'PUBLISHED' }, include: productInclude }); if(!row) return res.status(404).json({error:'NOT_FOUND'}); res.json(jsonProduct(row)); });
app.get('/api/pages/:slug', async (req,res) => { setPublicCache(res, 900, 3600, ['pages']); const slugs = [routeParam(req, 'slug'), ...String(req.query.fallback || '').split(',').filter(Boolean)]; const page = await prisma.page.findFirst({ where:{ slug:{in:slugs}, published:true } }); if(!page) return res.status(404).json({error:'NOT_FOUND'}); res.json(page); });
app.get('/api/settings/public', async (req,res) => { setPublicCache(res, 300, 1800, ['settings']); const keys = String(req.query.keys || '').split(',').filter(Boolean); res.json(await getSettings(keys)); });
app.get('/api/cities', async (_req,res) => { setPublicCache(res, 3600, 86400, ['cities']); res.json(await prisma.city.findMany({ where:{active:true}, orderBy:{name:'asc'} })); });
app.get('/api/seo/sitemap', async (_req,res) => { setPublicCache(res, 3600, 86400, ['seo']); const [products,categories,pages] = await Promise.all([prisma.product.findMany({where:{status:'PUBLISHED'},select:{slug:true,updatedAt:true}}),prisma.category.findMany({select:{slug:true,updatedAt:true}}),prisma.page.findMany({where:{published:true},select:{slug:true,updatedAt:true}})]); res.json({products,categories,pages}); });
app.get('/api/redirects/resolve', async (req,res)=>{setPublicCache(res,3600,86400,['redirects']);const sourcePath=String(req.query.path||'');const row=await prisma.redirect.findUnique({where:{sourcePath}});if(!row)return res.status(404).json({error:'NOT_FOUND'});res.json(row);});
app.get('/api/feed/meta.xml', async (_req,res)=>{
  setPublicCache(res,900,3600,['products','feed']);
  const products=await prisma.product.findMany({where:{status:'PUBLISHED'},include:{category:true,variants:{where:{active:true}}},orderBy:{updatedAt:'desc'}});
  const base=(process.env.NEXT_PUBLIC_SITE_URL||'https://zelvomart.com').replace(/\/$/,'');
  const x=(v:any)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const itemXml=(input:{id:string;groupId:string;title:string;description:string;stock:number;price:number;salePrice?:number|null;link:string;image?:string;extraImages:string[];productType:string})=>{
    const regular=Number(input.price).toFixed(2);
    const sale=input.salePrice!=null&&Number(input.salePrice)<Number(input.price)?Number(input.salePrice).toFixed(2):'';
    return `<item><g:id>${x(input.id)}</g:id><g:item_group_id>${x(input.groupId)}</g:item_group_id><g:title>${x(input.title)}</g:title><g:description>${x(input.description)}</g:description><g:availability>${input.stock>0?'in stock':'out of stock'}</g:availability><g:condition>new</g:condition><g:price>${regular} PKR</g:price>${sale?`<g:sale_price>${sale} PKR</g:sale_price>`:''}<g:link>${x(input.link)}</g:link>${input.image?`<g:image_link>${x(input.image)}</g:image_link>`:''}${input.extraImages.slice(0,10).map(i=>`<g:additional_image_link>${x(i)}</g:additional_image_link>`).join('')}<g:brand>Zelvomart</g:brand><g:product_type>${x(input.productType)}</g:product_type></item>`;
  };
  const items:string[]=[];
  for(const product of products){
    const images=Array.isArray(product.images)?product.images.filter((i):i is string=>typeof i==='string'):[];
    const link=`${base}/product/${product.slug}/`;
    if(product.variants.length){
      for(const variant of product.variants){
        const hasOverride=variant.priceOverride!=null;
        items.push(itemXml({
          id:variant.sku,
          groupId:product.sku,
          title:variant.name?`${product.title} - ${variant.name}`:product.title,
          description:product.shortDescription||product.title,
          stock:variant.stock,
          price:hasOverride?Number(variant.priceOverride):Number(product.price),
          salePrice:hasOverride?null:(product.salePrice==null?null:Number(product.salePrice)),
          link,
          image:variant.imageUrl||images[0],
          extraImages:images.filter(i=>i!==(variant.imageUrl||images[0])),
          productType:product.category?.name||'',
        }));
      }
    }else{
      items.push(itemXml({
        id:product.sku,
        groupId:product.sku,
        title:product.title,
        description:product.shortDescription||product.title,
        stock:product.stock,
        price:Number(product.price),
        salePrice:product.salePrice==null?null:Number(product.salePrice),
        link,
        image:images[0],
        extraImages:images.slice(1),
        productType:product.category?.name||'',
      }));
    }
  }
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Zelvomart</title><link>${base}</link><description>Zelvomart product feed</description>${items.join('')}</channel></rss>`);
});

app.post('/api/orders', async (req,res) => {
  if (!(await allowRequest(req, res, 'checkout-ip', 12, 15 * 60 * 1000))) return;
  const rawPhone = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
  if (rawPhone && !(await allowRequest(req, res, 'checkout-phone', 6, 15 * 60 * 1000, rawPhone))) return;
  const parsed = checkoutSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'VALIDATION_ERROR',issues:parsed.error.flatten()});
  try { const order = await createOrder({ ...parsed.data, email: parsed.data.email || undefined, postcode: parsed.data.postcode || undefined, orderNotes: parsed.data.orderNotes || undefined, clientIp:req.ip, clientUserAgent:req.get('user-agent') || undefined }); await invalidateFrontendCache(['products']); res.status(201).json({ orderNumber: order.orderNumber, id: order.id, total: Number(order.total) }); }
  catch(e:any){ res.status(400).json({error:e?.message || 'ORDER_FAILED'}); }
});
app.post('/api/orders/track', async (req,res) => { if (!(await allowRequest(req, res, 'order-track', 30, 15 * 60 * 1000))) return; const orderNumber=String(req.body.orderNumber||'').toUpperCase(); const phone=String(req.body.phone||'').replace(/\D/g,''); const order=await prisma.order.findFirst({where:{orderNumber, OR:[{phone:{endsWith:phone.slice(-10)}},{phone:{endsWith:phone.slice(-11)}}]},select:{orderNumber:true,status:true,postexTracking:true,createdAt:true,total:true,city:true}}); if(!order)return res.status(404).json({error:'NOT_FOUND'}); res.json({...order,total:Number(order.total),trackingUrl:order.postexTracking?postexTrackingUrl(order.postexTracking):null}); });
app.get('/api/orders/confirmation/:orderNumber', async (req,res) => {
  const order=await prisma.order.findUnique({where:{orderNumber:routeParam(req, 'orderNumber').toUpperCase()},include:{items:true}});
  if(!order)return res.status(404).json({error:'NOT_FOUND'});
  // The confirmation page contains private delivery details, so the public order number alone is not enough.
  // The opaque database ID is returned only to the browser that placed the order and is kept in the success URL.
  if(String(req.query.key||'')!==order.id)return res.status(404).json({error:'NOT_FOUND'});
  const city=await prisma.city.findUnique({where:{name:order.city}});
  res.json({...order,subtotal:Number(order.subtotal),bundleSaving:Number(order.bundleSaving),deliveryFee:Number(order.deliveryFee),codFee:Number(order.codFee),total:Number(order.total),items:order.items.map(i=>({...i,unitPrice:Number(i.unitPrice),lineTotal:Number(i.lineTotal),bundleDiscount:Number(i.bundleDiscount)})),deliveryEstimate:city?`${city.deliveryMinDays}-${city.deliveryMaxDays} days`:null});
});
app.post('/api/checkout/abandoned', async (req,res) => { const phone=String(req.body.phone||'').trim(); if(phone.length<10)return res.json({ok:true}); const existing=await prisma.abandonedCheckout.findFirst({where:{phone,convertedAt:null},orderBy:{createdAt:'desc'}}); const data={phone,fullName:req.body.fullName||null,email:req.body.email||null,city:req.body.city||null,address:req.body.address||null,cart:req.body.cart||[],source:req.body.source||null}; if(existing) await prisma.abandonedCheckout.update({where:{id:existing.id},data}); else await prisma.abandonedCheckout.create({data}); res.json({ok:true}); });
app.post('/api/reviews', async (req,res) => {
  if (!(await allowRequest(req, res, 'review', 10, 24 * 60 * 60 * 1000))) return;
  if(String(req.body.honeypot||''))return res.status(201).json({ok:true});
  const productId=String(req.body.productId||''); const name=String(req.body.name||'').trim(); const body=String(req.body.body||'').trim(); const rating=Number(req.body.rating||0);
  const orderNumber=String(req.body.orderNumber||'').trim().toUpperCase(); const phone=String(req.body.phone||'').replace(/\D/g,'').slice(-10);
  if(!productId||!name||!body||rating<1||rating>5||!orderNumber||phone.length!==10)return res.status(400).json({error:'DELIVERED_ORDER_REQUIRED'});
  const order=await prisma.order.findFirst({where:{orderNumber,status:'DELIVERED',phone:{endsWith:phone},items:{some:{productId}}},select:{id:true,customerId:true}});
  if(!order)return res.status(403).json({error:'REVIEW_NOT_VERIFIED',message:'Use the delivered order number and phone used at checkout.'});
  const existing=await prisma.review.findFirst({where:{productId,orderId:order.id}});
  if(existing)return res.status(409).json({error:'REVIEW_ALREADY_SUBMITTED'});
  const review=await prisma.review.create({data:{productId,orderId:order.id,customerId:order.customerId,name,body,rating,verified:true,status:'PENDING'}});
  res.status(201).json({ok:true,id:review.id,verified:true});
});
app.post('/api/events', async (req,res) => {
  const userAgent = req.get('user-agent') || undefined;
  if (isLikelyBot(userAgent)) return res.json({ ok: true, ignored: 'bot' });
  if (!(await allowRequest(req, res, 'events', 240, 60 * 1000))) return;

  const eventName = String(req.body.eventName || '');
  const eventId = String(req.body.eventId || '');
  const sessionReplayId = String(req.body.replaySessionId || '').trim() || null;
  if (!META_EVENT_NAMES.has(eventName) || !eventId || eventId.length > 160) return res.status(400).json({ error: 'INVALID_EVENT' });

  const sourceUrl = String(req.body.sourceUrl || '').slice(0, 4000) || null;
  const params = req.body.params && typeof req.body.params === 'object' && !Array.isArray(req.body.params) ? req.body.params as Record<string, unknown> : {};
  const row = await prisma.eventLog.create({
    data: { eventName, eventId, sessionReplayId, channel: 'browser', sourceUrl, payload: req.body || {} },
  });

  if (sessionReplayId) {
    prisma.sessionReplay.updateMany({
      where: { id: sessionReplayId },
      data: { lastSeenAt: new Date(), lastUrl: sourceUrl || '', ...(eventName === 'PageView' ? { pageViews: { increment: 1 } } : {}) },
    }).catch(() => {});
  }

  // Purchase is dispatched from the order transaction. All other storefront events
  // are queued to CAPI and TikTok with the SAME event ID as the browser Pixel event.
  if (eventName !== 'Purchase') {
    const job = await prisma.job.create({
      data: {
        name: 'meta-event',
        payload: {
          eventName,
          eventId,
          sourceUrl,
          userAgent,
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
          ip: requestIp(req),
          ttp: req.body.ttp || null,
          customData: params,
        } as Prisma.InputJsonValue,
      },
    });
    dispatchJobRow(ttJob.id).catch(() => undefined);
  }

  res.json({ ok: true, id: row.id });
});

// Privacy-safe customer session replay ingestion. Input values are masked in the browser before these events arrive.
app.get('/api/experiments/active', async (req,res) => {
  setNoStore(res);
  const path = String(req.query.path || '/');
  const now = new Date();
  const rows = await prisma.experiment.findMany({
    where: {
      status: 'RUNNING',
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { updatedAt: 'desc' },
    take: 25,
  });
  const matches = rows.filter((row) => {
    const pattern = String(row.pagePattern || '/');
    if (pattern === path) return true;
    if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
    return false;
  });
  const row = matches[0];
  if (!row) return res.json({ experiment: null });
  res.json({ experiment: { id: row.id, name: row.name, pagePattern: row.pagePattern, variants: row.variants, trafficSplit: row.trafficSplit } });
});

app.post('/api/experiments/exposure', async (req,res) => {
  if (!(await allowRequest(req, res, 'experiment-exposure', 120, 60 * 1000))) return;
  const experimentId=String(req.body.experimentId||'').trim();
  const variant=String(req.body.variant||'').trim();
  const visitorId=String(req.body.visitorId||'').trim();
  const path=String(req.body.path||'').slice(0,1000);
  if(!experimentId||!variant||!visitorId)return res.status(400).json({error:'INVALID_EXPOSURE'});
  const experiment=await prisma.experiment.findUnique({where:{id:experimentId},select:{id:true,name:true,status:true}});
  if(!experiment||experiment.status!=='RUNNING')return res.status(404).json({error:'EXPERIMENT_NOT_RUNNING'});
  const eventId=`${experimentId}:${visitorId}`;
  const exists=await prisma.eventLog.findFirst({where:{eventName:'ExperimentExposure',eventId}});
  if(!exists) await prisma.eventLog.create({data:{eventName:'ExperimentExposure',eventId,channel:'browser',sourceUrl:path||null,payload:{experimentId,experimentName:experiment.name,variant,visitorId,path} as Prisma.InputJsonValue}});
  res.json({ok:true});
});

app.post('/api/session-replays/start', async (req,res) => {
  void maybeCleanupOldSessionReplays();
  const sessionId=String(req.body.sessionId||'').trim();
  const visitorId=String(req.body.visitorId||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(sessionId)||!/^[0-9a-f-]{36}$/i.test(visitorId)) return res.status(400).json({error:'INVALID_SESSION'});
  const source=req.body.source&&typeof req.body.source==='object'?req.body.source:{};
  const sourceName=normalizeTrafficSource((source as any).source||(source as any).utm_source||(source as any).lastTouch?.utm_source||(source as any).firstTouch?.utm_source||'direct');
  const startedAt=new Date(req.body.startedAt||Date.now());
  const landingUrl=String(req.body.landingUrl||req.body.currentUrl||'').slice(0,4000);
  const lastUrl=String(req.body.currentUrl||landingUrl).slice(0,4000);
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

app.post('/api/session-replays/chunk', async (req,res) => {
  const sessionId=String(req.body.sessionId||'').trim();
  const sequence=Number(req.body.sequence);
  const events=Array.isArray(req.body.events)?req.body.events:[];
  if(!/^[0-9a-f-]{36}$/i.test(sessionId)||!Number.isInteger(sequence)||sequence<0||events.length<1||events.length>100) return res.status(400).json({error:'INVALID_REPLAY_CHUNK'});
  const currentUrl=String(req.body.currentUrl||'').slice(0,4000);
  const now=new Date();
  const replayTouch={lastSeenAt:now,...(currentUrl?{lastUrl:currentUrl}:{})};

  // Session replay is analytics, so do not hold a Prisma transaction open across
  // a slow/remote PostgreSQL connection. Each write is independent and retries
  // are handled by the unique (sessionId, sequence) key. This avoids P2028
  // transaction-expired/rollback errors while keeping replay chunks idempotent.
  const ensureReplaySession=async()=>{
    const touched=await prisma.sessionReplay.updateMany({where:{id:sessionId},data:replayTouch});
    if(touched.count) return;
    await prisma.sessionReplay.upsert({
      where:{id:sessionId},
      update:replayTouch,
      create:{id:sessionId,visitorId:sessionId,source:'direct',landingUrl:currentUrl,lastUrl:currentUrl,status:'ACTIVE',startedAt:now,lastSeenAt:now}
    });
  };

  const saveChunk=async()=>{
    try{
      await prisma.sessionReplayChunk.create({
        data:{sessionId,sequence,events:events as Prisma.InputJsonValue,eventCount:events.length}
      });
      await prisma.sessionReplay.updateMany({
        where:{id:sessionId},
        data:{...replayTouch,eventCount:{increment:events.length},chunkCount:{increment:1}}
      });
      return;
    }catch(error:any){
      const code=String(error?.code||'');
      if(code==='P2002'){
        const existing=await prisma.sessionReplayChunk.findUnique({
          where:{sessionId_sequence:{sessionId,sequence}},
          select:{eventCount:true}
        });
        const previousCount=existing?.eventCount||0;
        await prisma.sessionReplayChunk.update({
          where:{sessionId_sequence:{sessionId,sequence}},
          data:{events:events as Prisma.InputJsonValue,eventCount:events.length}
        });
        const delta=events.length-previousCount;
        await prisma.sessionReplay.updateMany({
          where:{id:sessionId},
          data:{...replayTouch,...(delta!==0?{eventCount:{increment:delta}}:{})}
        });
        return;
      }
      if(code==='P2003'||code==='P2025'){
        await ensureReplaySession();
        try{
          await prisma.sessionReplayChunk.create({
            data:{sessionId,sequence,events:events as Prisma.InputJsonValue,eventCount:events.length}
          });
          await prisma.sessionReplay.updateMany({
            where:{id:sessionId},
            data:{...replayTouch,eventCount:{increment:events.length},chunkCount:{increment:1}}
          });
          return;
        }catch(retryError:any){
          if(String(retryError?.code||'')!=='P2002') throw retryError;
          const existing=await prisma.sessionReplayChunk.findUnique({
            where:{sessionId_sequence:{sessionId,sequence}},
            select:{eventCount:true}
          });
          const previousCount=existing?.eventCount||0;
          await prisma.sessionReplayChunk.update({
            where:{sessionId_sequence:{sessionId,sequence}},
            data:{events:events as Prisma.InputJsonValue,eventCount:events.length}
          });
          const delta=events.length-previousCount;
          await prisma.sessionReplay.updateMany({
            where:{id:sessionId},
            data:{...replayTouch,...(delta!==0?{eventCount:{increment:delta}}:{})}
          });
          return;
        }
      }
      throw error;
    }
  };

  try{
    await saveChunk();
    return res.json({ok:true});
  }catch(error){
    // Replay must never break the storefront. Log it for diagnostics but return
    // an accepted response so a temporary analytics/database issue does not
    // trigger retry storms from the browser.
    console.error('session replay chunk write failed', error);
    return res.status(202).json({ok:false,accepted:true});
  }
});

app.post('/api/session-replays/end', async (req,res) => {
  const sessionId=String(req.body.sessionId||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(sessionId)) return res.status(400).json({error:'INVALID_SESSION'});
  const endedAt=new Date(req.body.endedAt||Date.now());
  await prisma.sessionReplay.updateMany({where:{id:sessionId},data:{status:'ENDED',endedAt:Number.isNaN(endedAt.getTime())?new Date():endedAt,lastSeenAt:new Date(),lastUrl:String(req.body.currentUrl||'').slice(0,4000)}});
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

app.post('/api/auth/login', async (req,res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!(await allowRequest(req, res, 'admin-login', 8, 15 * 60 * 1000, email))) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const identity = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ token: signAdminToken(identity), user: identity });
});

app.get('/api/auth/me', requireAuth(), async (req:AuthedRequest,res) => res.json({user:req.admin}));

app.get('/api/admin/dashboard', requireAuth('orders.read'), async (_req,res) => {
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
  res.json({ordersToday:todayOrders.length,revenueToday:todayOrders.reduce((s,o)=>s+Number(o.total),0),ordersYesterday:yesterdayOrders.length,revenueYesterday:yesterdayOrders.reduce((s,o)=>s+Number(o.total),0),delivered:todayOrders.filter(o=>o.status==='DELIVERED').length,failedJobs,products,customers,acceptedPurchases,trackingCoverage:realOrders?Math.round(acceptedPurchases/realOrders*1000)/10:100,teamEmails,emailCoverage:todayOrders.length?Math.round(teamEmails/todayOrders.length*1000)/10:100,events:Object.fromEntries(events.map(e=>[e.eventName,e._count._all])),recent:recent.map(o=>({...o,total:Number(o.total)}))});
});

app.get('/api/admin/products', requireAuth('products.write'), async (req,res) => { const q=String(req.query.q||''); const status=String(req.query.status||''); const categoryId=String(req.query.categoryId||''); const where:Prisma.ProductWhereInput={...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{sku:{contains:q,mode:'insensitive'}}]}:{}),...(status?{status:status as ProductStatus}:{}),...(categoryId?{categoryId}:{})}; const rows=await prisma.product.findMany({where,include:{category:true,variants:true,reviews:true},orderBy:{updatedAt:'desc'},take:1000}); res.json(rows.map(jsonProduct)); });
app.get('/api/admin/products/:id', requireAuth('products.write'), async (req,res) => { const row=await prisma.product.findUnique({where:{id:routeParam(req, 'id')},include:{category:true,variants:true,reviews:true}}); if(!row)return res.status(404).json({error:'NOT_FOUND'}); res.json(jsonProduct(row)); });
app.post('/api/admin/products', requireAuth('products.write'), async (req:AuthedRequest,res) => {
  try {
    const b=req.body||{};
    const price=Number(b.price||0);
    const salePrice=b.salePrice==null||b.salePrice===''?null:Number(b.salePrice);
    const bundleEnabled=b.bundleEnabled!==false;
    const bundleDiscountPercent=b.bundleDiscountPercent==null||b.bundleDiscountPercent===''?null:Number(b.bundleDiscountPercent);
    const nextStatus=(b.status||'DRAFT') as ProductStatus;
    const row=await prisma.$transaction(async (tx) => {
      const created=await tx.product.create({data:{title:String(b.title),slug:String(b.slug),sku:String(b.sku),categoryId:b.categoryId||null,price:new Prisma.Decimal(price),salePrice:salePrice==null?null:new Prisma.Decimal(salePrice),costPrice:b.costPrice?new Prisma.Decimal(Number(b.costPrice)):null,stock:Number(b.stock||0),status:nextStatus,featured:Boolean(b.featured),bundleEnabled,bundleDiscountPercent:bundleDiscountPercent==null?null:new Prisma.Decimal(bundleDiscountPercent),shortDescription:b.shortDescription||null,descriptionHtml:b.descriptionHtml||null,images:Array.isArray(b.images)?b.images:[],videoUrl:b.videoUrl||null,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,canonicalUrl:b.canonicalUrl||null,sourceUrl:b.catalogMeta?writeCatalogMeta(b.catalogMeta):null}});
      if (Array.isArray(b.variants)) await writeVariants(tx, created.id, b.variants);
      return created;
    });
    await audit(req,'create','Product',row.id);
    await syncProductRedirect({ slug: row.slug, status: row.status, redirectFallback: b.catalogMeta?.redirectFallback !== false && b.redirectFallback !== false, redirectUrl: b.catalogMeta?.redirectUrl || b.redirectUrl });
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
    const nextStatus=(('status' in b ? b.status : current.status) || 'DRAFT') as ProductStatus;
    const data:any={};
    for(const k of ['title','slug','sku','categoryId','stock','status','featured','bundleEnabled','shortDescription','descriptionHtml','images','videoUrl','seoTitle','seoDescription','canonicalUrl']) if(k in b) data[k]=b[k] === '' ? null : b[k];
    if (b.catalogMeta) data.sourceUrl = writeCatalogMeta({ ...(readCatalogMeta(current.sourceUrl) || {}), ...b.catalogMeta });
    for(const k of ['price','salePrice','costPrice','bundleDiscountPercent']) if(k in b) data[k]=b[k]===''||b[k]==null?null:new Prisma.Decimal(Number(b[k]));
    if('stock'in data)data.stock=Number(data.stock||0);
    if('status' in b) data.status = nextStatus;
    const row=await prisma.$transaction(async (tx) => {
      const updated=await tx.product.update({where:{id},data});
      if (Array.isArray(b.variants)) await writeVariants(tx, id, b.variants);
      return updated;
    });
    await audit(req,'update','Product',row.id);
    const meta = b.catalogMeta || readCatalogMeta(row.sourceUrl) || {};
    await syncProductRedirect({ slug: row.slug, previousSlug: String(b.previousSlug || current.slug || ''), status: row.status, redirectFallback: meta.redirectFallback !== false, redirectUrl: meta.redirectUrl || b.redirectUrl });
    const tags = await catalogCacheTags(row.slug, row.categoryId);
    if (current.slug && current.slug !== row.slug) tags.push(`product:${current.slug}`);
    await invalidateFrontendCache(tags);
    res.json(await loadAdminProduct(row.id));
  } catch(error:any) {
    res.status(400).json({error:error?.message||'PRODUCT_UPDATE_FAILED'});
  }
});
app.delete('/api/admin/products/:id', requireAuth('products.write'), async (req:AuthedRequest,res) => {
  const id = routeParam(req, 'id');
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
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
  await audit(req,'delete','Product',id);
  await invalidateFrontendCache(['products','featured-products','categories','store','redirects', `product:${existing.slug}`]);
  res.json({ ok: true });
});
app.post('/api/admin/products/:id/variants', requireAuth('products.write'), async (req:AuthedRequest,res) => {
  try {
    const b=req.body||{};
    const product=await prisma.product.findUnique({where:{id:routeParam(req,'id')}});
    if(!product)return res.status(404).json({error:'NOT_FOUND'});


    const row=await prisma.variant.create({data:{productId:product.id,sku:String(b.sku),name:String(b.name),attributes:b.attributes||{},priceOverride:b.priceOverride?new Prisma.Decimal(Number(b.priceOverride)):null,stock:Number(b.stock||0),imageUrl:b.imageUrl||null,active:b.active!==false}});
    await audit(req,'create','Variant',row.id);await invalidateFrontendCache(['products']);res.status(201).json(row);
  } catch(error:any) { res.status(400).json({error:error?.message||'VARIANT_CREATE_FAILED'}); }
});
app.delete('/api/admin/variants/:id', requireAuth('products.write'), async (req:AuthedRequest,res)=>{await prisma.variant.delete({where:{id:routeParam(req, 'id')}});await audit(req,'delete','Variant',routeParam(req, 'id'));await invalidateFrontendCache(['products']);res.json({ok:true});});

app.get('/api/admin/categories', requireAuth('products.write'), async (_req,res) => { const rows=await prisma.category.findMany({orderBy:{sortOrder:'asc'},include:{_count:{select:{products:true}}}}); res.json(rows.map(r=>({...r,count:r._count.products}))); });
app.post('/api/admin/categories', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; const row=await prisma.category.create({data:{name:String(b.name),slug:String(b.slug),sortOrder:Number(b.sortOrder||0),imageUrl:b.imageUrl||null,description:b.description||null,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null}});await audit(req,'create','Category',row.id);await invalidateFrontendCache(['categories','products','store']);res.status(201).json(row);});
app.patch('/api/admin/categories/:id', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; const row=await prisma.category.update({where:{id:routeParam(req, 'id')},data:{name:b.name,slug:b.slug,sortOrder:b.sortOrder==null?undefined:Number(b.sortOrder),imageUrl:b.imageUrl===undefined?undefined:(b.imageUrl||null),description:b.description===undefined?undefined:(b.description||null),seoTitle:b.seoTitle===undefined?undefined:(b.seoTitle||null),seoDescription:b.seoDescription===undefined?undefined:(b.seoDescription||null)}});await audit(req,'update','Category',row.id);await invalidateFrontendCache(['categories','products','store']);res.json(row);});
app.delete('/api/admin/categories/:id', requireAuth('products.write'), async (req:AuthedRequest,res)=>{await prisma.category.delete({where:{id:routeParam(req, 'id')}});await audit(req,'delete','Category',routeParam(req, 'id'));await invalidateFrontendCache(['categories','products','store']);res.json({ok:true});});

app.get('/api/admin/orders', requireAuth('orders.read'), async (req,res)=>{
  const q=String(req.query.q||'');const status=String(req.query.status||'');const city=String(req.query.city||'');const source=String(req.query.source||'');
  const fromRaw=String(req.query.from||'');const toRaw=String(req.query.to||'');
  const from=fromRaw?new Date(`${fromRaw}T00:00:00`):null;const to=toRaw?new Date(`${toRaw}T23:59:59.999`):null;
  const createdAt=(from&&!Number.isNaN(from.getTime()))||(to&&!Number.isNaN(to.getTime()))?{...(from&&!Number.isNaN(from.getTime())?{gte:from}:{}),...(to&&!Number.isNaN(to.getTime())?{lte:to}:{})}:undefined;
  const where:Prisma.OrderWhereInput={...(status?{status:status as OrderStatus}:{}),...(city?{city:{contains:city,mode:'insensitive'}}:{}),...(source?{source:{contains:source,mode:'insensitive'}}:{}),...(createdAt?{createdAt}:{}),...(q?{OR:[{orderNumber:{contains:q,mode:'insensitive'}},{fullName:{contains:q,mode:'insensitive'}},{phone:{contains:q}}]}:{})};
  const rows=await prisma.order.findMany({where,orderBy:{createdAt:'desc'},take:1000});res.json(rows.map(r=>({...r,total:Number(r.total)})));
});
app.patch('/api/admin/orders/bulk-status', requireAuth('orders.write'), async (req:AuthedRequest,res)=>{
  const ids=Array.isArray(req.body.ids)?req.body.ids.map(String).slice(0,100):[];const next=String(req.body.status) as OrderStatus;
  if(!ids.length||!Object.values(OrderStatus).includes(next))return res.status(400).json({error:'INVALID_BULK_UPDATE'});
  let updated=0;
  for(const id of ids){
    const existing=await prisma.order.findUnique({where:{id}});if(!existing||existing.status===next)continue;
    if(!['CANCELLED','RETURNED'].includes(existing.status)&&['CANCELLED','RETURNED'].includes(next))await restoreOrderStock(id);
    await prisma.$transaction([
      prisma.order.update({where:{id},data:{status:next}}),
      prisma.orderStatusHistory.create({data:{orderId:id,from:existing.status,to:next,userId:req.admin?.id,note:'Bulk status update'}}),
      ...(next==='RETURNED'&&existing.customerId?[prisma.customer.update({where:{id:existing.customerId},data:{refusalCount:{increment:1}}})]:[]),
    ]);
    if(['CONFIRMED','BOOKED','DELIVERED'].includes(next)){const job=await prisma.job.create({data:{name:'customer-status-email',orderId:id,payload:{orderId:id,status:next}}});dispatchJobRow(job.id).catch(()=>undefined);}
    updated+=1;
  }
  await audit(req,'bulk_status_change','Order',undefined,{ids,status:next,updated});if(['CANCELLED','RETURNED'].includes(next))await invalidateFrontendCache(['products']);res.json({ok:true,updated});
});
app.get('/api/admin/orders/:id', requireAuth('orders.read'), async (req,res)=>{const row=await prisma.order.findUnique({where:{id:routeParam(req, 'id')},include:{items:true,statusHistory:{include:{user:true},orderBy:{createdAt:'desc'}},customer:true}});if(!row)return res.status(404).json({error:'NOT_FOUND'});res.json({...row,total:Number(row.total),subtotal:Number(row.subtotal),bundleSaving:Number(row.bundleSaving),deliveryFee:Number(row.deliveryFee),codFee:Number(row.codFee),items:row.items.map(i=>({...i,unitPrice:Number(i.unitPrice),lineTotal:Number(i.lineTotal),bundleDiscount:Number(i.bundleDiscount)})),trackingUrl:row.postexTracking?postexTrackingUrl(row.postexTracking):null});});
app.patch('/api/admin/orders/:id/status', requireAuth('orders.write'), async (req:AuthedRequest,res)=>{
  const id=routeParam(req,'id');
  const next=String(req.body.status) as OrderStatus;
  if(!Object.values(OrderStatus).includes(next)) return res.status(400).json({error:'INVALID_STATUS'});
  const existing=await prisma.order.findUnique({where:{id}});
  if(!existing) return res.status(404).json({error:'NOT_FOUND'});
  if(!['CANCELLED','RETURNED'].includes(existing.status)&&['CANCELLED','RETURNED'].includes(next)) await restoreOrderStock(id);
  await prisma.$transaction([
    prisma.order.update({where:{id},data:{status:next}}),
    prisma.orderStatusHistory.create({data:{orderId:id,from:existing.status,to:next,userId:req.admin?.id,note:req.body.note||null}}),
    ...(next==='RETURNED'&&existing.customerId&&existing.status!=='RETURNED'?[prisma.customer.update({where:{id:existing.customerId},data:{refusalCount:{increment:1}}})]:[]),
  ]);
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
  await prisma.order.update({where:{id},data:{postexTracking:tracking||null,status:tracking?'BOOKED':existing.status}});
  if(tracking&&existing.status!=='BOOKED') {
    await prisma.orderStatusHistory.create({data:{orderId:id,from:existing.status,to:'BOOKED',userId:req.admin?.id,note:`PostEx tracking ${tracking}`}});
    const job=await prisma.job.create({data:{name:'customer-status-email',orderId:id,payload:{orderId:id,status:'BOOKED'}}});
    dispatchJobRow(job.id).catch(()=>undefined);
  }
  await audit(req,'tracking_update','Order',id,{tracking});
  res.json({ok:true,trackingUrl:tracking?postexTrackingUrl(tracking):null});
});

app.get('/api/admin/customers', requireAuth('customers.read'), async (_req,res)=>{const rows=await prisma.customer.findMany({include:{orders:{select:{total:true,status:true}}},orderBy:{updatedAt:'desc'},take:1000});res.json(rows.map(c=>({...c,totalSpent:c.orders.reduce((s,o)=>s+Number(o.total),0),orderCount:c.orders.length})));});
app.patch('/api/admin/customers/:id/blocklist', requireAuth('customers.write'), async (req:AuthedRequest,res)=>{const current=await prisma.customer.findUnique({where:{id:routeParam(req, 'id')}});if(!current)return res.status(404).json({error:'NOT_FOUND'});const row=await prisma.customer.update({where:{id:routeParam(req, 'id')},data:{blocklisted:!current.blocklisted}});await audit(req,'toggle_blocklist','Customer',row.id,{blocklisted:row.blocklisted});res.json(row);});

app.get('/api/admin/pages', requireAuth('content.write'), async (_req,res)=>res.json(await prisma.page.findMany({orderBy:{slug:'asc'}})));
app.post('/api/admin/pages', requireAuth('content.write'), async (req:AuthedRequest,res)=>{const b=req.body||{};const slug=String(b.slug||'').trim().toLowerCase();const title=String(b.title||'').trim();if(!slug||!title)return res.status(400).json({error:'TITLE_AND_SLUG_REQUIRED'});const row=await prisma.page.upsert({where:{slug},update:{title,bodyHtml:String(b.bodyHtml||''),seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,published:b.published!==false},create:{slug,title,bodyHtml:String(b.bodyHtml||''),seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,published:b.published!==false}});await audit(req,'upsert','Page',row.id);await invalidateFrontendCache(['pages']);res.status(201).json(row);});
app.patch('/api/admin/pages/:id', requireAuth('content.write'), async (req:AuthedRequest,res)=>{const b=req.body;const row=await prisma.page.update({where:{id:routeParam(req, 'id')},data:{title:b.title,slug:b.slug,bodyHtml:b.bodyHtml,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,published:b.published!==false}});await audit(req,'update','Page',row.id);await invalidateFrontendCache(['pages']);res.json(row);});

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
  for(const [key,value] of Object.entries(req.body||{})){
    if((key==='tracking.metaCapiToken'||key==='tracking.tiktokEventsApiToken')&&(!value||value==='••••••••')){
      continue;
    }
    await setSetting(key,value);
  }
  await audit(req,'update','Settings',undefined,{keys:Object.keys(req.body||{})});
  await invalidateFrontendCache(['settings','store']);
  res.json({ok:true});
});
app.put('/api/admin/cities', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{const cities=Array.isArray(req.body.cities)?req.body.cities:[];for(const c of cities){if(!c.name)continue;await prisma.city.upsert({where:{name:String(c.name)},update:{deliveryMinDays:Number(c.deliveryMinDays||2),deliveryMaxDays:Number(c.deliveryMaxDays||5),active:c.active!==false},create:{name:String(c.name),deliveryMinDays:Number(c.deliveryMinDays||2),deliveryMaxDays:Number(c.deliveryMaxDays||5),active:c.active!==false}});}await audit(req,'update','Cities');await invalidateFrontendCache(['cities']);res.json({ok:true});});

app.get('/api/admin/users', requireAuth('users.write'), async (_req,res)=>res.json(await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,active:true,createdAt:true,updatedAt:true},orderBy:{createdAt:'desc'}})));
app.post('/api/admin/users', requireAuth('users.write'), async (req:AuthedRequest,res)=>{const password=String(req.body.password||'');if(password.length<8)return res.status(400).json({error:'PASSWORD_TOO_SHORT'});const row=await prisma.user.create({data:{name:String(req.body.name),email:String(req.body.email).toLowerCase(),passwordHash:await bcrypt.hash(password,12),role:(req.body.role||'ORDER_AGENT') as Role,active:req.body.active!==false}});await audit(req,'create','User',row.id);res.status(201).json({id:row.id,name:row.name,email:row.email,role:row.role,active:row.active});});
app.patch('/api/admin/users/:id', requireAuth('users.write'), async (req:AuthedRequest,res)=>{const data:any={};for(const k of ['name','email','role','active'])if(k in req.body)data[k]=req.body[k];if(req.body.password){const nextPassword=String(req.body.password);if(nextPassword.length<8)return res.status(400).json({error:'PASSWORD_TOO_SHORT'});data.passwordHash=await bcrypt.hash(nextPassword,12);}const row=await prisma.user.update({where:{id:routeParam(req, 'id')},data});await audit(req,'update','User',row.id);res.json({id:row.id,name:row.name,email:row.email,role:row.role,active:row.active});});

app.get('/api/admin/reviews', requireAuth('content.write'), async (_req,res)=>res.json(await prisma.review.findMany({include:{product:{select:{title:true,sku:true}}},orderBy:{createdAt:'desc'}})));
app.patch('/api/admin/reviews/:id', requireAuth('content.write'), async (req:AuthedRequest,res)=>{const status=String(req.body.status) as ReviewStatus;if(!Object.values(ReviewStatus).includes(status))return res.status(400).json({error:'INVALID_STATUS'});const row=await prisma.review.update({where:{id:routeParam(req, 'id')},data:{status}});await audit(req,'review_status','Review',row.id,{status});await invalidateFrontendCache(['products']);res.json(row);});
app.get('/api/admin/redirects', requireAuth('settings.write'), async (_req,res)=>res.json(await prisma.redirect.findMany({orderBy:{sourcePath:'asc'}})));
app.post('/api/admin/redirects', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{const row=await prisma.redirect.upsert({where:{sourcePath:String(req.body.sourcePath)},update:{destination:String(req.body.destination),permanent:req.body.permanent!==false},create:{sourcePath:String(req.body.sourcePath),destination:String(req.body.destination),permanent:req.body.permanent!==false}});await audit(req,'upsert','Redirect',row.id);await invalidateFrontendCache(['redirects']);res.json(row);});
app.delete('/api/admin/redirects/:id', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{await prisma.redirect.delete({where:{id:routeParam(req, 'id')}});await audit(req,'delete','Redirect',routeParam(req, 'id'));await invalidateFrontendCache(['redirects']);res.json({ok:true});});
app.get('/api/admin/session-replays', requireAuth('reports.read'), async (req,res)=>{
  const source=String(req.query.source||'').trim().toLowerCase();
  const q=String(req.query.q||'').trim();
  const limit=Math.min(200,Math.max(20,Number(req.query.limit||100)));
  const since=new Date(Date.now()-30*86400000);
  const where:Prisma.SessionReplayWhereInput={...(source&&source!=='all'?{source}:{}),...(q?{OR:[{landingUrl:{contains:q,mode:'insensitive'}},{lastUrl:{contains:q,mode:'insensitive'}},{campaign:{contains:q,mode:'insensitive'}},{visitorId:{contains:q,mode:'insensitive'}}]}:{})};
  const [sessions,total,last30,sourceGroups,ordered30]=await Promise.all([
    prisma.sessionReplay.findMany({where,orderBy:{startedAt:'desc'},take:limit}),
    prisma.sessionReplay.count({where}),
    prisma.sessionReplay.count({where:{startedAt:{gte:since}}}),
    prisma.sessionReplay.groupBy({by:['source'],where:{startedAt:{gte:since}},_count:{_all:true}}),
    prisma.order.count({where:{createdAt:{gte:since},replaySessionId:{not:null}}}),
  ]);
  const ids=sessions.map(row=>row.id);
  const orders=ids.length?await prisma.order.findMany({where:{replaySessionId:{in:ids}},select:{id:true,orderNumber:true,replaySessionId:true,total:true,createdAt:true},orderBy:{createdAt:'desc'}}):[];
  const orderBySession=new Map(orders.filter(o=>o.replaySessionId).map(o=>[o.replaySessionId!,o]));
  const outcome=String(req.query.outcome||'all');
  const items=sessions.map(row=>{const order=orderBySession.get(row.id);return {...row,durationMs:Math.max(0,Number((row.endedAt||row.lastSeenAt).getTime()-row.startedAt.getTime())),order:order?{id:order.id,orderNumber:order.orderNumber,total:Number(order.total),createdAt:order.createdAt}:null};}).filter(row=>outcome==='ordered'?Boolean(row.order):outcome==='no-order'?!row.order:true);
  res.json({total,items,stats:{last30,ordered30,sources:Object.fromEntries(sourceGroups.map(x=>[x.source,x._count._all]))}});
});

app.get('/api/admin/session-replays/:id', requireAuth('reports.read'), async (req,res)=>{
  const id=routeParam(req,'id');
  const [session,chunks,order,markers]=await Promise.all([
    prisma.sessionReplay.findUnique({where:{id}}),
    prisma.sessionReplayChunk.findMany({where:{sessionId:id},orderBy:{sequence:'asc'},take:2500}),
    prisma.order.findFirst({where:{replaySessionId:id},select:{id:true,orderNumber:true,total:true,source:true,createdAt:true}}),
    prisma.eventLog.findMany({where:{sessionReplayId:id,eventName:{in:['PageView','ViewContent','AddToCart','InitiateCheckout','Purchase']}},select:{eventName:true,sourceUrl:true,createdAt:true,payload:true},orderBy:{createdAt:'asc'},take:500}),
  ]);
  if(!session) return res.status(404).json({error:'NOT_FOUND'});
  const events=chunks.flatMap(chunk=>Array.isArray(chunk.events)?chunk.events:[]);
  const replayDiagnostics={
    hasFullSnapshot:events.some((event:any)=>Number(event?.type)===2),
    fullSnapshotCount:events.filter((event:any)=>Number(event?.type)===2).length,
    hasMeta:events.some((event:any)=>Number(event?.type)===4),
    chunkCount:chunks.length,
    eventCount:events.length,
  };
  res.json({session:{...session,durationMs:Math.max(0,Number((session.endedAt||session.lastSeenAt).getTime()-session.startedAt.getTime()))},events,replayDiagnostics,order:order?{...order,total:Number(order.total)}:null,markers});
});

app.delete('/api/admin/session-replays/:id', requireAuth('reports.read'), async (req:AuthedRequest,res)=>{
  const id=routeParam(req,'id');
  await prisma.sessionReplay.deleteMany({where:{id}});
  await audit(req,'delete','SessionReplay',id);
  res.json({ok:true});
});

app.get('/api/admin/experiments', requireAuth('reports.read'), async (_req,res)=>{
  const [rows,orders,exposures]=await Promise.all([
    prisma.experiment.findMany({orderBy:{createdAt:'desc'}}),
    prisma.order.findMany({where:{experiments:{not:Prisma.DbNull}},select:{experiments:true},take:5000}),
    prisma.eventLog.findMany({where:{eventName:'ExperimentExposure'},select:{payload:true,eventId:true},take:20000}),
  ]);
  const enriched=rows.map(row=>{
    const variants=Array.isArray(row.variants)?row.variants.map(String):Object.keys((row.variants||{}) as any);
    const report:Record<string,{visitors:number;orders:number;orderRate:number}>={};
    for(const variant of variants) report[variant]={visitors:0,orders:0,orderRate:0};
    for(const exposure of exposures){
      const payload=(exposure.payload&&typeof exposure.payload==='object'&&!Array.isArray(exposure.payload)?exposure.payload:{}) as Record<string,unknown>;
      if(String(payload.experimentId||'')!==row.id)continue;
      const variant=String(payload.variant||'');
      if(!variant)continue;
      if(!report[variant])report[variant]={visitors:0,orders:0,orderRate:0};
      report[variant].visitors+=1;
    }
    for(const order of orders){
      const map=(order.experiments&&typeof order.experiments==='object'&&!Array.isArray(order.experiments)?order.experiments:{}) as Record<string,unknown>;
      const variant=String(map[row.id]||map[row.name]||'');
      if(!variant)continue;
      if(!report[variant])report[variant]={visitors:0,orders:0,orderRate:0};
      report[variant].orders+=1;
    }
    for(const variant of Object.keys(report)) report[variant].orderRate=report[variant].visitors?Math.round(report[variant].orders/report[variant].visitors*1000)/10:0;
    return {...row,report};
  });
  res.json(enriched);
});
app.post('/api/admin/experiments', requireAuth('content.write'), async (req:AuthedRequest,res)=>{
  const pagePattern=String(req.body.pagePattern||'/').trim()||'/';
  const row=await prisma.experiment.create({data:{name:String(req.body.name),pagePattern,variants:req.body.variants||['A','B'],trafficSplit:req.body.trafficSplit||{A:50,B:50},status:(req.body.status||'DRAFT') as ExperimentStatus}});
  await audit(req,'create','Experiment',row.id);res.status(201).json(row);
});
app.patch('/api/admin/experiments/:id', requireAuth('content.write'), async (req:AuthedRequest,res)=>{
  const id=routeParam(req,'id');
  const existing=await prisma.experiment.findUnique({where:{id}});if(!existing)return res.status(404).json({error:'NOT_FOUND'});
  const nextStatus=req.body.status as ExperimentStatus|undefined;
  if(nextStatus==='RUNNING') await prisma.experiment.updateMany({where:{id:{not:id},pagePattern:existing.pagePattern,status:'RUNNING'},data:{status:'PAUSED'}});
  const row=await prisma.experiment.update({where:{id},data:req.body});await audit(req,'update','Experiment',row.id);res.json(row);
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
      'tracking.clarityEnabled',
      'tracking.clarityId',
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

  const clarityEnabled = settings['tracking.clarityEnabled'] !== false && settings['tracking.clarityEnabled'] !== 'false';
  const clarityId = String(settings['tracking.clarityId'] || process.env.NEXT_PUBLIC_CLARITY_ID || process.env.CLARITY_ID || '');
  const clarityConfigured = Boolean(clarityId);

  const sessionReplayEnabled = settings['tracking.sessionReplayEnabled'] !== false && settings['tracking.sessionReplayEnabled'] !== 'false';
  const sessionReplayRetentionDays = Number(settings['tracking.sessionReplayRetentionDays'] || process.env.SESSION_REPLAY_RETENTION_DAYS || 14);

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
      clarity: { enabled: clarityEnabled, configured: clarityConfigured, id: clarityId },
      sessionReplay: { enabled: sessionReplayEnabled, configured: true, retentionDays: sessionReplayRetentionDays },
    },

    config: {
      pixelId: metaPixelId,
      clarityId,
      capiConfigured: metaCapiConfigured,
      testEventCodeConfigured: metaTestEventCodeConfigured,
      appEnv: process.env.APP_ENV || 'development',
      metaPixel: { enabled: metaPixelEnabled, configured: metaPixelConfigured, id: metaPixelId },
      metaCapi: { enabled: metaCapiEnabled, configured: metaCapiConfigured, testEventCodeConfigured: metaTestEventCodeConfigured },
      tiktokPixel: { enabled: tiktokPixelEnabled, configured: tiktokPixelConfigured, id: tiktokPixelId },
      tiktokEventsApi: { enabled: tiktokEventsApiEnabled, configured: tiktokEventsApiConfigured, testEventCodeConfigured: tiktokTestEventCodeConfigured },
      clarity: { enabled: clarityEnabled, configured: clarityConfigured, id: clarityId },
      sessionReplay: { enabled: sessionReplayEnabled, configured: true, retentionDays: sessionReplayRetentionDays },
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

app.get('/api/admin/abandoned', requireAuth('customers.read'), async (_req,res)=>res.json(await prisma.abandonedCheckout.findMany({orderBy:{createdAt:'desc'},take:500})));

// CSV import. Every new product is saved as a DRAFT; existing SKUs keep their status.
// `dryRun: true` validates and reports what would happen without writing anything.
app.post('/api/admin/products/import', requireAuth('products.write'), async (req:AuthedRequest,res)=>{
  const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
  const dryRun=Boolean(req.body?.dryRun);
  // The header row must match the template; a changed structure rejects the whole file.
  const headers:string[]=Array.isArray(req.body?.headers)?req.body.headers.map(String):[...new Set<string>(rows.flatMap((r:any)=>Object.keys(r||{})))].filter(k=>k!=='__row');
  const fileErrors=validateHeaders(headers);
  if(!rows.length) fileErrors.push('The file has no product rows.');
  if(rows.length>5000) fileErrors.push('The file has more than 5,000 rows. Split it into smaller files.');
  if(fileErrors.length) return res.status(dryRun?200:400).json({error:'INVALID_TEMPLATE',message:fileErrors.join(' '),fileErrors,created:0,updated:0,skipped:0,errors:fileErrors,dryRun,results:[]});
  const planned=planImport(rows, Number(req.body?.firstRow)||2);
  const categories=await prisma.category.findMany();
  const categoryByKey=new Map<string,{id:string;slug:string}>();
  for(const c of categories){categoryByKey.set(c.slug.toLowerCase(),c);categoryByKey.set(c.name.toLowerCase(),c);categoryByKey.set(importSlugify(c.name),c);}
  const results:any[]=[]; const tags=new Set(['products','featured-products','categories','store']);
  for(const product of planned){
    const result:any={row:product.row,sku:product.sku,title:product.title,productType:product.productType,variations:product.variations.length,warnings:product.warnings,errors:[...product.errors],action:'error',id:null,status:null,slug:null,category:product.cells.category||product.cells.categorySlug||''};
    results.push(result);
    if(result.errors.length) continue;
    try{
      const existing=await prisma.product.findUnique({where:{sku:product.sku},include:{variants:{select:{id:true}}}});
      const existingMeta=existing?(readCatalogMeta(existing.sourceUrl)||{}):null;
      if(existing&&product.productType==='simple'&&(existing.variants.length||existingMeta?.productType==='variable')) throw new Error(`sku "${product.sku}" is already a variable product. Use the variable template to update it.`);
      const clash=await prisma.variant.findFirst({where:{sku:{in:[product.sku,...product.variations.map(v=>v.sku)]},...(existing?{productId:{not:existing.id}}:{})},select:{sku:true}});
      if(clash) throw new Error(`sku "${clash.sku}" is already used by a variation of another product.`);
      const write=buildProductWrite(product,existingMeta);
      let slug=existing?.slug||write.slug||importSlugify(product.sku);
      if(!existing||(existing.status==='DRAFT'&&write.explicitSlug&&write.slug&&write.slug!==existing.slug)){
        slug=write.slug||importSlugify(product.sku);
        const taken=await prisma.product.findUnique({where:{slug},select:{id:true}});
        if(taken&&taken.id!==existing?.id){
          if(write.explicitSlug) throw new Error(`slug "${slug}" is already used by another product.`);
          slug=`${slug}-${importSlugify(product.sku)}`;
        }
      }
      result.slug=slug; result.id=existing?.id||null; result.status=existing?.status||'DRAFT';
      if(dryRun){result.action=existing?'update':'create';continue;}
      let categoryId:string|undefined;
      if(write.category){
        let category=categoryByKey.get(write.category.slug)||categoryByKey.get(write.category.name.toLowerCase());
        if(!category){
          category=await prisma.category.create({data:{name:write.category.name,slug:write.category.slug,...write.category.fields}});
          await audit(req,'create','Category',category.id,{source:'csv_import'});
          categoryByKey.set(category.slug.toLowerCase(),category);categoryByKey.set(write.category.name.toLowerCase(),category);
        } else if(Object.keys(write.category.fields).length){
          await prisma.category.update({where:{id:category.id},data:write.category.fields});
        }
        categoryId=category.id; tags.add(`category:${category.slug}`);
      }
      const data:any={...write.columns,slug,sourceUrl:writeCatalogMeta(write.meta)};
      for(const k of ['price','salePrice','costPrice','bundleDiscountPercent']) if(k in data) data[k]=data[k]==null?null:new Prisma.Decimal(Number(data[k]));
      if(categoryId) data.categoryId=categoryId;
      const row=await prisma.$transaction(async(tx)=>{
        const saved=existing?await tx.product.update({where:{id:existing.id},data}):await tx.product.create({data:{...data,sku:product.sku,status:'DRAFT'}});
        if(write.variants) await writeVariants(tx,saved.id,write.variants);
        return saved;
      });
      await syncProductRedirect({slug:row.slug,previousSlug:existing&&existing.slug!==row.slug?existing.slug:undefined,status:row.status,redirectFallback:write.meta.redirectFallback!==false,redirectUrl:String(write.meta.redirectUrl||'')});
      tags.add(`product:${row.slug}`);
      result.action=existing?'updated':'created'; result.id=row.id; result.status=row.status;
    }catch(e:any){
      result.action='error'; result.errors.push(e?.code==='P2002'?`A product or variation with the same ${(e?.meta?.target||['sku']).join(', ')} already exists.`:(e?.message||'Import failed'));
    }
  }
  const count=(action:string)=>results.filter(r=>r.action===action).length;
  const summary={created:count(dryRun?'create':'created'),updated:count(dryRun?'update':'updated'),skipped:count('error'),errors:results.filter(r=>r.action==='error').map(r=>`Row ${r.row}: ${r.errors.join(' ')}`)};
  if(!dryRun){await audit(req,'csv_import','Product',undefined,{...summary,errors:summary.errors.slice(0,25)}); await invalidateFrontendCache([...tags]);}
  res.json({...summary,dryRun,results});
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
      await syncProductRedirect({slug:row.slug,status,redirectFallback:meta.redirectFallback!==false,redirectUrl:meta.redirectUrl});
      updated.push(row.id); tags.add(`product:${row.slug}`); if(row.category?.slug) tags.add(`category:${row.category.slug}`);
    }catch(e:any){failed.push({id:row.id,title:row.title,error:e?.message||'Update failed'});}
  }
  await audit(req,'bulk_status','Product',undefined,{status,updated:updated.length,failed:failed.length});
  await invalidateFrontendCache([...tags]);
  res.json({status,updated,failed});
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
    });
    await audit(req,'bulk_images','Product',id,{images:images.length,variants:variantUpdates.length,mode:replace?'replace':'append'});
    await invalidateFrontendCache(await catalogCacheTags(product.slug,product.categoryId));
    res.json(await loadAdminProduct(id));
  }catch(error:any){
    res.status(400).json({error:error?.message||'PRODUCT_IMAGES_FAILED'});
  }
});
app.get('/api/admin/products/export.csv', requireAuth('orders.export'), async (_req,res)=>{const rows=await prisma.product.findMany({include:{category:true},orderBy:{updatedAt:'desc'}});const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv=['title,slug,sku,category,price,salePrice,costPrice,stock,status,featured,shortDescription,descriptionHtml,imageUrls,videoUrl,seoTitle,seoDescription',...rows.map(p=>[p.title,p.slug,p.sku,p.category?.name||'',p.price,p.salePrice||'',p.costPrice||'',p.stock,p.status,p.featured,p.shortDescription||'',p.descriptionHtml||'',Array.isArray(p.images)?p.images.join('|'):'',p.videoUrl||'',p.seoTitle||'',p.seoDescription||''].map(esc).join(','))].join('\n');res.type('text/csv').send(csv);});
app.get('/api/admin/orders/export.csv', requireAuth('orders.export'), async (_req,res)=>{const rows=await prisma.order.findMany({orderBy:{createdAt:'desc'},take:5000});const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv=['orderNumber,date,customer,phone,city,status,total,source',...rows.map(o=>[o.orderNumber,o.createdAt.toISOString(),o.fullName,o.phone,o.city,o.status,o.total,o.source||''].map(esc).join(','))].join('\n');res.type('text/csv').send(csv);});
app.post('/api/admin/upload', requireAuth('products.write'), (req,res,next)=>{
  upload.single('file')(req,res,(err:any)=>{
    if(!err) return next();
    const tooLarge=err?.code==='LIMIT_FILE_SIZE';
    res.status(tooLarge?413:400).json({error:tooLarge?'FILE_TOO_LARGE':'UPLOAD_FAILED',message:tooLarge?'Unable to upload: the image is larger than 8 MB.':`Unable to upload: ${err?.message||'the file could not be read'}.`});
  });
}, async (req,res)=>{
  if(!req.file) return res.status(400).json({error:'FILE_REQUIRED',message:'Unable to upload: no file was received.'});
  if(!req.file.mimetype.startsWith('image/')) return res.status(400).json({error:'IMAGE_REQUIRED',message:'Unable to upload: only image files are allowed.'});
  try {
    const ext=path.extname(req.file.originalname||'').replace(/[^.a-zA-Z0-9]/g,'')||'';
    const base=path.basename(req.file.originalname||'image',ext).replace(/[^a-zA-Z0-9._-]/g,'-')||'image';
    const url=await uploadObject(`products/${Date.now()}-${base}${ext}`,req.file.buffer,req.file.mimetype);
    res.json({url});
  } catch (error:any) {
    const unconfigured=error instanceof StorageError&&error.code==='STORAGE_NOT_CONFIGURED';
    const message=error instanceof StorageError?error.message:`Unable to upload to Cloudflare: ${error?.message||'unknown error'}.`;
    res.status(unconfigured?503:502).json({error:unconfigured?'STORAGE_NOT_CONFIGURED':'UPLOAD_FAILED',message});
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
