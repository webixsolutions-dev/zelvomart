import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import sharp from "sharp";

export const REVIEW_COLUMNS = [
  "reviewRef",
  "productTitle",
  "productSku",
  "reviewerName",
  "reviewerEmail",
  "rating",
  "reviewText",
  "reviewDate",
  "mediaFiles",
  "avatarFile",
];
export const PHOTO_LIMIT = 5 * 1024 * 1024;
export const VIDEO_LIMIT = 20 * 1024 * 1024;
export type ProductMatch = { id: string; title: string; sku: string };
export type ReviewRow = Record<string, string>;
export function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
export function csv(rows: unknown[][]) {
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function readReviewCsv(buffer: Buffer): ReviewRow[] {
  const rows = parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer), {
    bom: true,
    columns: (headers: string[]) => {
      if (new Set(headers).size !== headers.length || REVIEW_COLUMNS.some((c) => !headers.includes(c)))
        throw new Error("Use the review CSV template with all column headers.");
      return headers;
    },
    skip_empty_lines: true,
    trim: true,
    max_record_size: 100000,
  }) as ReviewRow[];
  if (!rows.length || rows.length > 500) throw new Error("Upload between 1 and 500 reviews per CSV.");
  return rows;
}
const normalized = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
export function matchProduct(row: ReviewRow, products: ProductMatch[]) {
  const matches = (field: "title" | "sku", value: string) => {
    const exact = products.filter((p) => p[field] === value);
    return exact.length ? exact : products.filter((p) => normalized(p[field]) === normalized(value));
  };
  const title = row.productTitle?.trim(),
    sku = row.productSku?.trim();
  if (!title && !sku) return { error: "Product title or SKU is required." };
  const candidates = sku ? matches("sku", sku) : matches("title", title!);
  if (candidates.length !== 1)
    return {
      error: candidates.length
        ? "Ambiguous product match. Select an existing product."
        : "Product not found. Select an existing product.",
    };
  const product = candidates[0];
  if (title && sku && !matches("title", title).some((p) => p.id === product.id))
    return {
      error: "Title and SKU refer to different products. Select the correct existing product.",
    };
  return { product };
}
export function calendarDate(
  value: string,
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.STORE_TIMEZONE || "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value && value <= today;
}
export function validateReview(row: ReviewRow, allowNoEmail = true) {
  const errors: string[] = [],
    warnings: string[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(row.reviewRef || ""))
    errors.push("reviewRef must be 1–100 letters, numbers, dots, underscores or hyphens.");
  if (!row.reviewerName?.trim() || row.reviewerName.length > 200)
    errors.push("Reviewer name is required (maximum 200 characters).");
  if (!row.reviewText?.trim() || row.reviewText.length > 20000)
    errors.push("Review text is required (maximum 20000 characters).");
  if (!/^[1-5]$/.test(row.rating || "")) errors.push("Rating must be a whole number from 1 to 5.");
  if (!calendarDate(row.reviewDate || "")) errors.push("Use a valid YYYY-MM-DD date that is not in the future.");
  if (!row.reviewerEmail)
    (allowNoEmail ? warnings : errors).push("Email missing. Import only genuine historical feedback.");
  else if (row.reviewerEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(row.reviewerEmail)) errors.push("Invalid email.");
  return { errors, warnings };
}
export function readMediaZip(buffer?: Buffer) {
  if (!buffer) return {} as Record<string, Uint8Array>;
  let size = 0,
    count = 0;
  return unzipSync(buffer, {
    filter: (file) => {
      if (file.name.endsWith("/")) return false;
      if (++count > 3000 || (size += file.originalSize) > 100 * 1024 * 1024 || file.originalSize > VIDEO_LIMIT)
        throw new Error("ZIP exceeds 100 MB expanded, 3000 files or 20 MB per file.");
      if (!safePath(file.name)) throw new Error("Unsafe ZIP path.");
      return true;
    },
  });
}
export function safePath(value: string) {
  return (
    !!value &&
    !value.includes("\\") &&
    !value.startsWith("/") &&
    !value.includes(":") &&
    value.split("/").every((p) => p && p !== "." && p !== "..")
  );
}
export async function inspectMedia(bytes: Uint8Array, name: string, avatar = false) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "mp4" && !avatar) {
    if (bytes.length > VIDEO_LIMIT || bytes.length < 12 || Buffer.from(bytes.slice(4, 8)).toString() !== "ftyp")
      throw new Error("Video must be MP4, up to 20 MB.");
    return { type: "video", contentType: "video/mp4" };
  }
  if (!["jpg", "jpeg", "png", "webp"].includes(ext || "") || bytes.length > PHOTO_LIMIT)
    throw new Error("Photos/avatar must be JPEG, PNG or WebP, up to 5 MB.");
  const meta = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
  if (
    !["jpeg", "png", "webp"].includes(meta.format || "") ||
    meta.format !== ({ jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp" } as Record<string, string>)[ext!]
  )
    throw new Error("Image contents do not match the file type.");
  return { type: "image", contentType: `image/${meta.format}` };
}
export async function rowMedia(
  row: ReviewRow,
  files: Record<string, Uint8Array>,
  preview = false,
  previewUrl?: (bytes: Uint8Array, path: string, contentType: string) => Promise<string>,
) {
  const paths = (row.mediaFiles || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (paths.length > 6) throw new Error("Maximum 5 photos and 1 video per review.");
  if (new Set(paths).size !== paths.length) throw new Error("Duplicate media path.");
  const all = [...paths, ...(row.avatarFile ? [row.avatarFile] : [])];
  const media = [];
  for (const path of all) {
    if (!safePath(path) || !path.startsWith(`${row.reviewRef}/`))
      throw new Error("Each file must be inside its own reviewRef folder.");
    if (!files[path]) throw new Error(`Missing file: ${path}`);
    const avatar = path === row.avatarFile;
    const info = await inspectMedia(files[path], path, avatar);
    let url: string | undefined;
    if (preview && previewUrl) url = await previewUrl(files[path], path, info.contentType);
    else if (preview)
      url =
        info.type === "image"
          ? `data:image/webp;base64,${(await sharp(files[path]).resize(180, 180, { fit: "inside" }).webp().toBuffer()).toString("base64")}`
          : `data:video/mp4;base64,${Buffer.from(files[path]).toString("base64")}`;
    media.push({ path, ...info, avatar, url });
  }
  if (
    media.filter((m) => !m.avatar && m.type === "image").length > 5 ||
    media.filter((m) => m.type === "video").length > 1
  )
    throw new Error("Maximum 5 photos and 1 video per review.");
  return media;
}
