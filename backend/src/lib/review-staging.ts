import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { AuthedRequest } from "./auth";
import multer from "multer";
import { uploadObject } from "./storage";
import { toSiteWebp } from "./catalog-images";
import { presignReviewUpload, readStagedReviewObject } from "./storage";

type Upload = {
  key: string;
  name: string;
  size: number;
  mime: string;
  field: "zip" | "media" | "avatar";
  owner: string;
};
const CHUNK_SIZE = 2 * 1024 * 1024;
export const reviewChunkUpload: RequestHandler = (req, res, next) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: CHUNK_SIZE, files: 1, fields: 15, fieldSize: 30000 },
  }).single("chunk")(req, res, (error) => {
    if (error) return res.status(400).json({ error: "Upload chunks must be no larger than 2 MB." });
    next();
  });
function uploadFromToken(req: AuthedRequest, token: unknown) {
  const upload = jwt.verify(String(token), secret(), {
    audience: "review-upload",
    issuer: "zelvomart",
  }) as Upload;
  if (
    upload.owner !== reviewUploadOwner(req) ||
    !upload.key.startsWith("review-staging/") ||
    (!req.admin && upload.field !== "media")
  )
    throw new Error("This upload belongs to another review session.");
  return upload;
}
export async function writeReviewChunk(req: AuthedRequest) {
  const upload = uploadFromToken(req, req.body.uploadToken),
    part = Number(req.body.part),
    count = Math.ceil(upload.size / CHUNK_SIZE);
  if (
    !Number.isInteger(part) ||
    part < 0 ||
    part >= count ||
    req.file?.buffer.length !== Math.min(CHUNK_SIZE, upload.size - part * CHUNK_SIZE)
  )
    throw new Error("Invalid upload chunk or size.");
  await uploadObject(`${upload.key}.parts/${part}`, req.file.buffer, "application/octet-stream");
  return { ok: true };
}
export async function completeReviewChunks(req: AuthedRequest) {
  const upload = uploadFromToken(req, req.body.uploadToken),
    parts: Buffer[] = [];
  for (let part = 0; part < Math.ceil(upload.size / CHUNK_SIZE); part++)
    parts.push(
      await readStagedReviewObject(
        `${upload.key}.parts/${part}`,
        Math.min(CHUNK_SIZE, upload.size - part * CHUNK_SIZE),
      ),
    );
  await uploadObject(upload.key, Buffer.concat(parts), upload.mime);
  return { ok: true };
}
function secret() {
  const key = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!key) throw new Error("JWT_SECRET is not configured");
  return key;
}
export function reviewUploadOwner(req: AuthedRequest) {
  return req.admin
    ? `admin:${req.admin.id}`
    : `customer:${String(req.body.productId || "")}:${String(req.body.orderNumber || "")
        .trim()
        .toUpperCase()}:${String(req.body.phone || "")
        .replace(/\D/g, "")
        .slice(-10)}`;
}
export async function stageReviewUpload(req: AuthedRequest) {
  const { filename, contentType, size, field } = req.body;
  const name = String(filename || "")
      .replace(/^.*[\\/]/, "")
      .slice(0, 180),
    mime = String(contentType || "");
  if (!["zip", "media", "avatar"].includes(field) || (!req.admin && field !== "media"))
    throw new Error("Invalid review upload field.");
  const isZip = field === "zip",
    isVideo = field === "media" && mime === "video/mp4";
  const maximum = isZip ? 40 * 1024 * 1024 : isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
  if (!name || !Number.isInteger(size) || size <= 0 || size > maximum)
    throw new Error(`File must be between 1 byte and ${maximum / 1024 / 1024} MB.`);
  if (
    isZip
      ? !/\.zip$/i.test(name)
      : !["image/jpeg", "image/png", "image/webp", ...(field === "media" ? ["video/mp4"] : [])].includes(mime)
  )
    throw new Error("Unsupported review file type.");
  const data: Upload = {
    key: `review-staging/${randomUUID()}/${encodeURIComponent(name)}`,
    name,
    size,
    mime: isZip ? "application/zip" : mime,
    field,
    owner: reviewUploadOwner(req),
  };
  const url = await presignReviewUpload(data.key, data.mime, size);
  const token = jwt.sign(data, secret(), {
    audience: "review-upload",
    issuer: "zelvomart",
    expiresIn: "1h",
  });
  return { url, token, contentType: data.mime };
}
export const hydrateReviewUploads: RequestHandler = async (req: AuthedRequest, res, next) => {
  try {
    const uploads = req.body.uploadTokens || [];
    if (!Array.isArray(uploads) || uploads.length > 7) throw new Error("Invalid staged uploads.");
    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    for (const token of uploads) {
      const upload = jwt.verify(String(token), secret(), {
        audience: "review-upload",
        issuer: "zelvomart",
      }) as Upload;
      if (
        upload.owner !== reviewUploadOwner(req) ||
        !upload.key.startsWith("review-staging/") ||
        (!req.admin && upload.field !== "media")
      )
        throw new Error("This upload belongs to another review session.");
      const buffer = await readStagedReviewObject(upload.key, upload.size);
      (files[upload.field] ||= []).push({
        fieldname: upload.field,
        originalname: upload.name,
        mimetype: upload.mime,
        size: buffer.length,
        buffer,
      } as Express.Multer.File);
    }
    if (req.body.csvContent !== undefined) {
      if (
        !req.admin ||
        typeof req.body.csvContent !== "string" ||
        Buffer.byteLength(req.body.csvContent) > 2 * 1024 * 1024
      )
        throw new Error("CSV must be under 2 MB.");
      const buffer = Buffer.from(req.body.csvContent, "utf8");
      files.csv = [
        {
          fieldname: "csv",
          originalname: String(req.body.csvFilename || "reviews.csv"),
          mimetype: "text/csv",
          size: buffer.length,
          buffer,
        } as Express.Multer.File,
      ];
    }
    if ((files.zip?.length || 0) > 1 || (files.media?.length || 0) > 6 || (files.avatar?.length || 0) > 1)
      throw new Error("Too many review files.");
    req.files = files;
    next();
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Unable to read staged upload." });
  }
};
export function reviewAssetKey(bytes: Uint8Array, name: string) {
  return `reviews/assets/${createHash("sha256").update(bytes).digest("hex")}.${name.split(".").pop()?.toLowerCase()}`;
}

/**
 * Stores one review photo or video. Photos (JPG, PNG, AVIF, WebP) become WebP like every site image
 * (toSiteWebp); videos and GIFs are stored as they are. The key hashes the original bytes.
 */
export async function uploadReviewAsset(bytes: Buffer, name: string, contentType: string) {
  const site = await toSiteWebp(bytes, contentType);
  const key =
    site.converted || site.ext === "webp" ? reviewAssetKey(bytes, `${name}.webp`) : reviewAssetKey(bytes, name);
  return uploadObject(key, site.bytes, site.contentType);
}
