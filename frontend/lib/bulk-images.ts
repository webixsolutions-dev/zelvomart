// Strict structure check for the admin bulk image upload (ZIP or folder).
// Only the template structure is accepted:
//   <product SKU>/1.<ext>           the featured (main) image
//   <product SKU>/<any name>.<ext>  the rest of the product's images
//   <product SKU>/<variation folder>/<image>   optional, variable products only
// Anything else is reported as a problem and blocks the upload.

export const MAX_PRODUCT_IMAGES = 13;
export const MAX_VARIATION_IMAGES = 8;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};
const IGNORED_EXTENSIONS = new Set(["txt", "md", "csv", "ini", "db"]);
const IGNORED_NAMES = new Set(["thumbs.db", "desktop.ini"]);

export type BulkVariant = { id: string; sku?: string; name?: string; attributes?: Record<string, unknown> };
export type BulkProduct = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  sku?: string;
  status?: string;
  rawImages?: string[];
  variants?: BulkVariant[];
};
/** One file from the ZIP or folder. `path` uses forward slashes; its first segment is the ZIP or folder name. */
export type SourceFile = { path: string; size: number; load: () => Promise<Blob>; head: () => Promise<Uint8Array> };
export type ImageGroup = {
  product: BulkProduct;
  images: SourceFile[];
  /** The folder has an image named "1": it becomes the product's featured image. */
  hasFeatured: boolean;
  variantImages: Map<string, { variant: BulkVariant; images: SourceFile[] }>;
};
export type ImageProblem = { where: string; message: string };
export type ImageCheck = { groups: ImageGroup[]; problems: ImageProblem[]; imageCount: number };

export function imageKey(value?: string | null) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function imageExtension(path: string) {
  const name = path.split("/").pop() || "";
  return name.includes(".") ? (name.split(".").pop() || "").toLowerCase() : "";
}

export function imageMime(path: string) {
  return IMAGE_TYPES[imageExtension(path)] || "";
}

function isIgnored(path: string) {
  const name = (path.split("/").pop() || "").toLowerCase();
  return name.startsWith(".") || IGNORED_NAMES.has(name) || IGNORED_EXTENSIONS.has(imageExtension(path)) || `/${path}`.includes("/__MACOSX/");
}

// The real format of a file from its first bytes, so a renamed PDF or a broken download is caught.
function detectFormat(bytes: Uint8Array) {
  const at = (offset: number, text: string) => [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && at(1, "PNG")) return "png";
  if (at(0, "GIF8")) return "gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "webp";
  if (at(4, "ftyp")) return "avif";
  return "";
}

function variantsFor(product: BulkProduct, key: string) {
  return (product.variants || []).filter((variant) => {
    if (imageKey(variant.sku) === key || imageKey(variant.name) === key) return true;
    return Object.entries(variant.attributes || {}).some(
      ([name, value]) => name !== "stockStatus" && name !== "gtin" && typeof value === "string" && imageKey(value) === key,
    );
  });
}

function variationFolderHint(product: BulkProduct) {
  const names = (product.variants || []).map((variant) => variant.sku).filter(Boolean) as string[];
  return names.length > 6 ? `${names.slice(0, 6).join(", ")}…` : names.join(", ");
}

export async function checkImageStructure(files: SourceFile[], products: BulkProduct[], replaceExisting: boolean): Promise<ImageCheck> {
  const problems: ImageProblem[] = [];
  const problem = (where: string, message: string) => {
    if (!problems.some((entry) => entry.where === where && entry.message === message)) problems.push({ where, message });
  };

  const bySku = new Map<string, BulkProduct[]>();
  const byOtherName = new Map<string, BulkProduct>();
  for (const product of products) {
    const key = imageKey(product.sku);
    if (key) bySku.set(key, [...(bySku.get(key) || []), product]);
    for (const other of [imageKey(product.slug), imageKey(product.title || product.name)]) if (other) byOtherName.set(other, product);
  }

  const relevant = files.filter((file) => !isIgnored(file.path));
  const parsed = relevant.map((file) => {
    const parts = file.path.split("/").filter(Boolean);
    const name = parts.pop() || "";
    // A ZIP named after the SKU usually holds a folder with the same name: the innermost match is the product folder.
    return { file, name, folders: parts, productIndex: parts.map((folder) => bySku.has(imageKey(folder))).lastIndexOf(true) };
  });

  // Depth at which product folders sit (1 = directly inside the ZIP, 2 = inside one wrapper folder).
  const matchedDepths = parsed.filter((entry) => entry.productIndex >= 0).map((entry) => entry.productIndex);
  const wrapper = parsed.length > 0 && parsed.every((entry) => entry.folders.length >= 3 && entry.folders[1] === parsed[0].folders[1]);
  const productDepth = matchedDepths.length ? Math.min(...matchedDepths) : wrapper ? 2 : 1;

  const groups = new Map<string, ImageGroup>();
  const usedNumbers = new Set<string>();
  let imageCount = 0;

  for (const { file, name, folders, productIndex } of parsed) {
    const extension = imageExtension(name);
    if (extension === "zip") {
      problem(file.path, "A ZIP inside the ZIP is not allowed. Put the product folders directly in one ZIP.");
      continue;
    }
    if (!IMAGE_TYPES[extension]) {
      problem(file.path, `".${extension || "?"}" is not a supported image. Use JPG, PNG, WEBP, GIF or AVIF.`);
      continue;
    }
    imageCount += 1;

    if (productIndex < 0) {
      const folder = folders[productDepth];
      if (!folder) {
        problem(file.path, "This image is not inside a product folder. Put it in a folder named with the product SKU.");
        continue;
      }
      const where = folders.slice(0, productDepth + 1).join("/");
      const other = byOtherName.get(imageKey(folder));
      if (other?.sku) problem(where, `The folder must be named with the product SKU. Rename "${folder}" to "${other.sku}".`);
      else problem(where, `No product has the SKU "${folder}". Import the product first, or rename the folder to the exact SKU.`);
      continue;
    }

    const owners = bySku.get(imageKey(folders[productIndex])) || [];
    const productFolder = folders.slice(0, productIndex + 1).join("/");
    if (owners.length > 1) {
      problem(productFolder, `The folder name matches ${owners.length} products (${owners.map((owner) => owner.sku).join(", ")}). Their SKUs are too similar to tell apart.`);
      continue;
    }
    const product = owners[0];
    const below = folders.slice(productIndex + 1);
    let variants: BulkVariant[] = [];
    if (below.length > 1) {
      problem(folders.join("/"), `Too many folder levels. Only "${product.sku}/1.jpg" and "${product.sku}/<variation>/1.jpg" are allowed.`);
      continue;
    }
    if (below.length === 1) {
      const where = `${productFolder}/${below[0]}`;
      if (!(product.variants || []).length) {
        problem(where, `"${product.sku}" is a simple product, so it cannot have the sub-folder "${below[0]}". Move the images up into "${product.sku}".`);
        continue;
      }
      variants = variantsFor(product, imageKey(below[0]));
      if (!variants.length) {
        problem(where, `"${below[0]}" is not a variation of "${product.sku}". Name the sub-folder with a variation SKU (${variationFolderHint(product)}) or one option value.`);
        continue;
      }
    }

    const base = name.replace(/\.[^.]+$/, "").trim();
    if (/^\d+$/.test(base)) {
      const numberKey = `${productFolder}/${below[0] || ""}#${Number(base)}`;
      if (usedNumbers.has(numberKey)) {
        problem(file.path, Number(base) === 1 ? "Two images in this folder are named 1. Only one image can be the featured image." : `Two images in this folder have the number ${Number(base)}. Give each image its own number.`);
        continue;
      }
      usedNumbers.add(numberKey);
    }
    if (file.size === 0) {
      problem(file.path, "This image is empty (0 bytes).");
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      problem(file.path, `This image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB per image.`);
      continue;
    }
    try {
      const format = detectFormat(await file.head());
      const expected = extension === "jpeg" ? "jpg" : extension;
      if (!format) {
        problem(file.path, "This file is not a real image or it is damaged. Export it again as JPG, PNG or WEBP.");
        continue;
      }
      if (format !== expected) {
        problem(file.path, `This file is a ${format.toUpperCase()} image but is named .${extension}. Rename it to .${format}.`);
        continue;
      }
    } catch (error) {
      problem(file.path, `This image cannot be read (${error instanceof Error ? error.message : "damaged file"}).`);
      continue;
    }

    let group = groups.get(product.id);
    if (!group) {
      group = { product, images: [], hasFeatured: false, variantImages: new Map() };
      groups.set(product.id, group);
    }
    if (!variants.length) group.images.push(file);
    for (const variant of variants) {
      const entry = group.variantImages.get(variant.id) || { variant, images: [] };
      entry.images.push(file);
      group.variantImages.set(variant.id, entry);
    }
  }

  // Numbered images first, in number order (1 = featured), then the rest by name.
  const baseOf = (file: SourceFile) => (file.path.split("/").pop() || "").replace(/\.[^.]+$/, "").trim();
  const byNumber = (a: SourceFile, b: SourceFile) => {
    const [x, y] = [baseOf(a), baseOf(b)];
    const [nx, ny] = [/^\d+$/.test(x), /^\d+$/.test(y)];
    if (nx && ny) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
  };
  for (const group of groups.values()) {
    const sku = group.product.sku || "";
    const existing = replaceExisting ? 0 : (group.product.rawImages || []).length;
    group.images.sort(byNumber);
    group.hasFeatured = group.images.some((file) => /^0*1$/.test(baseOf(file)));
    if (group.images.length && !group.hasFeatured && !existing) {
      problem(sku, `No featured image. Name one image "1" (for example 1.${imageExtension(group.images[0].path)}) in this folder; it becomes the main product image.`);
    }
    if (existing + group.images.length > MAX_PRODUCT_IMAGES) {
      problem(
        sku,
        existing
          ? `This folder has ${group.images.length} images and the product already has ${existing}. The limit is ${MAX_PRODUCT_IMAGES}. Remove ${existing + group.images.length - MAX_PRODUCT_IMAGES}, or tick "Replace existing images".`
          : `This folder has ${group.images.length} images. The limit is ${MAX_PRODUCT_IMAGES} per product.`,
      );
    }
    for (const entry of group.variantImages.values()) {
      entry.images.sort(byNumber);
      if (entry.images.length > MAX_VARIATION_IMAGES) {
        problem(`${sku} / ${entry.variant.name || entry.variant.sku}`, `This variation has ${entry.images.length} images. The limit is ${MAX_VARIATION_IMAGES} per variation.`);
      }
    }
  }

  if (!imageCount && !problems.length) problem("", "No images were found. Add JPG, PNG, WEBP, GIF or AVIF files inside folders named with the product SKU.");
  return { groups: [...groups.values()], problems, imageCount };
}
