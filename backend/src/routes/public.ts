import { customerReviewUpload, storeReviewFiles } from "../admin-reviews";
import {
  stageReviewUpload,
  hydrateReviewUploads,
  reviewChunkUpload,
  writeReviewChunk,
  completeReviewChunks,
} from "../lib/review-staging";
import { validateCoupon } from "../lib/coupons";
import { catalogQuery } from "../lib/catalog-query";
import { publicSettingKeys } from "../lib/public-settings";
import { SITE_ORIGIN, isStorefrontUrl } from "../lib/site-url";
import { seoSitemapIndex } from "../lib/seo-sitemap";
import { replayStorageConfigured } from "../lib/replay-storage";
import { catalogFeed } from "../lib/catalog-feed";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db";
import { createOrder } from "../lib/order";
import { MAX_LINE_PIECES, checkoutSchema } from "../lib/validators";
import { normalizePakistanPhone } from "../lib/phone";
import { getSetting, getSettings, setSetting } from "../lib/settings";
import { postexTrackingUrl } from "../lib/postex";
import { invalidateFrontendCache } from "../lib/cache-invalidation";
import { bundleLineTotal, priceSummary, variantPriceSummary } from "../lib/pricing";
import { sendContactTeamEmail } from "../lib/email";
import { dispatchJobRow } from "../lib/jobs";
import { STORE_LIMITS, checkoutRateRules, requestIp } from "../lib/rate-limit";
import { processJobRow } from "../lib/job-processor";
import { sendDailySummary } from "../lib/daily-summary";
import { sendAutomaticRecoveryEmails } from "../recovery";
import { waitUntil } from "@vercel/functions";
import { timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import {
  allowRequest,
  allowRules,
  jsonProduct,
  jsonProductSummary,
  productInclude,
  productListSelect,
  routeParam,
  setNoStore,
  setPublicCache,
  upload,
} from "../http/shared";

export function registerPublicRoutes(app: Express) {
  const cronAuthorized = (req: any) => {
    const expected = process.env.CRON_SECRET || "";
    const authorization = String(req.get("authorization") || "");
    const supplied = /^Bearer\s+(.+)$/i.exec(authorization)?.[1] || "";
    if (!expected || !supplied) return false;
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(supplied);
    return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
  };

  // Cron-job.org calls this once per minute when JOB_MODE=cron. Job rows stay durable in Postgres.
  app.post("/api/cron/jobs", async (req, res) => {
    if (process.env.JOB_MODE !== "cron") return res.status(409).json({ error: "CRON_JOB_MODE_DISABLED" });
    if (!cronAuthorized(req))
      return res.status(process.env.CRON_SECRET ? 401 : 503).json({ error: "CRON_UNAUTHORIZED" });
    const now = Date.now();
    const staleBefore = new Date(now - 10 * 60 * 1000);
    const retryBefore = new Date(now - 60 * 1000);
    await prisma.job.updateMany({
      where: { status: "RUNNING", startedAt: { lt: staleBefore } },
      data: { status: "FAILED", error: "Worker lease expired after ten minutes.", finishedAt: new Date(now) },
    });
    const eligible = {
      name: {
        in: [
          "order-team-email",
          "customer-order-email",
          "customer-status-email",
          "meta-event",
          "meta-purchase",
          "tiktok-event",
          "tiktok-purchase",
        ],
      },
      externalId: null,
      attempts: { lt: 5 },
      createdAt: { gte: new Date(now - 7 * 86400000) },
      OR: [{ status: "QUEUED" as const }, { status: "FAILED" as const, updatedAt: { lte: retryBefore } }],
    };
    const rows = await prisma.job.findMany({
      where: eligible,
      orderBy: { createdAt: "asc" },
      take: 25,
      select: { id: true },
    });
    const deadline = now + 20 * 1000;
    let processed = 0,
      succeeded = 0,
      failed = 0,
      skipped = 0;
    for (const { id } of rows) {
      // Leave enough room for one provider call (which has a 15s network timeout) and cleanup.
      if (Date.now() + 15 * 1000 >= deadline) break;
      try {
        const result = await processJobRow(id);
        processed++;
        if (result && typeof result === "object" && "skipped" in result) skipped++;
        else succeeded++;
      } catch {
        processed++;
        failed++;
      }
    }
    const remaining = await prisma.job.count({ where: eligible });
    // Left carts: send the 5% offer email once, about an hour after the cart was left.
    let cartOffers: { sent: number; failed: number } | { error: string } = { sent: 0, failed: 0 };
    if (Date.now() + 15 * 1000 < deadline)
      cartOffers = await sendAutomaticRecoveryEmails().catch(() => ({ error: "CART_OFFER_FAILED" }));
    res.json({ processed, succeeded, failed, skipped, remaining, cartOffers });
  });

  // Daily maintenance that previously depended on pg-boss schedules.
  const runDailyCron = async (req: any, res: any) => {
    if (process.env.JOB_MODE !== "cron") return res.status(409).json({ error: "CRON_JOB_MODE_DISABLED" });
    if (!cronAuthorized(req))
      return res.status(process.env.CRON_SECRET ? 401 : 503).json({ error: "CRON_UNAUTHORIZED" });
    const cutoff = new Date(Date.now() - 2 * 86400000);
    const rateLimits = await prisma.rateLimitBucket.deleteMany({ where: { updatedAt: { lt: cutoff } } });
    const configuredDays = Number(
      await getSetting("tracking.sessionReplayRetentionDays", process.env.SESSION_REPLAY_RETENTION_DAYS || 30),
    );
    const retentionDays = Number.isFinite(configuredDays) && configuredDays > 0 ? Math.min(configuredDays, 365) : 30;
    const replays = await prisma.sessionReplay.deleteMany({
      where: { startedAt: { lt: new Date(Date.now() - retentionDays * 86400000) } },
    });
    const summary = await sendDailySummary();
    const dataCutoff = new Date(Date.now() - 30 * 86400000);
    const [jobs, events] = await Promise.all([
      prisma.job.deleteMany({ where: { createdAt: { lt: dataCutoff } } }),
      prisma.eventLog.deleteMany({ where: { createdAt: { lt: dataCutoff } } }),
    ]);
    res.json({
      rateLimitBucketsRemoved: rateLimits.count,
      expiredReplaysRemoved: replays.count,
      oldJobsRemoved: jobs.count,
      oldEventsRemoved: events.count,
      summary,
    });
  };
  app.get("/api/cron/daily", runDailyCron);
  app.post("/api/cron/daily", runDailyCron);

  // The backend is an API only; the root just says it is running (the shop is on the frontend).
  app.get("/", (_req, res) => {
    setNoStore(res);
    res.json({ ok: true, service: "zelvomart-backend", health: "/api/health" });
  });
  app.get("/api/health", async (_req, res) => {
    setNoStore(res);
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        ok: true,
        version: "2.0.0",
        features: { cro: true, marketing: true, sessionReplays: true, tracking: true, capi: true },
      });
    } catch (e: any) {
      res.status(503).json({ ok: false, version: "2.0.0", error: e?.message || "DB_UNAVAILABLE" });
    }
  });

  app.post("/api/contact", async (req, res) => {
    setNoStore(res);
    if (!(await allowRequest(req, res, "contact", 10, 60 * 60 * 1000))) return;
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const problem = String(req.body?.problem || "").trim();
    const website = String(req.body?.website || "").trim();

    // Honeypot: silently accept likely bot submissions.
    if (website) return res.status(201).json({ ok: true });
    if (!name || name.length > 100)
      return res.status(400).json({ error: "INVALID_NAME", message: "Please enter your name." });
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 160)
      return res.status(400).json({ error: "INVALID_EMAIL", message: "Please enter a valid email address." });
    if (phone.length < 7 || phone.length > 40)
      return res.status(400).json({ error: "INVALID_PHONE", message: "Please enter a valid phone number." });
    if (problem.length < 5 || problem.length > 2000)
      return res
        .status(400)
        .json({ error: "INVALID_MESSAGE", message: "Please add a little more detail about the problem." });

    try {
      await sendContactTeamEmail({ name, email, phone, problem, sourceUrl: String(req.get("referer") || "") });
      return res.status(201).json({ ok: true });
    } catch (error: any) {
      console.error("Contact form email failed", error);
      return res.status(503).json({
        error: "CONTACT_DELIVERY_FAILED",
        message: "We could not send your message right now. Please use WhatsApp or try again shortly.",
      });
    }
  });

  app.get("/api/store/bootstrap", async (_req, res) => {
    setNoStore(res);
    const [categories, settings] = await Promise.all([
      prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { products: { where: { status: "PUBLISHED" } } } } },
      }),
      getSettings([
        "store.info",
        "store.delivery",
        "tracking.metaPixelEnabled",
        "tracking.metaPixelId",
        "tracking.tiktokPixelEnabled",
        "tracking.tiktokPixelId",
        "tracking.sessionReplayEnabled",
        "tracking.sessionReplayRetentionDays",
        "homepage.config",
        "store.bundleDefaultDiscountPercent",
      ]),
    ]);
    // Recordings go to the private R2 bucket only. Without it the storefront does not load the recorder at all.
    if (!replayStorageConfigured()) settings["tracking.sessionReplayEnabled"] = false;
    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.imageUrl,
        seoTitle: c.seoTitle,
        seoDescription: c.seoDescription,
        count: c._count.products,
      })),
      settings,
    });
  });

  app.get("/api/categories", async (_req, res) => {
    setPublicCache(res, 900, 3600, ["categories"]);
    const rows = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: { where: { status: "PUBLISHED" } } } } },
    });
    res.json(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.imageUrl,
        seoTitle: c.seoTitle,
        seoDescription: c.seoDescription,
        count: c._count.products,
        sortOrder: c.sortOrder,
        imageUrl: c.imageUrl,
      })),
    );
  });

  app.get("/api/products", async (req, res) => {
    if (
      String(req.query.search || "").trim() &&
      !(await allowRequest(req, res, "search", STORE_LIMITS.searchPerIp.limit, STORE_LIMITS.searchPerIp.windowMs))
    )
      return;
    const rawPage = Math.floor(Number(req.query.page)),
      rawLimit = Math.floor(Number(req.query.limit));
    const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1,
      limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 12;
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const sort = String(req.query.sort || "popular");
    const featured = String(req.query.featured || "") === "true";
    const minPriceRaw = Number(req.query.minPrice);
    const maxPriceRaw = Number(req.query.maxPrice);
    const minPrice = Number.isFinite(minPriceRaw) && minPriceRaw >= 0 ? minPriceRaw : undefined;
    const maxPrice = Number.isFinite(maxPriceRaw) && maxPriceRaw >= 0 ? maxPriceRaw : undefined;
    const availability = String(req.query.availability || "").trim();
    const tag = String(req.query.tag || "")
      .trim()
      .replace(/[^a-z0-9-]/gi, "");
    setNoStore(res);
    const query = catalogQuery({ search, category, featured, minPrice, maxPrice, availability, tag, sort });
    const [rank, counts] = await Promise.all([
      prisma.$queryRaw<{ id: string; orders: bigint }[]>(
        Prisma.sql`SELECT p.id,COALESCE(s.orders,0) AS orders ${query.from} ORDER BY ${query.order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      ),
      prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${query.from}`),
    ]);
    const rows = rank.length
      ? await prisma.product.findMany({ where: { id: { in: rank.map((r) => r.id) } }, select: productListSelect })
      : [];
    const byId = new Map(rows.map((row) => [row.id, row])),
      total = Number(counts[0]?.total || 0);
    const discount = Number(await getSetting("store.bundleDefaultDiscountPercent", 5));
    res.json({
      items: rank.flatMap((r) => {
        const row = byId.get(r.id);
        return row ? [jsonProductSummary({ ...row, _count: { orderItems: Number(r.orders) } }, discount)] : [];
      }),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });
  app.get("/api/products/slug/:slug", async (req, res) => {
    const slug = routeParam(req, "slug");
    setNoStore(res);
    const row = await prisma.product.findFirst({ where: { slug, status: "PUBLISHED" }, include: productInclude });
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(jsonProduct(row, Number(await getSetting("store.bundleDefaultDiscountPercent", 5))));
  });
  app.get("/api/pages/:slug", async (req, res) => {
    setPublicCache(res, 900, 3600, ["pages"]);
    const slugs = [
      routeParam(req, "slug"),
      ...String(req.query.fallback || "")
        .split(",")
        .filter(Boolean),
    ];
    const page = await prisma.page.findFirst({ where: { slug: { in: slugs }, published: true } });
    if (!page) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(page);
  });
  app.get("/api/settings/public", async (req, res) => {
    setNoStore(res);
    const keys = publicSettingKeys(req.query.keys);
    res.json(keys.length ? await getSettings(keys) : {});
  });
  app.get("/api/cities", async (_req, res) => {
    setNoStore(res);
    res.json(await prisma.city.findMany({ where: { active: true }, orderBy: { name: "asc" } }));
  });
  app.get("/api/seo/sitemap", async (_req, res) => {
    setPublicCache(res, 3600, 86400, ["seo"]);
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        select: {
          slug: true,
          title: true,
          status: true,
          updatedAt: true,
          sourceUrl: true,
          images: true,
          category: { select: { slug: true } },
        },
      }),
      prisma.category.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          slug: true,
          name: true,
          updatedAt: true,
          imageUrl: true,
          _count: { select: { products: { where: { status: "PUBLISHED" } } } },
        },
      }),
    ]);
    res.json(seoSitemapIndex(products, categories, SITE_ORIGIN));
  });
  // Every redirect, for the storefront proxy: it answers old URLs with a real 301 before the page renders.
  app.get("/api/redirects/map", async (_req, res) => {
    setPublicCache(res, 120, 600, ["redirects"]);
    const rows = await prisma.redirect.findMany({
      select: { sourcePath: true, destination: true, permanent: true },
      take: 20000,
    });
    res.json(rows.map((r) => [r.sourcePath, r.destination, r.permanent ? 1 : 0]));
  });
  app.get("/api/redirects/resolve", async (req, res) => {
    setPublicCache(res, 3600, 86400, ["redirects"]);
    const sourcePath = String(req.query.path || "");
    const row = await prisma.redirect.findUnique({ where: { sourcePath } });
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(row);
  });
  for (const platform of ["meta", "tiktok", "google"] as const) {
    app.get(`/api/feed/${platform}.xml`, async (_req, res) => {
      setPublicCache(res, 300, 600, ["products", "feed"]);
      const feed = await catalogFeed(platform);
      void setSetting("health.feed." + platform, {
        at: new Date().toISOString(),
        count: feed.count,
        missingImages: feed.missingImages.length,
      }).catch(() => undefined);
      res.setHeader("X-Catalog-Items", String(feed.count));
      res.setHeader("X-Catalog-Missing-Images", String(feed.missingImages.length));
      res.type("application/xml").send(feed.xml);
    });
  }

  app.post("/api/orders", async (req, res) => {
    const rawPhone = String(req.body?.phone || "")
      .replace(/\D/g, "")
      .slice(-10);
    // Generous per IP (many shoppers share one mobile-network IP); 6 orders per phone number on any IP.
    const [ipRule, phoneRule] = checkoutRateRules(requestIp(req), rawPhone);
    if (!(await allowRules(res, rawPhone ? [ipRule, phoneRule] : [ipRule]))) return;
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() });
    try {
      // The order is saved when createOrder returns; the customer gets the answer right away. Job dispatch and the
      // cache refresh run after the response (waitUntil). The Job rows are already saved, so the worker's
      // job-recovery picks up any that fail to dispatch here.
      const order = await createOrder(
        {
          ...parsed.data,
          email: parsed.data.email || undefined,
          postcode: parsed.data.postcode || undefined,
          orderNotes: parsed.data.orderNotes || undefined,
          trackingAllowed: isStorefrontUrl(req.get("origin") || req.get("referer") || ""),
          clientIp: requestIp(req),
          clientUserAgent: req.get("user-agent") || undefined,
        },
        { dispatchJobs: false },
      );
      res.status(201).json({
        orderNumber: order.orderNumber,
        id: order.id,
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.deliveryFee),
        discount: Number(order.couponDiscount || 0),
        total: Number(order.total),
      });
      const jobIds: string[] = (order as { jobIds?: string[] }).jobIds || [];
      const soldOut: string[] = (order as { soldOutSlugs?: string[] }).soldOutSlugs || [];
      const immediateJobs = await prisma.job.findMany({
        where: {
          id: { in: jobIds },
          name: { in: ["order-team-email", "customer-order-email", "meta-event", "meta-purchase"] },
        },
        select: { id: true },
      });
      waitUntil(
        Promise.allSettled([
          ...immediateJobs.map(({ id }) => processJobRow(id)),
          // Only the products this order sold out change on the storefront; a normal order flushes nothing.
          ...(soldOut.length ? [invalidateFrontendCache(soldOut.map((slug) => `product:${slug}`))] : []),
        ]),
      );
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "ORDER_FAILED" });
    }
  });
  app.post("/api/orders/track", async (req, res) => {
    if (!(await allowRequest(req, res, "order-track", 30, 15 * 60 * 1000))) return;
    const orderNumber = String(req.body.orderNumber || "").toUpperCase();
    const phone = String(req.body.phone || "").replace(/\D/g, "");
    if (!normalizePakistanPhone(phone)) return res.status(400).json({ error: "Enter a valid Pakistani phone number." });
    const order = await prisma.order.findFirst({
      where: {
        orderNumber,
        OR: [{ phone: { endsWith: phone.slice(-10) } }, { phone: { endsWith: phone.slice(-11) } }],
      },
      select: { orderNumber: true, status: true, postexTracking: true, createdAt: true, total: true, city: true },
    });
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    const city = await prisma.city.findUnique({ where: { name: order.city } });
    res.json({
      ...order,
      deliveryEstimate: `${city?.deliveryMinDays ?? 2}–${city?.deliveryMaxDays ?? 7} working days`,
      total: Number(order.total),
      trackingUrl: order.postexTracking ? postexTrackingUrl(order.postexTracking) : null,
    });
  });
  app.get("/api/orders/confirmation/:orderNumber", async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { orderNumber: routeParam(req, "orderNumber").toUpperCase() },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ error: "NOT_FOUND" });
    // The confirmation page contains private delivery details, so the public order number alone is not enough.
    // The opaque database ID is returned only to the browser that placed the order and is kept in the success URL.
    if (String(req.query.key || "") !== order.id) return res.status(404).json({ error: "NOT_FOUND" });
    const city = await prisma.city.findUnique({ where: { name: order.city } });
    res.json({
      ...order,
      subtotal: Number(order.subtotal),
      bundleSaving: Number(order.bundleSaving),
      deliveryFee: Number(order.deliveryFee),
      codFee: Number(order.codFee),
      total: Number(order.total),
      items: order.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
        bundleDiscount: Number(i.bundleDiscount),
      })),
      deliveryEstimate: `${city?.deliveryMinDays ?? 2}-${city?.deliveryMaxDays ?? 7} working days`,
    });
  });
  app.get("/api/settings/delivery", async (_req, res) => {
    setNoStore(res);
    res.json(await getSetting("store.delivery", {}));
  });
  app.post("/api/checkout/coupon", async (req, res) => {
    if (!(await allowRequest(req, res, "coupon", STORE_LIMITS.couponPerIp.limit, STORE_LIMITS.couponPerIp.windowMs)))
      return;
    try {
      const cart = Array.isArray(req.body.cart) ? req.body.cart : [];
      if (!cart.length || cart.length > 50) throw new Error("Your cart is empty.");
      const products = await prisma.product.findMany({
        where: { id: { in: cart.map((i: any) => String(i.productId)) }, status: "PUBLISHED" },
        include: { variants: true },
      });
      const discount = Number(await getSetting("store.bundleDefaultDiscountPercent", 5));
      let subtotal = 0;
      for (const item of cart) {
        const pieces = Number(item.quantity) * (item.bundleSize === 2 ? 2 : 1);
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || pieces > MAX_LINE_PIECES)
          throw new Error("Invalid quantity.");
        const p = products.find((p) => p.id === item.productId);
        if (!p) throw new Error("Product unavailable.");
        const v = item.variantId ? p.variants.find((v) => v.id === item.variantId && v.active) : undefined;
        if ((item.variantId && !v) || (!v && p.variants.some((v) => v.active)))
          throw new Error("Choose a valid variation.");
        const price = variantPriceSummary(priceSummary(p.price, p.salePrice), {
          priceOverride: v?.priceOverride,
        }).price;
        subtotal += bundleLineTotal(
          price,
          item.quantity,
          item.bundleSize === 2 && p.bundleEnabled ? 2 : 1,
          discount,
        ).total;
      }
      res.json(await validateCoupon(req.body.code, subtotal));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/reviews/upload-chunk", reviewChunkUpload, async (req, res) => {
    if (!(await allowRequest(req, res, "review-upload-part", 120, 24 * 60 * 60 * 1000))) return;
    try {
      res.json(await writeReviewChunk(req));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post("/api/reviews/upload-complete", async (req, res) => {
    if (!(await allowRequest(req, res, "review-upload-part", 120, 24 * 60 * 60 * 1000))) return;
    try {
      res.json(await completeReviewChunks(req));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post("/api/reviews/upload-url", async (req, res) => {
    if (!(await allowRequest(req, res, "review-upload", 60, 24 * 60 * 60 * 1000))) return;
    try {
      const productId = String(req.body.productId || ""),
        orderNumber = String(req.body.orderNumber || "")
          .trim()
          .toUpperCase(),
        phone = String(req.body.phone || "")
          .replace(/\D/g, "")
          .slice(-10);
      if (!productId || !orderNumber || phone.length !== 10)
        return res.status(400).json({ error: "Enter the delivered order number and checkout phone." });
      const order = await prisma.order.findFirst({
        where: { orderNumber, status: "DELIVERED", phone: { endsWith: phone }, items: { some: { productId } } },
        select: { id: true },
      });
      if (!order) return res.status(403).json({ error: "Use the delivered order number and phone used at checkout." });
      res.json(await stageReviewUpload(req));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post(
    "/api/reviews",
    async (req, res, next) => {
      try {
        if (await allowRequest(req, res, "review", 10, 24 * 60 * 60 * 1000)) next();
      } catch (error) {
        next(error);
      }
    },
    customerReviewUpload,
    hydrateReviewUploads,
    async (req, res) => {
      try {
        if (String(req.body.honeypot || "")) return res.status(201).json({ ok: true });
        const productId = String(req.body.productId || "");
        const name = String(req.body.name || "").trim();
        const body = String(req.body.body || "").trim();
        const rating = Number(req.body.rating || 0);
        const email = String(req.body.email || "").trim();
        if (
          !/^\S+@\S+\.\S+$/.test(email) ||
          email.length > 254 ||
          name.length > 200 ||
          body.length > 20000 ||
          !Number.isInteger(rating)
        )
          return res.status(400).json({ error: "Invalid name, private email, review text or rating." });
        const orderNumber = String(req.body.orderNumber || "")
          .trim()
          .toUpperCase();
        const phone = String(req.body.phone || "")
          .replace(/\D/g, "")
          .slice(-10);
        if (!productId || !name || !body || rating < 1 || rating > 5 || !orderNumber || phone.length !== 10)
          return res.status(400).json({ error: "DELIVERED_ORDER_REQUIRED" });
        const order = await prisma.order.findFirst({
          where: { orderNumber, status: "DELIVERED", phone: { endsWith: phone }, items: { some: { productId } } },
          select: { id: true, customerId: true },
        });
        if (!order)
          return res.status(403).json({
            error: "REVIEW_NOT_VERIFIED",
            message: "Use the delivered order number and phone used at checkout.",
          });
        const existing = await prisma.review.findFirst({ where: { productId, orderId: order.id } });
        if (existing) return res.status(409).json({ error: "REVIEW_ALREADY_SUBMITTED" });
        const { media } = await storeReviewFiles(req);
        const review = await prisma.$transaction(async (tx) => {
          // Lock the delivered order to serialize concurrent submissions for this purchase.
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
          if (await tx.review.findFirst({ where: { productId, orderId: order.id } }))
            throw new Error("REVIEW_ALREADY_SUBMITTED");
          return tx.review.create({
            data: {
              productId,
              orderId: order.id,
              customerId: order.customerId,
              name,
              email,
              body,
              rating,
              verified: true,
              status: "PENDING",
              reviewRef: `CUSTOMER-${crypto.randomUUID()}`,
              media: { create: media },
            },
          });
        });
        res.status(201).json({ ok: true, id: review.id, verified: true });
      } catch (e: any) {
        res
          .status(e.code === "P2002" || e.message === "REVIEW_ALREADY_SUBMITTED" ? 409 : 400)
          .json({ error: e.message || "Review submission failed." });
      }
    },
  );
}
