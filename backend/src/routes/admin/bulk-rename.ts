/**
 * Admin → Products → Bulk rename: download, preview, apply (in chunks) and undo the last batch.
 * The plan comes from lib/bulk-rename.ts; writes follow the single-product edit (PATCH /api/admin/products/:id):
 * one transaction per product, then syncProductRedirect, one audit row per product, one cache refresh per call.
 */
import type { Express } from "express";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { requireAuth, type AuthedRequest } from "../../lib/auth";
import { invalidateFrontendCache } from "../../lib/cache-invalidation";
import {
  BULK_RENAME_CHUNK,
  parseRenameInput,
  planBulkRename,
  redirectFromSlug,
  repointRedirects,
  type CatalogRow,
  type PlanRow,
  type ProductFields,
} from "../../lib/bulk-rename";
import {
  PRODUCT_TX_OPTIONS,
  audit,
  previousCustomRedirect,
  readCatalogMeta,
  syncProductRedirect,
} from "../../http/shared";

const ACTION = "bulk_rename";
const UNDO_ACTION = "bulk_rename_undo";
const BASE_TAGS = ["products", "seo", "featured-products", "categories", "store", "redirects", "feed"];

type Repointed = { sourcePath: string; destination: string };
type AuditDetails = {
  batchId: string;
  before: ProductFields;
  after: ProductFields;
  redirect: "301" | "none" | null;
  repointed: Repointed[];
};

async function loadCatalog(): Promise<CatalogRow[]> {
  const rows = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      price: true,
      salePrice: true,
      seoTitle: true,
      seoDescription: true,
      categoryId: true,
      images: true,
      category: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    price: Number(r.price),
    salePrice: r.salePrice == null ? null : Number(r.salePrice),
    seoTitle: r.seoTitle,
    seoDescription: r.seoDescription,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    categorySlug: r.category?.slug ?? null,
    image: Array.isArray(r.images) && typeof r.images[0] === "string" ? (r.images[0] as string) : null,
  }));
}

const fieldsOf = (p: {
  title: string;
  slug: string;
  price: unknown;
  salePrice: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
}): ProductFields => ({
  title: p.title,
  slug: p.slug,
  price: Number(p.price),
  salePrice: p.salePrice == null ? null : Number(p.salePrice),
  seoTitle: p.seoTitle,
  seoDescription: p.seoDescription,
});
// Key by key: the audit log stores JSON (jsonb), which does not keep key order.
const FIELD_KEYS: (keyof ProductFields)[] = ["title", "slug", "price", "salePrice", "seoTitle", "seoDescription"];
const sameFields = (a: ProductFields, b: ProductFields) =>
  FIELD_KEYS.every(
    (k) =>
      (a[k] == null && b[k] == null) ||
      (k === "price" || k === "salePrice" ? Number(a[k]) === Number(b[k]) : a[k] === b[k]),
  );
const productPath = (slug: string) => `/product/${slug}/`;

async function plan(body: any) {
  const parsed = parseRenameInput(String(body?.text || ""));
  if (parsed.error) return { error: parsed.error } as const;
  if (!parsed.lines.length) return { error: "Paste at least one line: old title, new title." } as const;
  const categoryId = body?.categoryId ? String(body.categoryId) : null;
  const rows = planBulkRename(parsed.lines, await loadCatalog(), { categoryId, redirect: Boolean(body?.redirect) });
  return { rows } as const;
}

/** One product: write the fields, point existing redirects at the new URL, then the product's own redirect. */
async function applyRow(req: AuthedRequest, row: PlanRow, batchId: string, redirect: boolean, tags: Set<string>) {
  const id = row.product!.id;
  const before = row.before!;
  const after = row.after!;
  const done = await prisma.auditLog.findFirst({
    where: { action: ACTION, entityId: id, details: { path: ["batchId"], equals: batchId } },
    select: { id: true },
  });
  if (done) return { ...row, status: "unchanged" as const, reason: "Already applied in this batch." };
  const current = await prisma.product.findUnique({ where: { id }, include: { category: { select: { slug: true } } } });
  if (!current) return { ...row, status: "error" as const, reason: "Not applied: the product was deleted." };
  if (!sameFields(fieldsOf(current), before))
    return {
      ...row,
      status: "error" as const,
      reason: "Not applied: the product changed after the preview. Preview again.",
    };

  const slugChanged = after.slug !== before.slug;
  const repointed: Repointed[] = [];
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        title: after.title,
        slug: after.slug,
        price: new Prisma.Decimal(after.price),
        salePrice: after.salePrice == null ? null : new Prisma.Decimal(after.salePrice),
        seoTitle: after.seoTitle,
        seoDescription: after.seoDescription,
      },
    });
    if (slugChanged) {
      // Redirects that pointed at the old URL now point at the new one: no chains. One that would
      // point at itself is removed: no loops.
      const pointing = await tx.redirect.findMany({ where: { destination: productPath(before.slug) } });
      const fix = repointRedirects(pointing, productPath(before.slug), productPath(after.slug));
      repointed.push(...fix.previous);
      if (fix.remove.length) await tx.redirect.deleteMany({ where: { id: { in: fix.remove } } });
      if (fix.update.length)
        await tx.redirect.updateMany({
          where: { id: { in: fix.update } },
          data: { destination: productPath(after.slug) },
        });
    }
  }, PRODUCT_TX_OPTIONS);

  const meta = readCatalogMeta(current.sourceUrl) || {};
  await syncProductRedirect({
    slug: after.slug,
    // Unticked: no redirect from the old URL (it simply stops existing).
    previousSlug: redirectFromSlug(before.slug, after.slug, redirect),
    status: current.status,
    redirectFallback: meta.redirectFallback !== false,
    custom: previousCustomRedirect(meta, after.slug),
    previousCustom: previousCustomRedirect(meta, before.slug),
  });
  const details: AuditDetails = {
    batchId,
    before,
    after,
    redirect: slugChanged ? (redirect ? "301" : "none") : null,
    repointed,
  };
  await audit(req, ACTION, "Product", id, details);
  tags.add(`product:${before.slug}`);
  tags.add(`product:${after.slug}`);
  if (current.category?.slug) tags.add(`category:${current.category.slug}`);
  return { ...row, status: "ok" as const, applied: true, redirectCreated: slugChanged && redirect };
}

async function lastBatch() {
  const latest = await prisma.auditLog.findFirst({ where: { action: ACTION }, orderBy: { createdAt: "desc" } });
  const batchId = (latest?.details as AuditDetails | null)?.batchId;
  if (!latest || !batchId) return null;
  const [items, undone] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: ACTION, details: { path: ["batchId"], equals: batchId } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findFirst({
      where: { action: UNDO_ACTION, details: { path: ["batchId"], equals: batchId } },
      select: { id: true },
    }),
  ]);
  return { batchId, at: latest.createdAt, items, undone: Boolean(undone) };
}

export function registerBulkRenameRoutes(app: Express) {
  // Current values for the sheet (title, category, price, sale price, SEO title, SEO description).
  app.get("/api/admin/products/bulk-rename/export", requireAuth("products.write"), async (req, res) => {
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : null;
    const rows = (await loadCatalog()).filter((p) => !categoryId || p.categoryId === categoryId);
    res.json({
      rows: rows.map((p) => ({
        title: p.title,
        category: p.categoryName || "",
        price: p.price,
        salePrice: p.salePrice,
        seoTitle: p.seoTitle || "",
        seoDescription: p.seoDescription || "",
      })),
    });
  });

  app.post("/api/admin/products/bulk-rename/preview", requireAuth("products.write"), async (req, res) => {
    const result = await plan(req.body);
    if ("error" in result) return res.status(400).json({ error: result.error });
    res.json({ rows: result.rows, chunkSize: BULK_RENAME_CHUNK });
  });

  // Re-plans from the same input (the client's preview is never trusted) and applies one chunk of lines.
  app.post("/api/admin/products/bulk-rename/apply", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const batchId = String(req.body?.batchId || "");
    if (!/^[A-Za-z0-9-]{8,64}$/.test(batchId)) return res.status(400).json({ error: "INVALID_BATCH" });
    const result = await plan(req.body);
    if ("error" in result) return res.status(400).json({ error: result.error });
    const chunks = Math.max(1, Math.ceil(result.rows.length / BULK_RENAME_CHUNK));
    const chunk = Math.min(Math.max(0, Math.floor(Number(req.body?.chunk) || 0)), chunks - 1);
    const redirect = Boolean(req.body?.redirect);
    const tags = new Set(BASE_TAGS);
    const out = [];
    for (const row of result.rows.slice(chunk * BULK_RENAME_CHUNK, (chunk + 1) * BULK_RENAME_CHUNK)) {
      if (row.status !== "ok") {
        out.push(row);
        continue;
      }
      try {
        out.push(await applyRow(req, row, batchId, redirect, tags));
      } catch (error: any) {
        out.push({ ...row, status: "error", reason: `Not applied: ${error?.message || "save failed"}` });
      }
    }
    if (out.some((r: any) => r.applied)) await invalidateFrontendCache([...tags]);
    res.json({ batchId, chunk, chunks, rows: out });
  });

  app.get("/api/admin/products/bulk-rename/last", requireAuth("products.write"), async (_req, res) => {
    const batch = await lastBatch();
    if (!batch) return res.json({ batch: null });
    res.json({ batch: { batchId: batch.batchId, at: batch.at, count: batch.items.length, undone: batch.undone } });
  });

  // Undo the last batch: old title, slug, prices and SEO back; the redirect it created removed (old URL live
  // again). Products edited since are skipped.
  app.post("/api/admin/products/bulk-rename/undo", requireAuth("products.write"), async (req: AuthedRequest, res) => {
    const batch = await lastBatch();
    if (!batch || batch.batchId !== String(req.body?.batchId || ""))
      return res.status(409).json({ error: "Only the last bulk rename can be undone." });
    if (batch.undone) return res.status(409).json({ error: "This bulk rename was already undone." });
    const tags = new Set(BASE_TAGS);
    const results: { title: string; status: "restored" | "skipped"; reason?: string }[] = [];
    for (const item of batch.items) {
      const d = item.details as unknown as AuditDetails;
      const id = item.entityId!;
      try {
        const current = await prisma.product.findUnique({
          where: { id },
          include: { category: { select: { slug: true } } },
        });
        if (!current) {
          results.push({ title: d.after.title, status: "skipped", reason: "The product was deleted." });
          continue;
        }
        if (!sameFields(fieldsOf(current), d.after)) {
          results.push({
            title: current.title,
            status: "skipped",
            reason: "Edited after the bulk rename; change it by hand.",
          });
          continue;
        }
        const slugChanged = d.before.slug !== d.after.slug;
        if (
          slugChanged &&
          (await prisma.product.findFirst({ where: { slug: d.before.slug, NOT: { id } }, select: { id: true } }))
        ) {
          results.push({
            title: current.title,
            status: "skipped",
            reason: "The old URL is now used by another product.",
          });
          continue;
        }
        await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id },
            data: {
              title: d.before.title,
              slug: d.before.slug,
              price: new Prisma.Decimal(d.before.price),
              salePrice: d.before.salePrice == null ? null : new Prisma.Decimal(d.before.salePrice),
              seoTitle: d.before.seoTitle,
              seoDescription: d.before.seoDescription,
            },
          });
          if (slugChanged) {
            if (d.redirect === "301")
              await tx.redirect.deleteMany({
                where: { sourcePath: productPath(d.before.slug), destination: productPath(d.after.slug) },
              });
            for (const r of d.repointed || [])
              await tx.redirect.upsert({
                where: { sourcePath: r.sourcePath },
                update: { destination: r.destination },
                create: { sourcePath: r.sourcePath, destination: r.destination, permanent: true },
              });
          }
        }, PRODUCT_TX_OPTIONS);
        const meta = readCatalogMeta(current.sourceUrl) || {};
        await syncProductRedirect({
          slug: d.before.slug,
          status: current.status,
          redirectFallback: meta.redirectFallback !== false,
          custom: previousCustomRedirect(meta, d.before.slug),
          previousCustom: previousCustomRedirect(meta, d.after.slug),
        });
        tags.add(`product:${d.before.slug}`);
        tags.add(`product:${d.after.slug}`);
        if (current.category?.slug) tags.add(`category:${current.category.slug}`);
        results.push({ title: d.before.title, status: "restored" });
      } catch (error: any) {
        results.push({ title: d.after.title, status: "skipped", reason: error?.message || "Undo failed" });
      }
    }
    const restored = results.filter((r) => r.status === "restored").length;
    // Nothing restored (every product was edited since): the batch stays "not undone".
    if (restored) {
      await audit(req, UNDO_ACTION, "Product", undefined, {
        batchId: batch.batchId,
        restored,
        skipped: results.length - restored,
      });
      await invalidateFrontendCache([...tags]);
    }
    res.json({ batchId: batch.batchId, results });
  });
}
