import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import multer from "multer";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "./lib/db";
import { requireAuth, type AuthedRequest } from "./lib/auth";
import { invalidateFrontendCache } from "./lib/cache-invalidation";
import { uploadObject } from "./lib/storage";
import {
  stageReviewUpload,
  hydrateReviewUploads,
  reviewAssetKey,
  reviewChunkUpload,
  writeReviewChunk,
  completeReviewChunks,
} from "./lib/review-staging";
import {
  csv,
  REVIEW_COLUMNS,
  readReviewCsv,
  readMediaZip,
  matchProduct,
  validateReview,
  rowMedia,
  inspectMedia,
} from "./lib/review-import";

export const reviewRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 40 * 1024 * 1024,
    files: 8,
    fields: 20,
    fieldSize: 200000,
  },
});
function checkedUpload(handler: RequestHandler): RequestHandler {
  return (req, res, next) =>
    handler(req, res, (error: any) => {
      if (error)
        return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
          error:
            error.code === "LIMIT_FILE_SIZE"
              ? "Upload exceeds the permitted file size."
              : error.message,
        });
      next();
    });
}
export const reviewUpload = checkedUpload(
  upload.fields([
    { name: "csv", maxCount: 1 },
    { name: "zip", maxCount: 1 },
    { name: "media", maxCount: 6 },
    { name: "avatar", maxCount: 1 },
  ]),
);
export const customerReviewUpload = checkedUpload(
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024,
      files: 6,
      fields: 10,
      fieldSize: 25000,
    },
  }).fields([{ name: "media", maxCount: 6 }]),
);
function fileMap(req: Request) {
  return (req.files || {}) as Record<string, Express.Multer.File[]>;
}
function wrap(fn: (req: AuthedRequest, res: Response) => Promise<unknown>) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res).catch((e) =>
      res.status(e.code === "P2002" ? 409 : 400).json({
        error:
          e.code === "P2002"
            ? "Review reference already exists; nothing was overwritten."
            : e.message || "Review operation failed.",
      }),
    );
  };
}
reviewRouter.use(requireAuth("content.write"));
reviewRouter.post(
  "/upload-chunk",
  reviewChunkUpload,
  wrap(async (req, res) => res.json(await writeReviewChunk(req))),
);
reviewRouter.post(
  "/upload-complete",
  wrap(async (req, res) => res.json(await completeReviewChunks(req))),
);
reviewRouter.post(
  "/upload-url",
  wrap(async (req, res) => res.json(await stageReviewUpload(req))),
);
const auditData = (
  req: AuthedRequest,
  action: string,
  id: string,
  details: object = {},
) => ({
  userId: req.admin?.id,
  action,
  entity: "Review",
  entityId: id,
  details,
});
reviewRouter.get(
  "/products",
  wrap(async (req, res) =>
    res.json(
      await prisma.product.findMany({
        select: { id: true, title: true, sku: true },
        orderBy: { title: "asc" },
      }),
    ),
  ),
);
reviewRouter.get("/template", (_req, res) =>
  res
    .type("text/csv")
    .attachment("review-template.csv")
    .send(csv([REVIEW_COLUMNS])),
);
reviewRouter.get(
  "/batches",
  wrap(async (_req, res) =>
    res.json(
      await prisma.reviewImportBatch.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { reviews: true } } },
        take: 200,
      }),
    ),
  ),
);
reviewRouter.get(
  "/batches/:id/errors",
  wrap(async (req, res) => {
    const batch = await prisma.reviewImportBatch.findUniqueOrThrow({
      where: { id: String(req.params.id) },
    });
    const errors = batch.errors as unknown as {
      row: number;
      values: Record<string, string>;
      error: string;
    }[];
    res
      .type("text/csv")
      .attachment("review-errors.csv")
      .send(
        csv([
          [...REVIEW_COLUMNS, "row", "error"],
          ...errors.map((e) => [
            ...REVIEW_COLUMNS.map((k) => e.values[k]),
            e.row,
            e.error,
          ]),
        ]),
      );
  }),
);
async function validateUpload(req: Request, preview: boolean) {
  const files = fileMap(req);
  if (!files.csv?.[0]) throw new Error("CSV is required.");
  if (files.csv[0].size > 2 * 1024 * 1024)
    throw new Error("CSV must be under 2 MB.");
  const rows = readReviewCsv(files.csv[0].buffer),
    mediaFiles = readMediaZip(files.zip?.[0]?.buffer);
  const overrides = JSON.parse(String(req.body.overrides || "{}")) as Record<
    string,
    string
  >;
  const digest = createHash("sha256")
    .update(files.csv[0].buffer)
    .update(files.zip?.[0]?.buffer || "")
    .update(JSON.stringify(overrides))
    .digest("hex");
  const products = await prisma.product.findMany({
    select: { id: true, title: true, sku: true },
  });
  const refs = await prisma.review.findMany({
    where: { reviewRef: { in: rows.map((r) => r.reviewRef).filter(Boolean) } },
    select: { reviewRef: true },
  });
  const existing = new Set(refs.map((r) => r.reviewRef)),
    seen = new Set<string>(),
    assigned = new Set<string>();
  const result = [];
  for (const [index, values] of rows.entries()) {
    const { errors, warnings } = validateReview(values);
    const override = overrides[String(index)];
    const match = override
      ? { product: products.find((p) => p.id === override), error: undefined }
      : matchProduct(values, products);
    if (!match.product)
      errors.push(match.error || "Selected product no longer exists.");
    if (existing.has(values.reviewRef))
      errors.push(
        "Duplicate reviewRef already exists (including deleted reviews).",
      );
    if (seen.has(values.reviewRef)) errors.push("Duplicate reviewRef in CSV.");
    seen.add(values.reviewRef);
    let media: Awaited<ReturnType<typeof rowMedia>> = [];
    try {
      media = await rowMedia(values, mediaFiles, preview, (bytes, path, type) =>
        uploadObject(reviewAssetKey(bytes, path), bytes, type),
      );
      media.forEach((m) => assigned.add(m.path));
    } catch (e: any) {
      errors.push(e.message);
    }
    result.push({
      index,
      row: index + 2,
      values,
      product: match.product,
      errors,
      warnings,
      media,
    });
  }
  return {
    rows: result,
    mediaFiles,
    digest,
    unassigned: Object.keys(mediaFiles).filter((p) => !assigned.has(p)),
    filename: files.csv[0].originalname,
  };
}
reviewRouter.post(
  "/preview",
  reviewUpload,
  hydrateReviewUploads,
  wrap(async (req, res) => {
    const { mediaFiles, ...preview } = await validateUpload(req, true);
    res.json(preview);
  }),
);
reviewRouter.post(
  "/import",
  reviewUpload,
  hydrateReviewUploads,
  wrap(async (req, res) => {
    const validated = await validateUpload(req, false);
    if (req.body.digest !== validated.digest)
      throw new Error(
        "Files or product selections changed. Validate and preview again.",
      );
    const selected = JSON.parse(String(req.body.selected || "[]")) as number[];
    if (
      !Array.isArray(selected) ||
      !selected.length ||
      new Set(selected).size !== selected.length ||
      selected.some((i) => !Number.isInteger(i) || !validated.rows[i])
    )
      throw new Error("Explicitly select the rows to import.");
    if (selected.some((i) => validated.rows[i].errors.length))
      throw new Error(
        "Resolve errors or deselect invalid rows before importing.",
      );
    const batch = await prisma.reviewImportBatch.create({
      data: { filename: validated.filename, createdBy: req.admin?.id },
    });
    let imported = 0;
    const errors: {
      row: number;
      values: Record<string, string>;
      error: string;
    }[] = [];
    for (const row of validated.rows) {
      if (!selected.includes(row.index)) {
        if (row.errors.length)
          errors.push({
            row: row.row,
            values: row.values,
            error: row.errors.join(" "),
          });
        continue;
      }
      try {
        const media: { type: string; url: string; path: string }[] = [];
        let avatarUrl: string | undefined;
        for (const m of row.media) {
          const url = await uploadObject(
            reviewAssetKey(validated.mediaFiles[m.path], m.path),
            validated.mediaFiles[m.path],
            m.contentType,
          );
          if (m.avatar) avatarUrl = url;
          else media.push({ type: m.type, url, path: m.path });
        }
        await prisma.$transaction(
          async (tx) => {
            const rowBatch = await tx.reviewImportBatch.findUniqueOrThrow({
              where: { id: batch.id },
            });
            if (rowBatch.deletedAt) throw new Error("Batch has been deleted.");
            await tx.review.create({
              data: {
                productId: row.product!.id,
                name: row.values.reviewerName,
                email: row.values.reviewerEmail || null,
                rating: Number(row.values.rating),
                body: row.values.reviewText,
                reviewDate: new Date(`${row.values.reviewDate}T00:00:00Z`),
                reviewRef: row.values.reviewRef,
                origin: "IMPORTED",
                batchId: batch.id,
                avatarUrl,
                media: { create: media },
              },
            });
          },
          { isolationLevel: "Serializable" },
        );
        imported++;
      } catch (e: any) {
        errors.push({
          row: row.row,
          values: row.values,
          error: e.code === "P2002" ? "Duplicate reviewRef." : e.message,
        });
      }
    }
    const failed = errors.filter((e) => selected.includes(e.row - 2)).length,
      skipped = validated.rows.length - selected.length;
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.reviewImportBatch.update({
        where: { id: batch.id },
        data: { imported, skipped, failed, errors },
      });
      await tx.auditLog.create({
        data: auditData(req, "review_import", batch.id, {
          imported,
          skipped,
          failed,
        }),
      });
      return updated;
    });
    res.status(201).json(result);
  }),
);
reviewRouter.delete(
  "/batches/:id",
  wrap(async (req, res) => {
    const id = String(req.params.id);
    const count = await prisma.$transaction(
      async (tx) => {
        const batch = await tx.reviewImportBatch.findUniqueOrThrow({
          where: { id },
        });
        if (batch.deletedAt) return 0;
        const affected = await tx.review.count({
          where: { batchId: id, deletedAt: null },
        });
        if (req.body.confirmCount !== affected)
          throw new Error(
            `Batch now contains ${affected} reviews. Refresh and confirm again.`,
          );
        const now = new Date();
        await tx.reviewImportBatch.update({
          where: { id },
          data: { deletedAt: now },
        });
        await tx.review.updateMany({
          where: { batchId: id, deletedAt: null },
          data: { deletedAt: now },
        });
        await tx.auditLog.create({
          data: auditData(req, "review_batch_delete", id, { count: affected }),
        });
        return affected;
      },
      { isolationLevel: "Serializable" },
    );
    await invalidateFrontendCache(["products"]);
    res.json({ count });
  }),
);
reviewRouter.post(
  "/batches/:id/restore",
  wrap(async (req, res) => {
    const id = String(req.params.id);
    await prisma.$transaction(
      async (tx) => {
        const batch = await tx.reviewImportBatch.findUniqueOrThrow({
          where: { id },
        });
        if (!batch.deletedAt) throw new Error("Batch is already active.");
        await tx.review.updateMany({
          where: { batchId: id, deletedAt: batch.deletedAt },
          data: { deletedAt: null, status: "PENDING" },
        });
        await tx.reviewImportBatch.update({
          where: { id },
          data: { deletedAt: null },
        });
        await tx.auditLog.create({
          data: auditData(req, "review_batch_restore", id),
        });
      },
      { isolationLevel: "Serializable" },
    );
    await invalidateFrontendCache(["products"]);
    res.json({ ok: true });
  }),
);
export async function storeReviewFiles(req: Request) {
  const files = fileMap(req),
    media = [];
  let avatarUrl: string | undefined;
  const uploads = [...(files.media || []), ...(files.avatar || [])];
  let photos = 0,
    videos = 0;
  const checked = [];
  for (const f of uploads) {
    const avatar = f.fieldname === "avatar",
      info = await inspectMedia(f.buffer, f.originalname, avatar);
    if (!avatar) {
      if (info.type === "image") photos++;
      else videos++;
    }
    checked.push({ f, avatar, info });
  }
  if (photos > 5 || videos > 1)
    throw new Error("Maximum 5 photos and 1 video.");
  for (const { f, avatar, info } of checked) {
    const url = await uploadObject(
      reviewAssetKey(f.buffer, f.originalname),
      f.buffer,
      info.contentType,
    );
    if (avatar) avatarUrl = url;
    else media.push({ type: info.type, url });
  }
  return { avatarUrl, media };
}
reviewRouter.post(
  "/",
  reviewUpload,
  hydrateReviewUploads,
  wrap(async (req, res) => {
    const b = req.body;
    const isTest = b.isTest === true || b.isTest === "true";
    const reviewRef = `${isTest ? "TEST" : "MANUAL"}-${randomUUID()}`;
    const values = {
      reviewRef,
      reviewerName: String(b.name || ""),
      reviewerEmail: String(b.email || ""),
      rating: String(b.rating || ""),
      reviewText: String(b.body || ""),
      reviewDate: String(b.reviewDate || ""),
    };
    const { errors } = validateReview(values, isTest);
    if (errors.length) throw new Error(errors.join(" "));
    const product = await prisma.product.findUnique({
      where: { id: String(b.productId || "") },
    });
    if (!product) throw new Error("Select an existing product.");
    if (!["PENDING", "APPROVED"].includes(b.status))
      throw new Error("Choose Pending or Approved.");
    const { media, avatarUrl } = await storeReviewFiles(req);
    const row = await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          productId: product.id,
          name: values.reviewerName,
          email: values.reviewerEmail,
          rating: Number(values.rating),
          body: values.reviewText,
          reviewDate: new Date(`${values.reviewDate}T00:00:00Z`),
          reviewRef,
          origin: isTest ? "TEST" : "MANUAL",
          avatarUrl,
          status: b.status,
          media: { create: media },
        },
        include: {
          media: true,
          product: { select: { id: true, title: true, sku: true } },
        },
      });
      await tx.auditLog.create({
        data: auditData(req, "review_manual_create", review.id),
      });
      return review;
    });
    await invalidateFrontendCache(["products"]);
    res.status(201).json(row);
  }),
);
reviewRouter.get(
  "/",
  wrap(async (_req, res) =>
    res.json(
      await prisma.review.findMany({
        where: { deletedAt: null },
        include: {
          product: { select: { title: true, sku: true } },
          media: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ),
  ),
);
reviewRouter.patch(
  "/:id",
  reviewUpload,
  hydrateReviewUploads,
  wrap(async (req, res) => {
    const id = String(req.params.id),
      b = req.body;
    if (!["PENDING", "APPROVED", "REJECTED"].includes(b.status))
      throw new Error("Invalid status.");
    const existing = await prisma.review.findUniqueOrThrow({
      where: { id },
      include: { batch: true },
    });
    if (existing.deletedAt || existing.batch?.deletedAt)
      throw new Error("Review is deleted.");
    if (
      b.isTest !== undefined &&
      (b.isTest === true || b.isTest === "true") !==
        (existing.origin === "TEST")
    )
      throw new Error("The demo/genuine review type cannot be changed.");
    const productId = String(b.productId || existing.productId);
    if (productId !== existing.productId && existing.origin === "CUSTOMER")
      throw new Error(
        "A verified customer review must stay with its purchased product.",
      );
    if (
      !(await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      }))
    )
      throw new Error("Select an existing product.");
    const uploaded = await storeReviewFiles(req);
    const retain =
      b.retainMediaIds === undefined
        ? undefined
        : typeof b.retainMediaIds === "string"
          ? JSON.parse(b.retainMediaIds)
          : b.retainMediaIds;
    if (
      retain !== undefined &&
      (!Array.isArray(retain) ||
        retain.some((value: unknown) => typeof value !== "string"))
    )
      throw new Error("Invalid media selection.");
    const row = await prisma.$transaction(
      async (tx) => {
        const current = await tx.review.findUniqueOrThrow({
          where: { id },
          include: { batch: true, media: true },
        });
        if (current.deletedAt || current.batch?.deletedAt)
          throw new Error("Review is deleted.");
        const values = {
          reviewRef: current.reviewRef || "LEGACY",
          reviewerName: String(b.name ?? current.name),
          reviewerEmail: String(b.email ?? current.email ?? ""),
          rating: String(b.rating ?? current.rating),
          reviewText: String(b.body ?? current.body),
          reviewDate: String(
            b.reviewDate ||
              (current.reviewDate || current.createdAt)
                .toISOString()
                .slice(0, 10),
          ),
        };
        const { errors } = validateReview(values);
        if (errors.length) throw new Error(errors.join(" "));
        if (
          retain?.some(
            (mediaId: string) => !current.media.some((m) => m.id === mediaId),
          )
        )
          throw new Error(
            "An attachment no longer exists. Refresh the review.",
          );
        const kept = current.media.filter(
          (m) => retain === undefined || retain.includes(m.id),
        );
        const combined = [...kept, ...uploaded.media];
        if (
          combined.filter((m) => m.type === "image").length > 5 ||
          combined.filter((m) => m.type === "video").length > 1
        )
          throw new Error(
            "Maximum 5 photos and 1 video, including existing attachments.",
          );
        const updated = await tx.review.update({
          where: { id },
          data: {
            status: b.status,
            name: values.reviewerName,
            email: values.reviewerEmail || null,
            rating: Number(values.rating),
            body: values.reviewText,
            reviewDate: new Date(`${values.reviewDate}T00:00:00Z`),
            productId: b.productId === undefined ? undefined : productId,
            avatarUrl:
              uploaded.avatarUrl ||
              (b.removeAvatar === true || b.removeAvatar === "true"
                ? null
                : current.avatarUrl),
            media: {
              deleteMany:
                retain === undefined ? undefined : { id: { notIn: retain } },
              create: uploaded.media,
            },
          },
          include: {
            media: true,
            product: { select: { id: true, title: true, sku: true } },
          },
        });
        await tx.auditLog.create({
          data: auditData(req, "review_edit", id, { status: b.status }),
        });
        return updated;
      },
      { isolationLevel: "Serializable" },
    );
    await invalidateFrontendCache(["products"]);
    res.json(row);
  }),
);
reviewRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const id = String(req.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({ data: auditData(req, "review_delete", id) });
    });
    await invalidateFrontendCache(["products"]);
    res.json({ ok: true });
  }),
);
