import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { Prisma, ProductStatus, OrderStatus, Role, ReviewStatus, ExperimentStatus } from '@prisma/client';
import { prisma } from './lib/db';
import { signAdminToken, requireAuth, type AuthedRequest } from './lib/auth';
import { createOrder, restoreOrderStock } from './lib/order';
import { checkoutSchema } from './lib/validators';
import { getSetting, getSettings, setSetting } from './lib/settings';
import { postexTrackingUrl } from './lib/postex';
import { uploadObject } from './lib/storage';
import { sendMetaServerEvent } from './lib/meta';
import { fetchMetaAds, getMetaMarketingConfig, testMetaMarketingConnection } from './lib/meta-marketing';
import { invalidateFrontendCache } from './lib/cache-invalidation';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const port = Number(process.env.PORT || 4000);
const frontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { if (!origin || frontendOrigins.includes(origin)) return cb(null, true); cb(new Error('CORS_NOT_ALLOWED')); }, credentials: false }));
app.use(express.json({ limit: '2mb' }));
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
  if (/^\/api\/(auth|admin|orders|checkout|reviews|events|session-replays)(?:\/|$)/.test(req.path)) setNoStore(res);
  next();
});

function jsonProduct(row: any) {
  const regular = Number(row.price ?? 0);
  const sale = row.salePrice == null ? null : Number(row.salePrice);
  const current = sale && sale < regular ? sale : regular;
  const images = Array.isArray(row.images) ? row.images.filter((x: unknown) => typeof x === 'string') : [];
  const reviews = (row.reviews || []).map((review: any) => ({ id: review.id, name: review.name, rating: review.rating, body: review.body, verified: review.verified, createdAt: review.createdAt?.toISOString?.() || review.createdAt }));
  const averageRating = reviews.length ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length : undefined;
  return {
    id: row.id, slug: row.slug, name: row.title, title: row.title, sku: row.sku,
    categories: row.category ? [{ id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description, image: row.category.imageUrl }] : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    category: row.category || null,
    price: current, regularPrice: regular, salePrice: sale, onSale: Boolean(sale && sale < regular),
    discountPercent: sale && sale < regular ? Math.round(((regular - sale) / regular) * 100) : 0,
    stockStatus: row.stock > 0 || (row.variants || []).some((v: any) => v.stock > 0) ? 'instock' : 'outofstock',
    stockQuantity: row.stock, stock: row.stock, featured: row.featured, averageRating, reviewCount: reviews.length,
    image: images[0], images: images.map((src: string) => ({ src, alt: row.title })), rawImages: images,
    shortDescription: row.shortDescription, description: row.descriptionHtml, descriptionHtml: row.descriptionHtml,
    videoUrl: row.videoUrl, permalink: `/product/${row.slug}/`, hasOptions: (row.variants || []).length > 0,
    variants: (row.variants || []).map((v: any) => ({ ...v, priceOverride: v.priceOverride == null ? null : Number(v.priceOverride) })),
    bundleEnabled: row.bundleEnabled, bundleDiscountPercent: row.bundleDiscountPercent == null ? null : Number(row.bundleDiscountPercent), reviews,
    seoTitle: row.seoTitle, seoDescription: row.seoDescription, canonicalUrl: row.canonicalUrl,
    costPrice: row.costPrice == null ? null : Number(row.costPrice), status: row.status, categoryId: row.categoryId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

const productInclude = { category: true, variants: { where: { active: true }, orderBy: { createdAt: 'asc' as const } }, reviews: { where: { status: 'APPROVED' as const }, orderBy: { createdAt: 'desc' as const } } };

const productListSelect = {
  id: true, slug: true, title: true, sku: true, images: true, price: true, salePrice: true, stock: true, featured: true,
  shortDescription: true, bundleEnabled: true, bundleDiscountPercent: true,
  category: { select: { id: true, name: true, slug: true, description: true, imageUrl: true, seoTitle: true, seoDescription: true } },
  variants: { where: { active: true }, select: { stock: true } },
  reviews: { where: { status: 'APPROVED' as const }, select: { rating: true } },
} satisfies Prisma.ProductSelect;

function jsonProductSummary(row: any) {
  const regular = Number(row.price ?? 0);
  const sale = row.salePrice == null ? null : Number(row.salePrice);
  const current = sale && sale < regular ? sale : regular;
  const images = Array.isArray(row.images) ? row.images.filter((x: unknown) => typeof x === 'string') : [];
  const reviewCount = Array.isArray(row.reviews) ? row.reviews.length : 0;
  const averageRating = reviewCount ? row.reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviewCount : undefined;
  const hasOptions = Array.isArray(row.variants) && row.variants.length > 0;
  const variantInStock = hasOptions && row.variants.some((v: any) => Number(v.stock || 0) > 0);
  return {
    id: row.id, slug: row.slug, name: row.title, title: row.title, sku: row.sku,
    categories: row.category ? [{ id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description, image: row.category.imageUrl }] : [],
    categorySlugs: row.category ? [row.category.slug] : [],
    price: current, regularPrice: regular, salePrice: sale, onSale: Boolean(sale && sale < regular),
    discountPercent: sale && sale < regular ? Math.round(((regular - sale) / regular) * 100) : 0,
    stockStatus: row.stock > 0 || variantInStock ? 'instock' : 'outofstock',
    stockQuantity: row.stock, featured: row.featured, averageRating, reviewCount,
    image: images[0], images: images[0] ? [{ src: images[0], alt: row.title }] : [],
    shortDescription: row.shortDescription, description: null, videoUrl: null, permalink: `/product/${row.slug}/`,
    hasOptions, variants: [], bundleEnabled: row.bundleEnabled,
    bundleDiscountPercent: row.bundleDiscountPercent == null ? null : Number(row.bundleDiscountPercent), reviews: [],
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

let replayCleanupAt = 0;
async function maybeCleanupOldSessionReplays() {
  const days = Number(process.env.SESSION_REPLAY_RETENTION_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) return;
  const now = Date.now();
  if (now - replayCleanupAt < 6 * 60 * 60 * 1000) return;
  replayCleanupAt = now;
  const cutoff = new Date(now - days * 86400000);
  await prisma.sessionReplay.deleteMany({ where: { startedAt: { lt: cutoff } } }).catch(() => undefined);
}

app.get('/api/health', async (_req, res) => { setNoStore(res); try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); } catch (e: any) { res.status(503).json({ ok: false, error: e?.message || 'DB_UNAVAILABLE' }); } });

app.get('/api/store/bootstrap', async (_req, res) => {
  setPublicCache(res, 300, 1800, ['store', 'categories', 'settings']);
  const [categories, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } } }),
    getSettings(['store.announcement','store.info','tracking.metaPixelId','tracking.clarityId','homepage.config','store.bundleDefaultDiscountPercent'])
  ]);
  res.json({ categories: categories.map(c => ({ id:c.id,name:c.name,slug:c.slug,description:c.description,image:c.imageUrl,seoTitle:c.seoTitle,seoDescription:c.seoDescription,count:c._count.products })), settings });
});

app.get('/api/categories', async (_req, res) => {
  setPublicCache(res, 900, 3600, ['categories']);
  const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } } });
  res.json(rows.map(c => ({ id:c.id,name:c.name,slug:c.slug,description:c.description,image:c.imageUrl,seoTitle:c.seoTitle,seoDescription:c.seoDescription,count:c._count.products,sortOrder:c.sortOrder,imageUrl:c.imageUrl })));
});

app.get('/api/products', async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1)); const limit = Math.min(100, Math.max(1, Number(req.query.limit || 12)));
  const search = String(req.query.search || '').trim(); const category = String(req.query.category || '').trim(); const sort = String(req.query.sort || 'newest');
  const featured = String(req.query.featured || '') === 'true';
  setPublicCache(res, 60, 300, ['products', ...(category ? [`category:${category}`] : []), ...(featured ? ['featured-products'] : [])]);
  const where: Prisma.ProductWhereInput = {
    status: 'PUBLISHED', ...(featured ? { featured: true } : {}), ...(category ? { category: { slug: category } } : {}),
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }, { category: { name: { contains: search, mode: 'insensitive' } } }] } : {})
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = sort === 'price-asc' ? [{ salePrice:'asc' },{ price:'asc' }] : sort === 'price-desc' ? [{ salePrice:'desc' },{ price:'desc' }] : [{ createdAt:'desc' }];
  const [rows,total] = await Promise.all([prisma.product.findMany({ where, select: productListSelect, orderBy, skip:(page-1)*limit, take:limit }), prisma.product.count({ where })]);
  res.json({ items: rows.map(jsonProductSummary), page, limit, total, totalPages: Math.max(1, Math.ceil(total/limit)) });
});
app.get('/api/products/slug/:slug', async (req,res) => { const slug=routeParam(req, 'slug'); setPublicCache(res, 120, 600, ['products', `product:${slug}`]); const row = await prisma.product.findFirst({ where:{ slug, status:'PUBLISHED' }, include: productInclude }); if(!row) return res.status(404).json({error:'NOT_FOUND'}); res.json(jsonProduct(row)); });
app.get('/api/pages/:slug', async (req,res) => { setPublicCache(res, 900, 3600, ['pages']); const slugs = [routeParam(req, 'slug'), ...String(req.query.fallback || '').split(',').filter(Boolean)]; const page = await prisma.page.findFirst({ where:{ slug:{in:slugs}, published:true } }); if(!page) return res.status(404).json({error:'NOT_FOUND'}); res.json(page); });
app.get('/api/settings/public', async (req,res) => { setPublicCache(res, 300, 1800, ['settings']); const keys = String(req.query.keys || '').split(',').filter(Boolean); res.json(await getSettings(keys)); });
app.get('/api/cities', async (_req,res) => { setPublicCache(res, 3600, 86400, ['cities']); res.json(await prisma.city.findMany({ where:{active:true}, orderBy:{name:'asc'} })); });
app.get('/api/seo/sitemap', async (_req,res) => { setPublicCache(res, 3600, 86400, ['seo']); const [products,categories,pages] = await Promise.all([prisma.product.findMany({where:{status:'PUBLISHED'},select:{slug:true,updatedAt:true}}),prisma.category.findMany({select:{slug:true,updatedAt:true}}),prisma.page.findMany({where:{published:true},select:{slug:true,updatedAt:true}})]); res.json({products,categories,pages}); });
app.get('/api/redirects/resolve', async (req,res)=>{setPublicCache(res,3600,86400,['redirects']);const sourcePath=String(req.query.path||'');const row=await prisma.redirect.findUnique({where:{sourcePath}});if(!row)return res.status(404).json({error:'NOT_FOUND'});res.json(row);});
app.get('/api/feed/meta.xml', async (_req,res)=>{setPublicCache(res,900,3600,['products','feed']);const products=await prisma.product.findMany({where:{status:'PUBLISHED'},include:{category:true,variants:{where:{active:true}}},orderBy:{updatedAt:'desc'}});const base=(process.env.NEXT_PUBLIC_SITE_URL||'https://zelvomart.com').replace(/\/$/,'');const x=(v:any)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');const items=products.map(p=>{const imgs=Array.isArray(p.images)?p.images.filter(i=>typeof i==='string'):[];const price=Number(p.price).toFixed(2);const sale=p.salePrice?Number(p.salePrice).toFixed(2):'';return `<item><g:id>${x(p.sku)}</g:id><g:title>${x(p.title)}</g:title><g:description>${x(p.shortDescription||p.title)}</g:description><g:availability>${p.stock>0?'in stock':'out of stock'}</g:availability><g:condition>new</g:condition><g:price>${price} PKR</g:price>${sale?`<g:sale_price>${sale} PKR</g:sale_price>`:''}<g:link>${x(`${base}/product/${p.slug}/`)}</g:link>${imgs[0]?`<g:image_link>${x(imgs[0])}</g:image_link>`:''}${imgs.slice(1,10).map(i=>`<g:additional_image_link>${x(i)}</g:additional_image_link>`).join('')}<g:brand>Zelvomart</g:brand><g:product_type>${x(p.category?.name||'')}</g:product_type></item>`}).join('');res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>Zelvomart</title><link>${base}</link><description>Zelvomart product feed</description>${items}</channel></rss>`);});

app.post('/api/orders', async (req,res) => {
  const parsed = checkoutSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'VALIDATION_ERROR',issues:parsed.error.flatten()});
  try { const order = await createOrder({ ...parsed.data, email: parsed.data.email || undefined, postcode: parsed.data.postcode || undefined, orderNotes: parsed.data.orderNotes || undefined, clientIp:req.ip, clientUserAgent:req.get('user-agent') || undefined }); await invalidateFrontendCache(['products']); res.status(201).json({ orderNumber: order.orderNumber, id: order.id, total: Number(order.total) }); }
  catch(e:any){ res.status(400).json({error:e?.message || 'ORDER_FAILED'}); }
});
app.post('/api/orders/track', async (req,res) => { const orderNumber=String(req.body.orderNumber||'').toUpperCase(); const phone=String(req.body.phone||'').replace(/\D/g,''); const order=await prisma.order.findFirst({where:{orderNumber, OR:[{phone:{endsWith:phone.slice(-10)}},{phone:{endsWith:phone.slice(-11)}}]},select:{orderNumber:true,status:true,postexTracking:true,createdAt:true,total:true}}); if(!order)return res.status(404).json({error:'NOT_FOUND'}); res.json({...order,total:Number(order.total),trackingUrl:order.postexTracking?postexTrackingUrl(order.postexTracking):null}); });
app.get('/api/orders/confirmation/:orderNumber', async (req,res) => { const order=await prisma.order.findUnique({where:{orderNumber:routeParam(req, 'orderNumber').toUpperCase()},include:{items:true}}); if(!order)return res.status(404).json({error:'NOT_FOUND'}); const city=await prisma.city.findUnique({where:{name:order.city}}); res.json({...order,subtotal:Number(order.subtotal),bundleSaving:Number(order.bundleSaving),deliveryFee:Number(order.deliveryFee),codFee:Number(order.codFee),total:Number(order.total),items:order.items.map(i=>({...i,unitPrice:Number(i.unitPrice),lineTotal:Number(i.lineTotal),bundleDiscount:Number(i.bundleDiscount)})),deliveryEstimate:city?`${city.deliveryMinDays}-${city.deliveryMaxDays} days`:null}); });
app.post('/api/checkout/abandoned', async (req,res) => { const phone=String(req.body.phone||'').trim(); if(phone.length<10)return res.json({ok:true}); const existing=await prisma.abandonedCheckout.findFirst({where:{phone,convertedAt:null},orderBy:{createdAt:'desc'}}); const data={phone,fullName:req.body.fullName||null,email:req.body.email||null,city:req.body.city||null,address:req.body.address||null,cart:req.body.cart||[],source:req.body.source||null}; if(existing) await prisma.abandonedCheckout.update({where:{id:existing.id},data}); else await prisma.abandonedCheckout.create({data}); res.json({ok:true}); });
app.post('/api/reviews', async (req,res) => { const productId=String(req.body.productId||''); const name=String(req.body.name||'').trim(); const body=String(req.body.body||'').trim(); const rating=Number(req.body.rating||0); if(!productId||!name||!body||rating<1||rating>5)return res.status(400).json({error:'VALIDATION_ERROR'}); const product=await prisma.product.findUnique({where:{id:productId},select:{id:true}}); if(!product)return res.status(404).json({error:'PRODUCT_NOT_FOUND'}); const review=await prisma.review.create({data:{productId,name,body,rating,status:'PENDING'}}); res.status(201).json({ok:true,id:review.id}); });
app.post('/api/events', async (req,res) => { const eventName=String(req.body.eventName||''); const eventId=String(req.body.eventId||''); const sessionReplayId=String(req.body.replaySessionId||'').trim()||null; if(!eventName||!eventId)return res.status(400).json({error:'INVALID_EVENT'}); const row=await prisma.eventLog.create({data:{eventName,eventId,sessionReplayId,channel:'browser',sourceUrl:req.body.sourceUrl||null,payload:req.body||{}}}); if(sessionReplayId){ prisma.sessionReplay.updateMany({where:{id:sessionReplayId},data:{lastSeenAt:new Date(),lastUrl:String(req.body.sourceUrl||''),...(eventName==='PageView'?{pageViews:{increment:1}}:{})}}).catch(()=>{}); } if(req.body.server===true){ sendMetaServerEvent({eventName,eventId,sourceUrl:req.body.sourceUrl,userAgent:req.get('user-agent')||undefined,ip:req.ip,customData:req.body.customData}).catch(()=>{}); } res.json({ok:true,id:row.id}); });

// Privacy-safe customer session replay ingestion. Input values are masked in the browser before these events arrive.
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
  await prisma.sessionReplay.upsert({
    where:{id:sessionId},
    update:{lastSeenAt:now,lastUrl,status:'ACTIVE'},
    create:{id:sessionId,visitorId,source:sourceName,medium:String((source as any).medium||(source as any).utm_medium||'').slice(0,120)||null,campaign:String((source as any).campaign||(source as any).utm_campaign||'').slice(0,240)||null,landingUrl,lastUrl,referrer:req.body.referrer?String(req.body.referrer).slice(0,4000):null,device:req.body.device?String(req.body.device).slice(0,40):null,viewport:req.body.viewport?String(req.body.viewport).slice(0,40):null,status:'ACTIVE',startedAt:Number.isNaN(startedAt.getTime())?now:startedAt,lastSeenAt:now,metadata:{firstTouch:(source as any).firstTouch||null,lastTouch:(source as any).lastTouch||null} as Prisma.InputJsonValue}
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
  await prisma.$transaction(async(tx)=>{
    await tx.sessionReplay.upsert({where:{id:sessionId},update:{lastSeenAt:now,lastUrl:currentUrl||undefined,status:'ACTIVE'},create:{id:sessionId,visitorId:sessionId,source:'direct',landingUrl:currentUrl,lastUrl:currentUrl,status:'ACTIVE',startedAt:now,lastSeenAt:now}});
    const existing=await tx.sessionReplayChunk.findUnique({where:{sessionId_sequence:{sessionId,sequence}},select:{id:true,eventCount:true}});
    if(existing){
      await tx.sessionReplayChunk.update({where:{id:existing.id},data:{events:events as Prisma.InputJsonValue,eventCount:events.length}});
      await tx.sessionReplay.update({where:{id:sessionId},data:{lastSeenAt:now,lastUrl:currentUrl||undefined,eventCount:{increment:events.length-existing.eventCount}}});
    }else{
      await tx.sessionReplayChunk.create({data:{sessionId,sequence,events:events as Prisma.InputJsonValue,eventCount:events.length}});
      await tx.sessionReplay.update({where:{id:sessionId},data:{lastSeenAt:now,lastUrl:currentUrl||undefined,eventCount:{increment:events.length},chunkCount:{increment:1}}});
    }
  });
  res.json({ok:true});
});

app.post('/api/session-replays/end', async (req,res) => {
  const sessionId=String(req.body.sessionId||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(sessionId)) return res.status(400).json({error:'INVALID_SESSION'});
  const endedAt=new Date(req.body.endedAt||Date.now());
  await prisma.sessionReplay.updateMany({where:{id:sessionId},data:{status:'ENDED',endedAt:Number.isNaN(endedAt.getTime())?new Date():endedAt,lastSeenAt:new Date(),lastUrl:String(req.body.currentUrl||'').slice(0,4000)}});
  res.json({ok:true});
});

app.post('/api/auth/login', async (req,res) => { const email=String(req.body.email||'').trim().toLowerCase(); const password=String(req.body.password||''); const user=await prisma.user.findUnique({where:{email}}); if(!user?.active || !(await bcrypt.compare(password,user.passwordHash))) return res.status(401).json({error:'INVALID_CREDENTIALS'}); const identity={id:user.id,name:user.name,email:user.email,role:user.role}; res.json({token:signAdminToken(identity),user:identity}); });
app.get('/api/auth/me', requireAuth(), async (req:AuthedRequest,res) => res.json({user:req.admin}));

app.get('/api/admin/dashboard', requireAuth('orders.read'), async (_req,res) => { const start=new Date();start.setHours(0,0,0,0); const yesterday=new Date(start.getTime()-86400000); const [todayOrders,yesterdayOrders,products,customers,failedJobs,events,recent]=await Promise.all([prisma.order.findMany({where:{createdAt:{gte:start}}}),prisma.order.findMany({where:{createdAt:{gte:yesterday,lt:start}}}),prisma.product.count({where:{status:'PUBLISHED'}}),prisma.customer.count(),prisma.job.count({where:{status:'FAILED'}}),prisma.eventLog.groupBy({by:['eventName'],where:{createdAt:{gte:start}},_count:{_all:true}}),prisma.order.findMany({orderBy:{createdAt:'desc'},take:8})]); res.json({ordersToday:todayOrders.length,revenueToday:todayOrders.reduce((s,o)=>s+Number(o.total),0),ordersYesterday:yesterdayOrders.length,revenueYesterday:yesterdayOrders.reduce((s,o)=>s+Number(o.total),0),delivered:todayOrders.filter(o=>o.status==='DELIVERED').length,failedJobs,products,customers,events:Object.fromEntries(events.map(e=>[e.eventName,e._count._all])),recent:recent.map(o=>({...o,total:Number(o.total)}))}); });

app.get('/api/admin/products', requireAuth('products.write'), async (req,res) => { const q=String(req.query.q||''); const status=String(req.query.status||''); const categoryId=String(req.query.categoryId||''); const where:Prisma.ProductWhereInput={...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{sku:{contains:q,mode:'insensitive'}}]}:{}),...(status?{status:status as ProductStatus}:{}),...(categoryId?{categoryId}:{})}; const rows=await prisma.product.findMany({where,include:{category:true,variants:true,reviews:true},orderBy:{updatedAt:'desc'},take:1000}); res.json(rows.map(jsonProduct)); });
app.get('/api/admin/products/:id', requireAuth('products.write'), async (req,res) => { const row=await prisma.product.findUnique({where:{id:routeParam(req, 'id')},include:{category:true,variants:true,reviews:true}}); if(!row)return res.status(404).json({error:'NOT_FOUND'}); res.json(jsonProduct(row)); });
app.post('/api/admin/products', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; const row=await prisma.product.create({data:{title:String(b.title),slug:String(b.slug),sku:String(b.sku),categoryId:b.categoryId||null,price:new Prisma.Decimal(Number(b.price||0)),salePrice:b.salePrice?new Prisma.Decimal(Number(b.salePrice)):null,costPrice:b.costPrice?new Prisma.Decimal(Number(b.costPrice)):null,stock:Number(b.stock||0),status:(b.status||'DRAFT') as ProductStatus,featured:Boolean(b.featured),bundleEnabled:b.bundleEnabled!==false,bundleDiscountPercent:b.bundleDiscountPercent?new Prisma.Decimal(Number(b.bundleDiscountPercent)):null,shortDescription:b.shortDescription||null,descriptionHtml:b.descriptionHtml||null,images:Array.isArray(b.images)?b.images:[],videoUrl:b.videoUrl||null,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,canonicalUrl:b.canonicalUrl||null}}); await audit(req,'create','Product',row.id); await invalidateFrontendCache(['products','featured-products','categories','store',`product:${row.slug}`]); res.status(201).json(row); });
app.patch('/api/admin/products/:id', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; const data:any={}; for(const k of ['title','slug','sku','categoryId','stock','status','featured','bundleEnabled','shortDescription','descriptionHtml','images','videoUrl','seoTitle','seoDescription','canonicalUrl']) if(k in b) data[k]=b[k] === '' ? null : b[k]; for(const k of ['price','salePrice','costPrice','bundleDiscountPercent']) if(k in b) data[k]=b[k]===''||b[k]==null?null:new Prisma.Decimal(Number(b[k])); if('stock'in data)data.stock=Number(data.stock||0); const row=await prisma.product.update({where:{id:routeParam(req, 'id')},data}); await audit(req,'update','Product',row.id); await invalidateFrontendCache(['products','featured-products','categories','store',`product:${row.slug}`]); res.json(row); });
app.delete('/api/admin/products/:id', requireAuth('products.write'), async (req:AuthedRequest,res) => { await prisma.product.delete({where:{id:routeParam(req, 'id')}}); await audit(req,'delete','Product',routeParam(req, 'id')); await invalidateFrontendCache(['products','featured-products','categories','store']); res.json({ok:true}); });
app.post('/api/admin/products/:id/variants', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; const row=await prisma.variant.create({data:{productId:routeParam(req, 'id'),sku:String(b.sku),name:String(b.name),attributes:b.attributes||{},priceOverride:b.priceOverride?new Prisma.Decimal(Number(b.priceOverride)):null,stock:Number(b.stock||0),imageUrl:b.imageUrl||null,active:b.active!==false}}); await audit(req,'create','Variant',row.id); await invalidateFrontendCache(['products']); res.status(201).json(row); });
app.delete('/api/admin/variants/:id', requireAuth('products.write'), async (req:AuthedRequest,res)=>{await prisma.variant.delete({where:{id:routeParam(req, 'id')}});await audit(req,'delete','Variant',routeParam(req, 'id'));await invalidateFrontendCache(['products']);res.json({ok:true});});

app.get('/api/admin/categories', requireAuth('products.write'), async (_req,res) => { const rows=await prisma.category.findMany({orderBy:{sortOrder:'asc'},include:{_count:{select:{products:true}}}}); res.json(rows.map(r=>({...r,count:r._count.products}))); });
app.post('/api/admin/categories', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; const row=await prisma.category.create({data:{name:String(b.name),slug:String(b.slug),sortOrder:Number(b.sortOrder||0),imageUrl:b.imageUrl||null,description:b.description||null,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null}});await audit(req,'create','Category',row.id);await invalidateFrontendCache(['categories','products','store']);res.status(201).json(row);});
app.patch('/api/admin/categories/:id', requireAuth('products.write'), async (req:AuthedRequest,res) => { const b=req.body; const row=await prisma.category.update({where:{id:routeParam(req, 'id')},data:{name:b.name,slug:b.slug,sortOrder:b.sortOrder==null?undefined:Number(b.sortOrder),imageUrl:b.imageUrl===undefined?undefined:(b.imageUrl||null),description:b.description===undefined?undefined:(b.description||null),seoTitle:b.seoTitle===undefined?undefined:(b.seoTitle||null),seoDescription:b.seoDescription===undefined?undefined:(b.seoDescription||null)}});await audit(req,'update','Category',row.id);await invalidateFrontendCache(['categories','products','store']);res.json(row);});
app.delete('/api/admin/categories/:id', requireAuth('products.write'), async (req:AuthedRequest,res)=>{await prisma.category.delete({where:{id:routeParam(req, 'id')}});await audit(req,'delete','Category',routeParam(req, 'id'));await invalidateFrontendCache(['categories','products','store']);res.json({ok:true});});

app.get('/api/admin/orders', requireAuth('orders.read'), async (req,res)=>{const q=String(req.query.q||'');const status=String(req.query.status||'');const city=String(req.query.city||'');const source=String(req.query.source||'');const where:Prisma.OrderWhereInput={...(status?{status:status as OrderStatus}:{}),...(city?{city:{contains:city,mode:'insensitive'}}:{}),...(source?{source:{contains:source,mode:'insensitive'}}:{}),...(q?{OR:[{orderNumber:{contains:q,mode:'insensitive'}},{fullName:{contains:q,mode:'insensitive'}},{phone:{contains:q}}]}:{})};const rows=await prisma.order.findMany({where,orderBy:{createdAt:'desc'},take:1000});res.json(rows.map(r=>({...r,total:Number(r.total)})));});
app.get('/api/admin/orders/:id', requireAuth('orders.read'), async (req,res)=>{const row=await prisma.order.findUnique({where:{id:routeParam(req, 'id')},include:{items:true,statusHistory:{include:{user:true},orderBy:{createdAt:'desc'}},customer:true}});if(!row)return res.status(404).json({error:'NOT_FOUND'});res.json({...row,total:Number(row.total),subtotal:Number(row.subtotal),bundleSaving:Number(row.bundleSaving),deliveryFee:Number(row.deliveryFee),codFee:Number(row.codFee),items:row.items.map(i=>({...i,unitPrice:Number(i.unitPrice),lineTotal:Number(i.lineTotal),bundleDiscount:Number(i.bundleDiscount)})),trackingUrl:row.postexTracking?postexTrackingUrl(row.postexTracking):null});});
app.patch('/api/admin/orders/:id/status', requireAuth('orders.write'), async (req:AuthedRequest,res)=>{const next=String(req.body.status) as OrderStatus;if(!Object.values(OrderStatus).includes(next))return res.status(400).json({error:'INVALID_STATUS'});const existing=await prisma.order.findUnique({where:{id:routeParam(req, 'id')}});if(!existing)return res.status(404).json({error:'NOT_FOUND'});if(!['CANCELLED','RETURNED'].includes(existing.status)&&['CANCELLED','RETURNED'].includes(next))await restoreOrderStock(routeParam(req, 'id'));await prisma.$transaction([prisma.order.update({where:{id:routeParam(req, 'id')},data:{status:next}}),prisma.orderStatusHistory.create({data:{orderId:routeParam(req, 'id'),from:existing.status,to:next,userId:req.admin?.id,note:req.body.note||null}})]);await audit(req,'status_change','Order',routeParam(req, 'id'),{from:existing.status,to:next});if(['CANCELLED','RETURNED'].includes(next))await invalidateFrontendCache(['products']);res.json({ok:true});});
app.patch('/api/admin/orders/:id/tracking', requireAuth('orders.write'), async (req:AuthedRequest,res)=>{const tracking=String(req.body.tracking||'').trim();const existing=await prisma.order.findUnique({where:{id:routeParam(req, 'id')}});if(!existing)return res.status(404).json({error:'NOT_FOUND'});await prisma.order.update({where:{id:routeParam(req, 'id')},data:{postexTracking:tracking||null,status:tracking?'BOOKED':existing.status}});if(tracking&&existing.status!=='BOOKED')await prisma.orderStatusHistory.create({data:{orderId:routeParam(req, 'id'),from:existing.status,to:'BOOKED',userId:req.admin?.id,note:`PostEx tracking ${tracking}`}});await audit(req,'tracking_update','Order',routeParam(req, 'id'),{tracking});res.json({ok:true});});

app.get('/api/admin/customers', requireAuth('customers.read'), async (_req,res)=>{const rows=await prisma.customer.findMany({include:{orders:{select:{total:true,status:true}}},orderBy:{updatedAt:'desc'},take:1000});res.json(rows.map(c=>({...c,totalSpent:c.orders.reduce((s,o)=>s+Number(o.total),0),orderCount:c.orders.length})));});
app.patch('/api/admin/customers/:id/blocklist', requireAuth('customers.write'), async (req:AuthedRequest,res)=>{const current=await prisma.customer.findUnique({where:{id:routeParam(req, 'id')}});if(!current)return res.status(404).json({error:'NOT_FOUND'});const row=await prisma.customer.update({where:{id:routeParam(req, 'id')},data:{blocklisted:!current.blocklisted}});await audit(req,'toggle_blocklist','Customer',row.id,{blocklisted:row.blocklisted});res.json(row);});

app.get('/api/admin/pages', requireAuth('content.write'), async (_req,res)=>res.json(await prisma.page.findMany({orderBy:{slug:'asc'}})));
app.patch('/api/admin/pages/:id', requireAuth('content.write'), async (req:AuthedRequest,res)=>{const b=req.body;const row=await prisma.page.update({where:{id:routeParam(req, 'id')},data:{title:b.title,slug:b.slug,bodyHtml:b.bodyHtml,seoTitle:b.seoTitle||null,seoDescription:b.seoDescription||null,published:b.published!==false}});await audit(req,'update','Page',row.id);await invalidateFrontendCache(['pages']);res.json(row);});

app.get('/api/admin/settings', requireAuth('settings.write'), async (_req,res)=>{const [settings,cities]=await Promise.all([prisma.setting.findMany(),prisma.city.findMany({orderBy:{name:'asc'}})]);res.json({settings:Object.fromEntries(settings.filter(s=>!isSensitiveSettingKey(s.key)).map(s=>[s.key,s.value])),cities});});
app.put('/api/admin/settings', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{for(const [key,value] of Object.entries(req.body||{}))await setSetting(key,value);await audit(req,'update','Settings',undefined,{keys:Object.keys(req.body||{})});await invalidateFrontendCache(['settings','store']);res.json({ok:true});});
app.put('/api/admin/cities', requireAuth('settings.write'), async (req:AuthedRequest,res)=>{const cities=Array.isArray(req.body.cities)?req.body.cities:[];for(const c of cities){if(!c.name)continue;await prisma.city.upsert({where:{name:String(c.name)},update:{deliveryMinDays:Number(c.deliveryMinDays||2),deliveryMaxDays:Number(c.deliveryMaxDays||5),active:c.active!==false},create:{name:String(c.name),deliveryMinDays:Number(c.deliveryMinDays||2),deliveryMaxDays:Number(c.deliveryMaxDays||5),active:c.active!==false}});}await audit(req,'update','Cities');await invalidateFrontendCache(['cities']);res.json({ok:true});});

app.get('/api/admin/users', requireAuth('users.write'), async (_req,res)=>res.json(await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,active:true,createdAt:true,updatedAt:true},orderBy:{createdAt:'desc'}})));
app.post('/api/admin/users', requireAuth('users.write'), async (req:AuthedRequest,res)=>{const password=String(req.body.password||'');if(password.length<8)return res.status(400).json({error:'PASSWORD_TOO_SHORT'});const row=await prisma.user.create({data:{name:String(req.body.name),email:String(req.body.email).toLowerCase(),passwordHash:await bcrypt.hash(password,12),role:(req.body.role||'ORDER_AGENT') as Role,active:req.body.active!==false}});await audit(req,'create','User',row.id);res.status(201).json({id:row.id,name:row.name,email:row.email,role:row.role,active:row.active});});
app.patch('/api/admin/users/:id', requireAuth('users.write'), async (req:AuthedRequest,res)=>{const data:any={};for(const k of ['name','email','role','active'])if(k in req.body)data[k]=req.body[k];if(req.body.password)data.passwordHash=await bcrypt.hash(String(req.body.password),12);const row=await prisma.user.update({where:{id:routeParam(req, 'id')},data});await audit(req,'update','User',row.id);res.json({id:row.id,name:row.name,email:row.email,role:row.role,active:row.active});});

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
    prisma.sessionReplayChunk.findMany({where:{sessionId:id},orderBy:{sequence:'asc'},take:500}),
    prisma.order.findFirst({where:{replaySessionId:id},select:{id:true,orderNumber:true,total:true,source:true,createdAt:true}}),
    prisma.eventLog.findMany({where:{sessionReplayId:id,eventName:{in:['PageView','ViewContent','AddToCart','InitiateCheckout','Purchase']}},select:{eventName:true,sourceUrl:true,createdAt:true,payload:true},orderBy:{createdAt:'asc'},take:500}),
  ]);
  if(!session) return res.status(404).json({error:'NOT_FOUND'});
  const events=chunks.flatMap(chunk=>Array.isArray(chunk.events)?chunk.events:[]);
  res.json({session:{...session,durationMs:Math.max(0,Number((session.endedAt||session.lastSeenAt).getTime()-session.startedAt.getTime()))},events,order:order?{...order,total:Number(order.total)}:null,markers});
});

app.delete('/api/admin/session-replays/:id', requireAuth('reports.read'), async (req:AuthedRequest,res)=>{
  const id=routeParam(req,'id');
  await prisma.sessionReplay.deleteMany({where:{id}});
  await audit(req,'delete','SessionReplay',id);
  res.json({ok:true});
});

app.get('/api/admin/experiments', requireAuth('reports.read'), async (_req,res)=>res.json(await prisma.experiment.findMany({orderBy:{createdAt:'desc'}})));
app.post('/api/admin/experiments', requireAuth('content.write'), async (req:AuthedRequest,res)=>{const row=await prisma.experiment.create({data:{name:String(req.body.name),pagePattern:String(req.body.pagePattern||'/'),variants:req.body.variants||{},trafficSplit:req.body.trafficSplit||{},status:(req.body.status||'DRAFT') as ExperimentStatus}});await audit(req,'create','Experiment',row.id);res.status(201).json(row);});
app.patch('/api/admin/experiments/:id', requireAuth('content.write'), async (req:AuthedRequest,res)=>{const row=await prisma.experiment.update({where:{id:routeParam(req, 'id')},data:req.body});await audit(req,'update','Experiment',row.id);res.json(row);});
app.get('/api/admin/jobs', requireAuth('reports.read'), async (_req,res)=>res.json(await prisma.job.findMany({orderBy:{createdAt:'desc'},take:500})));
app.get('/api/admin/tracking', requireAuth('reports.read'), async (_req,res)=>{const since=new Date(Date.now()-7*86400000);const events=await prisma.eventLog.findMany({where:{createdAt:{gte:since}},orderBy:{createdAt:'desc'},take:1000});const grouped=await prisma.eventLog.groupBy({by:['eventName'],where:{createdAt:{gte:since}},_count:{_all:true}});res.json({counts:Object.fromEntries(grouped.map(e=>[e.eventName,e._count._all])),errors:events.filter(e=>e.error||e.accepted===false).slice(0,100),lastSuccess:events.find(e=>e.accepted===true)?.createdAt||null});});
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

app.get('/api/admin/reports', requireAuth('reports.read'), async (_req,res)=>{const since=new Date(Date.now()-30*86400000);const [orders,events]=await Promise.all([prisma.order.findMany({where:{createdAt:{gte:since}},include:{items:true}}),prisma.eventLog.groupBy({by:['eventName'],where:{createdAt:{gte:since},channel:'browser'},_count:{_all:true}})]);const products=new Map<string,{title:string,qty:number,revenue:number}>();for(const o of orders)for(const i of o.items){const row=products.get(i.sku)||{title:i.title,qty:0,revenue:0};row.qty+=i.quantity;row.revenue+=Number(i.lineTotal);products.set(i.sku,row);}res.json({orders:orders.length,revenue:orders.reduce((s,o)=>s+Number(o.total),0),events:Object.fromEntries(events.map(e=>[e.eventName,e._count._all])),products:[...products.entries()].map(([sku,v])=>({sku,...v})).sort((a,b)=>b.revenue-a.revenue)});});
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

app.post('/api/admin/products/import', requireAuth('products.write'), async (req:AuthedRequest,res)=>{
  const rows=Array.isArray(req.body?.rows)?req.body.rows:[]; let created=0,updated=0,skipped=0; const errors:string[]=[];
  const categories=await prisma.category.findMany(); const byName=new Map(categories.map(c=>[c.name.toLowerCase(),c])); const bySlug=new Map(categories.map(c=>[c.slug.toLowerCase(),c]));
  for(let i=0;i<rows.length;i++){const r=rows[i]||{};try{const sku=String(r.sku||'').trim();const title=String(r.title||r.name||'').trim();if(!sku||!title){skipped++;continue;} const slug=String(r.slug||title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).trim(); const catRaw=String(r.category||r.categoryName||'').trim().toLowerCase(); const cat=byName.get(catRaw)||bySlug.get(catRaw); const images=String(r.imageUrls||r.images||'').split(/[|;]/).map((x:string)=>x.trim()).filter(Boolean); const data:any={title,slug,categoryId:cat?.id||null,price:new Prisma.Decimal(Number(r.price||0)),salePrice:r.salePrice?new Prisma.Decimal(Number(r.salePrice)):null,costPrice:r.costPrice?new Prisma.Decimal(Number(r.costPrice)):null,stock:Number(r.stock||0),status:(String(r.status||'DRAFT').toUpperCase() as ProductStatus),featured:['1','true','yes'].includes(String(r.featured||'').toLowerCase()),shortDescription:r.shortDescription||null,descriptionHtml:r.descriptionHtml||null,images,videoUrl:r.videoUrl||null,seoTitle:r.seoTitle||null,seoDescription:r.seoDescription||null}; const existing=await prisma.product.findUnique({where:{sku}}); if(existing){await prisma.product.update({where:{id:existing.id},data});updated++;}else{await prisma.product.create({data:{...data,sku}});created++;}}catch(e:any){errors.push(`Row ${i+2}: ${e?.message||'failed'}`);skipped++;}}
  await audit(req,'csv_import','Product',undefined,{created,updated,skipped,errors:errors.slice(0,25)}); await invalidateFrontendCache(['products','featured-products','categories','store']); res.json({created,updated,skipped,errors});
});
app.get('/api/admin/products/template.csv', requireAuth('products.write'), (_req,res)=>{res.type('text/csv').send('title,slug,sku,category,price,salePrice,costPrice,stock,status,featured,shortDescription,descriptionHtml,imageUrls,videoUrl,seoTitle,seoDescription\n');});
app.get('/api/admin/products/export.csv', requireAuth('orders.export'), async (_req,res)=>{const rows=await prisma.product.findMany({include:{category:true},orderBy:{updatedAt:'desc'}});const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv=['title,slug,sku,category,price,salePrice,costPrice,stock,status,featured,shortDescription,descriptionHtml,imageUrls,videoUrl,seoTitle,seoDescription',...rows.map(p=>[p.title,p.slug,p.sku,p.category?.name||'',p.price,p.salePrice||'',p.costPrice||'',p.stock,p.status,p.featured,p.shortDescription||'',p.descriptionHtml||'',Array.isArray(p.images)?p.images.join('|'):'',p.videoUrl||'',p.seoTitle||'',p.seoDescription||''].map(esc).join(','))].join('\n');res.type('text/csv').send(csv);});
app.get('/api/admin/orders/export.csv', requireAuth('orders.export'), async (_req,res)=>{const rows=await prisma.order.findMany({orderBy:{createdAt:'desc'},take:5000});const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv=['orderNumber,date,customer,phone,city,status,total,source',...rows.map(o=>[o.orderNumber,o.createdAt.toISOString(),o.fullName,o.phone,o.city,o.status,o.total,o.source||''].map(esc).join(','))].join('\n');res.type('text/csv').send(csv);});
app.post('/api/admin/upload', requireAuth('products.write'), upload.single('file'), async (req,res)=>{if(!req.file)return res.status(400).json({error:'FILE_REQUIRED'});const safe=req.file.originalname.replace(/[^a-zA-Z0-9._-]/g,'-');const url=await uploadObject(`products/${Date.now()}-${safe}`,req.file.buffer,req.file.mimetype);res.json({url});});

app.use((err:any,_req:any,res:any,_next:any)=>{console.error(err);res.status(500).json({error:'SERVER_ERROR',message:process.env.NODE_ENV==='development'?err?.message:undefined});});
export { app };
export default app;
if (!process.env.VERCEL) app.listen(port,()=>console.log(`Zelvomart backend listening on http://localhost:${port}`));
