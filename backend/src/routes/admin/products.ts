import { saveCatalogImage, toSiteWebp } from "../../lib/catalog-images";
import { createHash } from "node:crypto";
import { Prisma, ProductStatus } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import {
  validAdminBody,
  productCreateSchema,
  productUpdateSchema,
  variantCreateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  salePriceProblem,
} from "../../lib/admin-validators";
import { getSetting, setSetting } from "../../lib/settings";
import { isCloudStorageConfigured, StorageError, uploadObject } from "../../lib/storage";
import { invalidateFrontendCache } from "../../lib/cache-invalidation";
import { sanitizeGlobalProductTabs } from "../../lib/catalog-meta";
import { cleanStockStatus } from "../../lib/stock";
import {
  buildProductWrite,
  demoteH1,
  MAX_PRODUCT_IMAGES,
  MAX_VARIATION_IMAGES,
  planImport,
  slugify as importSlugify,
  templateCsv,
  titleKey as importTitleKey,
  validateHeaders,
} from "../../lib/product-import";
import type { Express } from "express";
import {
  PRODUCT_TX_OPTIONS,
  audit,
  catalogCacheTags,
  customRedirect,
  jsonProduct,
  loadAdminProduct,
  normalizeRedirectDestination,
  previousCustomRedirect,
  readCatalogMeta,
  resolveProductVideo,
  routeParam,
  syncProductRedirect,
  upload,
  writeCatalogMeta,
  writeVariants,
} from "../../http/shared";

/** Removes the product row (variations and reviews cascade) and points its URL at the saved redirect. */
async function deleteProductRecord(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return null;
  const meta = readCatalogMeta(existing.sourceUrl) || {};
  await prisma.product.delete({ where: { id } });
  const destination =
    normalizeRedirectDestination(meta.redirectUrl) || (meta.redirectFallback !== false ? "/shop" : "");
  if (destination) {
    await prisma.redirect.upsert({
      where: { sourcePath: `/product/${existing.slug}/` },
      update: { destination, permanent: true },
      create: { sourcePath: `/product/${existing.slug}/`, destination, permanent: true },
    });
  }
  return existing;
}
// Images are converted to WebP in the browser first (frontend/lib/image-convert.ts), and again here for anything
// that arrives as JPG, PNG or AVIF (toSiteWebp: max 1600 px wide, quality 82, metadata removed). The feed copy
// below is a JPG made from the original upload, because the ad platforms' feeds need JPG/PNG.
// Each file is stored in R2 as products/<sha256>.<ext>: the same image uploaded again gets
// the same URL, so the admin can skip it as a duplicate. There is no local-disk fallback:
// on Vercel those files disappear after a restart.
const UPLOAD_EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};

export function registerAdminProductsRoutes(app: Express) {
  app.get("/api/admin/products/insights", requireAuth("products.write"), async (_req, res) => {
    const [sales, activity] = await Promise.all([
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { not: null }, order: { status: { notIn: ["CANCELLED", "RETURNED"] } } },
        _sum: { quantity: true },
      }),
      prisma.auditLog.findMany({
        where: { entity: { in: ["Product", "Variant"] } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);
    res.json({
      sales: Object.fromEntries(sales.filter((s) => s.productId).map((s) => [s.productId, s._sum.quantity || 0])),
      activity,
    });
  });
  app.get("/api/admin/products/export.csv", requireAuth("orders.export"), async (_req, res) => {
    const rows = await prisma.product.findMany({ include: { category: true }, orderBy: { updatedAt: "desc" } });
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      "title,slug,sku,category,price,salePrice,costPrice,stock,status,featured,shortDescription,descriptionHtml,imageUrls,videoUrl,seoTitle,seoDescription",
      ...rows.map((p) =>
        [
          p.title,
          p.slug,
          p.sku,
          p.category?.name || "",
          p.price,
          p.salePrice || "",
          p.costPrice || "",
          p.stock,
          p.status,
          p.featured,
          p.shortDescription || "",
          p.descriptionHtml || "",
          Array.isArray(p.images) ? p.images.join("|") : "",
          p.videoUrl || "",
          p.seoTitle || "",
          p.seoDescription || "",
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n");
    res.type("text/csv").send(csv);
  });
  app.get("/api/admin/products", requireAuth("products.write"), async (req, res) => {
    const q = String(req.query.q || "");
    const status = String(req.query.status || "");
    const categoryId = String(req.query.categoryId || "");
    const where: Prisma.ProductWhereInput = {
      ...(q
        ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }
        : {}),
      ...(status ? { status: status as ProductStatus } : {}),
      ...(categoryId ? { categoryId } : {}),
    };
    const rows = await prisma.product.findMany({
      where,
      include: { category: true, variants: true, reviews: true },
      orderBy: { updatedAt: "desc" },
    });
    const discount = Number(await getSetting("store.bundleDefaultDiscountPercent", 5));
    res.json(rows.map((row) => jsonProduct(row, discount)));
  });
  app.get("/api/admin/products/:id", requireAuth("products.write"), async (req, res) => {
    const row = await prisma.product.findUnique({
      where: { id: routeParam(req, "id") },
      include: { category: true, variants: true, reviews: true },
    });
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(jsonProduct(row, Number(await getSetting("store.bundleDefaultDiscountPercent", 5))));
  });
  app.post("/api/admin/products", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    if (!validAdminBody(productCreateSchema, req.body, res)) return;
    try {
      const b = req.body || {};
      const price = Number(b.price || 0);
      const salePrice = b.salePrice == null || b.salePrice === "" ? null : Number(b.salePrice);
      const bundleEnabled = b.bundleEnabled !== false;
      const bundleDiscountPercent =
        b.bundleDiscountPercent == null || b.bundleDiscountPercent === "" ? null : Number(b.bundleDiscountPercent);
      const nextStatus = (b.status || "DRAFT") as ProductStatus;
      const custom = customRedirect(b.catalogMeta, String(b.slug));
      if (b.catalogMeta) b.catalogMeta.redirectFrom = custom?.source || b.catalogMeta.redirectFrom || "";
      const video = await resolveProductVideo(b.videoUrl, null, null);
      b.videoUrl = video.videoUrl;
      b.catalogMeta = { ...(b.catalogMeta || {}), ...video.meta };
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            trackStock: Boolean(b.trackStock),
            stockStatus: cleanStockStatus(b.stockStatus),
            title: String(b.title),
            slug: String(b.slug),
            sku: String(b.sku),
            categoryId: b.categoryId || null,
            price: new Prisma.Decimal(price),
            salePrice: salePrice == null ? null : new Prisma.Decimal(salePrice),
            costPrice: b.costPrice ? new Prisma.Decimal(Number(b.costPrice)) : null,
            stock: Number(b.stock || 0),
            status: nextStatus,
            featured: Boolean(b.featured),
            bundleEnabled,
            bundleDiscountPercent: bundleDiscountPercent == null ? null : new Prisma.Decimal(bundleDiscountPercent),
            shortDescription: b.shortDescription || null,
            descriptionHtml: b.descriptionHtml ? demoteH1(String(b.descriptionHtml)) : null,
            images: Array.isArray(b.images) ? b.images : [],
            videoUrl: b.videoUrl || null,
            seoTitle: b.seoTitle || null,
            seoDescription: b.seoDescription || null,
            canonicalUrl: b.canonicalUrl || null,
            sourceUrl: b.catalogMeta ? writeCatalogMeta(b.catalogMeta) : null,
          },
        });
        if (Array.isArray(b.variants)) await writeVariants(tx, created.id, b.variants);
        return created;
      }, PRODUCT_TX_OPTIONS);
      await audit(req, "create", "Product", row.id);
      await syncProductRedirect({
        slug: row.slug,
        status: row.status,
        redirectFallback: b.catalogMeta?.redirectFallback !== false && b.redirectFallback !== false,
        custom,
      });
      await invalidateFrontendCache(await catalogCacheTags(row.slug, row.categoryId));
      res.status(201).json(await loadAdminProduct(row.id));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "PRODUCT_CREATE_FAILED" });
    }
  });
  app.patch("/api/admin/products/:id", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    try {
      const id = routeParam(req, "id");
      const current = await prisma.product.findUnique({ where: { id } });
      if (!current) return res.status(404).json({ error: "NOT_FOUND" });
      const b = req.body || {};
      if (!validAdminBody(productUpdateSchema, b, res)) return;
      const salePriceIssue = salePriceProblem(
        "price" in b ? b.price : current.price,
        "salePrice" in b ? b.salePrice : current.salePrice,
      );
      if (salePriceIssue)
        return res
          .status(400)
          .json({ error: salePriceIssue, issues: [{ field: "salePrice", message: salePriceIssue }] });
      const nextStatus = (("status" in b ? b.status : current.status) || "DRAFT") as ProductStatus;
      const data: any = {};
      const previousMeta = readCatalogMeta(current.sourceUrl) || {};
      const nextSlug = String(b.slug || current.slug);
      const custom = b.catalogMeta
        ? customRedirect({ ...previousMeta, ...b.catalogMeta }, nextSlug)
        : previousCustomRedirect(previousMeta, current.slug);
      if (b.catalogMeta) b.catalogMeta.redirectFrom = custom?.source || b.catalogMeta.redirectFrom || "";
      if ("videoUrl" in b) {
        const video = await resolveProductVideo(b.videoUrl, previousMeta, current.videoUrl);
        b.videoUrl = video.videoUrl;
        b.catalogMeta = { ...(b.catalogMeta || {}), ...video.meta };
      }
      // `stock` is only sent when the admin changed the quantity, so a save never overwrites live stock.
      if ("trackStock" in b) data.trackStock = Boolean(b.trackStock);
      if ("stockStatus" in b) data.stockStatus = cleanStockStatus(b.stockStatus);
      for (const k of [
        "title",
        "slug",
        "sku",
        "categoryId",
        "stock",
        "status",
        "featured",
        "bundleEnabled",
        "shortDescription",
        "descriptionHtml",
        "images",
        "videoUrl",
        "seoTitle",
        "seoDescription",
        "canonicalUrl",
      ])
        if (k in b) data[k] = b[k] === "" ? null : b[k];
      if (typeof data.descriptionHtml === "string") data.descriptionHtml = demoteH1(data.descriptionHtml);
      if (b.catalogMeta)
        data.sourceUrl = writeCatalogMeta({ ...(readCatalogMeta(current.sourceUrl) || {}), ...b.catalogMeta });
      for (const k of ["price", "salePrice", "costPrice", "bundleDiscountPercent"])
        if (k in b) data[k] = b[k] === "" || b[k] == null ? null : new Prisma.Decimal(Number(b[k]));
      if ("stock" in data) data.stock = Math.max(0, Math.floor(Number(data.stock) || 0));
      if ("status" in b) data.status = nextStatus;
      const row = await prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({ where: { id }, data });
        if (Array.isArray(b.variants)) await writeVariants(tx, id, b.variants);
        return updated;
      }, PRODUCT_TX_OPTIONS);
      await audit(req, "update", "Product", row.id);
      const meta = b.catalogMeta || readCatalogMeta(row.sourceUrl) || {};
      await syncProductRedirect({
        slug: row.slug,
        previousSlug: String(b.previousSlug || current.slug || ""),
        status: row.status,
        redirectFallback: meta.redirectFallback !== false,
        custom,
        previousCustom: previousCustomRedirect(previousMeta, current.slug),
      });
      const tags = await catalogCacheTags(row.slug, row.categoryId);
      if (current.slug && current.slug !== row.slug) tags.push(`product:${current.slug}`);
      await invalidateFrontendCache(tags);
      res.json(await loadAdminProduct(row.id));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "PRODUCT_UPDATE_FAILED" });
    }
  });

  app.delete("/api/admin/products/:id", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const id = routeParam(req, "id");
    const existing = await deleteProductRecord(id);
    if (!existing) return res.status(404).json({ error: "NOT_FOUND" });
    await audit(req, "delete", "Product", id);
    await invalidateFrontendCache([
      "products",
      "featured-products",
      "categories",
      "store",
      "redirects",
      `product:${existing.slug}`,
    ]);
    res.json({ ok: true });
  });
  app.post("/api/admin/products/:id/variants", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    try {
      const b = req.body || {};
      if (!validAdminBody(variantCreateSchema, b, res)) return;
      const product = await prisma.product.findUnique({ where: { id: routeParam(req, "id") } });
      if (!product) return res.status(404).json({ error: "NOT_FOUND" });

      const row = await prisma.variant.create({
        data: {
          productId: product.id,
          sku: String(b.sku),
          name: String(b.name),
          attributes: b.attributes || {},
          priceOverride: b.priceOverride ? new Prisma.Decimal(Number(b.priceOverride)) : null,
          stock: Number(b.stock || 0),
          trackStock: Boolean(b.trackStock),
          stockStatus: cleanStockStatus(b.stockStatus),
          imageUrl: b.imageUrl || null,
          active: b.active !== false,
        },
      });
      await audit(req, "create", "Variant", row.id);
      await invalidateFrontendCache(["products"]);
      res.status(201).json(row);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "VARIANT_CREATE_FAILED" });
    }
  });
  app.delete("/api/admin/variants/:id", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    await prisma.variant.delete({ where: { id: routeParam(req, "id") } });
    await audit(req, "delete", "Variant", routeParam(req, "id"));
    await invalidateFrontendCache(["products"]);
    res.json({ ok: true });
  });

  app.get("/api/admin/categories", requireAuth("products.write"), async (_req, res) => {
    const rows = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });
    res.json(rows.map((r) => ({ ...r, count: r._count.products })));
  });
  app.post("/api/admin/categories", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const b = req.body;
    if (!validAdminBody(categoryCreateSchema, b, res)) return;
    const row = await prisma.category.create({
      data: {
        name: String(b.name),
        slug: String(b.slug),
        sortOrder: Number(b.sortOrder || 0),
        imageUrl: b.imageUrl || null,
        description: b.description || null,
        seoTitle: b.seoTitle || null,
        seoDescription: b.seoDescription || null,
      },
    });
    await audit(req, "create", "Category", row.id);
    await invalidateFrontendCache(["categories", "products", "store"]);
    res.status(201).json(row);
  });
  app.patch("/api/admin/categories/:id", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const b = req.body;
    if (!validAdminBody(categoryUpdateSchema, b, res)) return;
    const row = await prisma.category.update({
      where: { id: routeParam(req, "id") },
      data: {
        name: b.name,
        slug: b.slug,
        sortOrder: b.sortOrder == null ? undefined : Number(b.sortOrder),
        imageUrl: b.imageUrl === undefined ? undefined : b.imageUrl || null,
        description: b.description === undefined ? undefined : b.description || null,
        seoTitle: b.seoTitle === undefined ? undefined : b.seoTitle || null,
        seoDescription: b.seoDescription === undefined ? undefined : b.seoDescription || null,
      },
    });
    await audit(req, "update", "Category", row.id);
    await invalidateFrontendCache(["categories", "products", "store"]);
    res.json(row);
  });
  app.delete("/api/admin/categories/:id", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    await prisma.category.delete({ where: { id: routeParam(req, "id") } });
    await audit(req, "delete", "Category", routeParam(req, "id"));
    await invalidateFrontendCache(["categories", "products", "store"]);
    res.json({ ok: true });
  });

  app.get("/api/admin/product-tabs", requireAuth("products.write"), async (_req, res) => {
    const tabs = await getSetting<Record<string, { title: string; content: string }> | null>("store.productTabs", null);
    res.json({ tabs });
  });
  app.put("/api/admin/product-tabs", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const tabs = sanitizeGlobalProductTabs(req.body?.tabs ?? req.body);
    await setSetting("store.productTabs", tabs);
    await audit(req, "update", "ProductTabs", undefined, { keys: Object.keys(tabs) });
    await invalidateFrontendCache(["settings", "store", "products", "setting:store.productTabs"]);
    res.json({ ok: true, tabs });
  });

  // CSV import. Create-only: a row whose SKU, slug or title (or a variation SKU) matches an
  // existing product, drafts included, is rejected as "Already exists". New products are DRAFTS.
  // Categories are never created: each row needs one of the store's categories, matched from
  // the CSV cell or chosen in the preview (`categoryByRow`: { [row]: categoryId }).
  // `dryRun: true` validates and reports what would happen without writing anything.
  app.post("/api/admin/products/import", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const dryRun = Boolean(req.body?.dryRun);
    const categoryByRow: Record<string, string> =
      req.body?.categoryByRow && typeof req.body.categoryByRow === "object" ? req.body.categoryByRow : {};
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    });
    // Removed or unknown columns are ignored with a warning; only a missing required column rejects the file.
    const headers: string[] = Array.isArray(req.body?.headers)
      ? req.body.headers.map(String)
      : [...new Set<string>(rows.flatMap((r: any) => Object.keys(r || {})))].filter((k) => k !== "__row");
    const { errors: fileErrors, warnings: fileWarnings } = validateHeaders(headers);
    if (!rows.length) fileErrors.push("The file has no product rows.");
    if (rows.length > 5000) fileErrors.push("The file has more than 5,000 rows. Split it into smaller files.");
    if (fileErrors.length)
      return res.status(dryRun ? 200 : 400).json({
        error: "INVALID_TEMPLATE",
        message: fileErrors.join(" "),
        fileErrors,
        fileWarnings,
        categories,
        created: 0,
        exists: 0,
        skipped: 0,
        errors: fileErrors,
        dryRun,
        results: [],
      });
    const planned = planImport(rows, Number(req.body?.firstRow) || 2);
    const categoryByKey = new Map<string, { id: string; name: string; slug: string }>();
    for (const c of categories) {
      categoryByKey.set(c.slug.toLowerCase(), c);
      categoryByKey.set(c.name.trim().toLowerCase(), c);
      categoryByKey.set(importSlugify(c.name), c);
    }
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    // Everything already in the shop (drafts included), for the "Already exists" check.
    const [existingProducts, existingVariants] = await Promise.all([
      prisma.product.findMany({ select: { id: true, sku: true, slug: true, title: true } }),
      prisma.variant.findMany({ select: { sku: true, product: { select: { title: true } } } }),
    ]);
    const productBySku = new Map(existingProducts.map((p) => [p.sku.toLowerCase(), p]));
    const productBySlug = new Map(existingProducts.map((p) => [p.slug.toLowerCase(), p]));
    const productByTitle = new Map(existingProducts.map((p) => [importTitleKey(p.title), p]));
    const variantBySku = new Map(existingVariants.map((v) => [v.sku.toLowerCase(), v.product.title]));
    const results: any[] = [];
    const tags = new Set(["products", "featured-products", "categories", "store"]);
    for (const product of planned) {
      const cellCategory = product.cells.category || "";
      const matched = cellCategory
        ? categoryByKey.get(cellCategory.trim().toLowerCase()) || categoryByKey.get(importSlugify(cellCategory))
        : undefined;
      const chosenId = categoryByRow[String(product.row)];
      const category = (chosenId ? categoryById.get(String(chosenId)) : undefined) || matched || null;
      const warnings = [...product.warnings];
      // Shown in red under the Category dropdown until one of the store's categories is picked.
      const categoryError =
        cellCategory && !matched
          ? `Category "${cellCategory}" is not one of the store's categories. Choose one from the list.`
          : "";
      const result: any = {
        row: product.row,
        sku: product.sku,
        title: product.title,
        productType: product.productType,
        variations: product.variations.length,
        warnings,
        errors: [...product.errors],
        action: "error",
        id: null,
        status: null,
        slug: product.slug || null,
        category: cellCategory,
        categoryId: category?.id || null,
        categoryError,
      };
      results.push(result);
      if (result.errors.length) {
        result.errors.push(...product.duplicates);
        continue;
      }
      const exists: string[] = [...product.duplicates];
      const sku = product.sku.toLowerCase();
      if (productBySku.has(sku)) exists.push(`SKU "${product.sku}" is used by "${productBySku.get(sku)!.title}".`);
      else if (variantBySku.has(sku))
        exists.push(`SKU "${product.sku}" is used by a variation of "${variantBySku.get(sku)}".`);
      const bySlug = product.slug ? productBySlug.get(product.slug) : undefined;
      if (bySlug) exists.push(`Slug "${product.slug}" is used by "${bySlug.title}".`);
      const byTitle = productByTitle.get(importTitleKey(product.title));
      if (byTitle) exists.push(`Title matches "${byTitle.title}" (SKU ${byTitle.sku}).`);
      for (const variation of product.variations) {
        const key = variation.sku.toLowerCase();
        const owner = variantBySku.get(key) || productBySku.get(key)?.title;
        if (owner) exists.push(`Variation SKU "${variation.sku}" is used by "${owner}".`);
      }
      if (exists.length) {
        result.action = "exists";
        result.errors = [`Already exists. ${exists.join(" ")}`];
        continue;
      }
      result.status = "DRAFT";
      if (dryRun) {
        result.action = "create";
        continue;
      }
      if (!category) {
        result.errors.push("Choose a category for this row.");
        continue;
      }
      try {
        const write = buildProductWrite(product);
        const data: any = {
          ...write.columns,
          slug: write.slug,
          sku: product.sku,
          status: "DRAFT",
          categoryId: category.id,
          sourceUrl: writeCatalogMeta(write.meta),
        };
        for (const k of ["price", "salePrice", "bundleDiscountPercent"])
          if (k in data) data[k] = data[k] == null ? null : new Prisma.Decimal(Number(data[k]));
        const row = await prisma.$transaction(async (tx) => {
          const saved = await tx.product.create({ data });
          if (write.variants.length) await writeVariants(tx, saved.id, write.variants);
          return saved;
        }, PRODUCT_TX_OPTIONS);
        await syncProductRedirect({
          slug: row.slug,
          status: row.status,
          redirectFallback: true,
          custom: previousCustomRedirect(write.meta, row.slug),
          previousCustom: null,
        });
        tags.add(`product:${row.slug}`);
        tags.add(`category:${category.slug}`);
        productBySku.set(sku, row);
        productBySlug.set(row.slug, row);
        productByTitle.set(importTitleKey(row.title), row);
        result.action = "created";
        result.id = row.id;
        result.status = row.status;
        result.slug = row.slug;
      } catch (e: any) {
        result.action = "error";
        result.errors.push(
          e?.code === "P2002"
            ? `Already exists: a product or variation with the same ${(e?.meta?.target || ["sku"]).join(", ")} is in the shop.`
            : e?.message || "Import failed",
        );
      }
    }
    const count = (action: string) => results.filter((r) => r.action === action).length;
    const summary = {
      created: count(dryRun ? "create" : "created"),
      exists: count("exists"),
      skipped: count("error") + count("exists"),
      errors: results
        .filter((r) => r.action === "error" || r.action === "exists")
        .map((r) => `Row ${r.row}: ${r.errors.join(" ")}`),
    };
    if (!dryRun) {
      await audit(req, "csv_import", "Product", undefined, { ...summary, errors: summary.errors.slice(0, 25) });
      await invalidateFrontendCache([...tags]);
    }
    res.json({ ...summary, dryRun, fileWarnings, categories, results });
  });
  app.get("/api/admin/product-import/template/:kind", requireAuth("products.write"), (req, res) => {
    const kind = routeParam(req, "kind").replace(/\.csv$/i, "") === "variable" ? "variable" : "simple";
    res
      .type("text/csv")
      .setHeader("Content-Disposition", `attachment; filename="zelvomart-${kind}-products-template.csv"`);
    res.send(templateCsv(kind));
  });
  // Post or un-post many products in one click (used after a CSV import and on the drafts list).
  app.post("/api/admin/products/bulk-status", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).slice(0, 1000);
    const status = String(req.body?.status || "").toUpperCase();
    if (!ids.length || !["DRAFT", "PUBLISHED"].includes(status))
      return res.status(400).json({ error: "INVALID_REQUEST" });
    const rows = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: { category: { select: { slug: true } } },
    });
    const updated: string[] = [];
    const failed: { id: string; title: string; error: string }[] = [];
    const tags = new Set(["products", "featured-products", "categories", "store", "redirects"]);
    for (const row of rows) {
      if (status === "PUBLISHED" && Number(row.price) <= 0) {
        failed.push({ id: row.id, title: row.title, error: "Add a regular price before posting." });
        continue;
      }
      try {
        if (row.status !== status)
          await prisma.product.update({ where: { id: row.id }, data: { status: status as ProductStatus } });
        const meta = readCatalogMeta(row.sourceUrl) || {};
        await syncProductRedirect({
          slug: row.slug,
          status,
          redirectFallback: meta.redirectFallback !== false,
          custom: previousCustomRedirect(meta, row.slug),
          previousCustom: previousCustomRedirect(meta, row.slug),
        });
        updated.push(row.id);
        tags.add(`product:${row.slug}`);
        if (row.category?.slug) tags.add(`category:${row.category.slug}`);
      } catch (e: any) {
        failed.push({ id: row.id, title: row.title, error: e?.message || "Update failed" });
      }
    }
    await audit(req, "bulk_status", "Product", undefined, { status, updated: updated.length, failed: failed.length });
    await invalidateFrontendCache([...tags]);
    res.json({ status, updated, failed });
  });
  app.post("/api/admin/products/bulk-delete", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).filter(Boolean).slice(0, 200);
    if (!ids.length) return res.status(400).json({ error: "INVALID_REQUEST" });
    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];
    const tags = new Set(["products", "featured-products", "categories", "store", "redirects"]);
    for (const id of ids) {
      try {
        const row = await deleteProductRecord(id);
        if (!row) {
          failed.push({ id, error: "NOT_FOUND" });
          continue;
        }
        deleted.push(id);
        tags.add(`product:${row.slug}`);
      } catch (e: any) {
        failed.push({ id, error: e?.message || "Delete failed" });
      }
    }
    await audit(req, "bulk_delete", "Product", undefined, { deleted: deleted.length, failed: failed.length });
    await invalidateFrontendCache([...tags]);
    res.json({ deleted, failed });
  });
  // Attach already-uploaded image URLs to a product and its variations (bulk image ZIP upload).
  app.post("/api/admin/products/:id/images", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    try {
      const id = routeParam(req, "id");
      const product = await prisma.product.findUnique({ where: { id }, include: { variants: true } });
      if (!product) return res.status(404).json({ error: "NOT_FOUND" });
      const b = req.body || {};
      const replace = b.mode === "replace";
      const urls = (value: unknown) =>
        (Array.isArray(value) ? value : []).filter(
          (x: unknown): x is string => typeof x === "string" && /^(https?:\/\/|\/)/.test(x),
        );
      const merge = (current: string[], next: string[], max: number) =>
        [...new Set(replace && next.length ? next : [...current, ...next])].slice(0, max);
      const current = Array.isArray(product.images)
        ? (product.images as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      // featuredFirst: the upload's first image (the one named "1") becomes the main image, ahead of the existing ones.
      const incoming = urls(b.images);
      const images =
        b.featuredFirst && !replace && incoming.length
          ? [...new Set([incoming[0], ...current, ...incoming.slice(1)])].slice(0, MAX_PRODUCT_IMAGES)
          : merge(current, incoming, MAX_PRODUCT_IMAGES);
      const meta: any = readCatalogMeta(product.sourceUrl);
      const variantImages =
        b.variantImages && typeof b.variantImages === "object" ? (b.variantImages as Record<string, unknown>) : {};
      const variantUpdates: { id: string; imageUrl: string }[] = [];
      for (const variant of product.variants) {
        const next = urls(variantImages[variant.id]);
        if (!next.length) continue;
        const extras = Array.isArray(meta?.variations)
          ? meta.variations.find(
              (item: any) => (item.sku && item.sku === variant.sku) || (item.name && item.name === variant.name),
            )
          : null;
        const before =
          extras && Array.isArray(extras.images)
            ? extras.images.filter((x: unknown) => typeof x === "string" && x)
            : variant.imageUrl
              ? [variant.imageUrl]
              : [];
        const merged = merge(before, next, MAX_VARIATION_IMAGES);
        if (extras) extras.images = merged;
        variantUpdates.push({ id: variant.id, imageUrl: merged[0] });
      }
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: { images, ...(meta && variantUpdates.length ? { sourceUrl: writeCatalogMeta(meta) } : {}) },
        });
        for (const update of variantUpdates)
          await tx.variant.update({ where: { id: update.id }, data: { imageUrl: update.imageUrl } });
      }, PRODUCT_TX_OPTIONS);
      await audit(req, "bulk_images", "Product", id, {
        images: images.length,
        variants: variantUpdates.length,
        mode: replace ? "replace" : "append",
      });
      await invalidateFrontendCache(await catalogCacheTags(product.slug, product.categoryId));
      res.json(await loadAdminProduct(id));
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "PRODUCT_IMAGES_FAILED" });
    }
  });
  app.post(
    "/api/admin/upload",
    requireAuth("products.write"),
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (!err) return next();
        const tooLarge = err?.code === "LIMIT_FILE_SIZE";
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_FAILED",
          message: tooLarge
            ? "Unable to upload: the image is larger than 4 MB after conversion."
            : `Unable to upload: ${err?.message || "the file could not be read"}.`,
        });
      });
    },
    async (req, res) => {
      if (!req.file)
        return res.status(400).json({ error: "FILE_REQUIRED", message: "Unable to upload: no file was received." });
      const ext = UPLOAD_EXTENSIONS[req.file.mimetype];
      if (!ext)
        return res.status(400).json({
          error: "IMAGE_REQUIRED",
          message: "Unable to upload: only JPG, PNG, WEBP, AVIF or GIF images are allowed.",
        });
      if (!isCloudStorageConfigured())
        return res.status(503).json({
          error: "STORAGE_NOT_CONFIGURED",
          message:
            "Unable to upload: image storage (Cloudflare R2) is not configured on the backend. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_BASE_URL.",
        });
      let site: Awaited<ReturnType<typeof toSiteWebp>>;
      try {
        site = await toSiteWebp(req.file.buffer, req.file.mimetype);
      } catch {
        return res
          .status(400)
          .json({ error: "IMAGE_UNREADABLE", message: "Unable to upload: the image could not be read." });
      }
      try {
        // The hash is of the original file, so the same upload twice still gets the same URL (duplicate check).
        const hash = createHash("sha256").update(req.file.buffer).digest("hex");
        const url = await uploadObject(`products/${hash}.${site.ext}`, site.bytes, site.contentType);
        let feedImageUrl: string | undefined;
        try {
          feedImageUrl = await saveCatalogImage(url, req.file.buffer);
        } catch (error) {
          console.error("Catalog JPG copy failed; backfill can retry", error instanceof Error ? error.message : error);
        }
        res.json({ url, hash, feedImageUrl });
      } catch (error: any) {
        const status = error instanceof StorageError && error.code === "STORAGE_NOT_CONFIGURED" ? 503 : 502;
        res.status(status).json({
          error: error?.code || "UPLOAD_FAILED",
          message: error?.message || "Unable to upload: Cloudflare R2 did not accept the image.",
        });
      }
    },
  );
}
