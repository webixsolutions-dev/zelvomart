// Matches bulk-uploaded images (image folder or ZIP files) to products by NAME.
// The most important rule: an image never lands on the wrong product, so nothing is guessed.
//
// Accepted layouts:
//   <Product title>.zip  ->  1.jpg, 2.jpg ...          one ZIP per product
//   product-images.zip   ->  <Product title>/1.jpg ...  one folder per product
//   <Product title>.jpg, <Product title>-1.jpg, <Product title>-front.webp   loose files
// A SKU or slug works in place of the title. Names are compared exactly after normalising
// (case, spaces, punctuation and "&" vs "and" are ignored) against the title, then the
// slug, then the SKU. A name that matches no product, or more than one, is "unassigned"
// and the owner picks the product by hand.

export const MAX_PRODUCT_IMAGES = 13;

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
const IGNORED_EXTENSIONS = new Set(["txt", "md", "csv", "ini", "db", "json", "pdf", "docx", "xlsx"]);
const IGNORED_NAMES = new Set(["thumbs.db", "desktop.ini"]);

export type BulkVariant = { id: string; sku?: string; name?: string; attributes?: Record<string, unknown> };
export type BulkProduct = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  sku?: string;
  status?: string;
  image?: string;
  imageAlt?: string;
  rawImages?: string[];
  variants?: BulkVariant[];
};
/** One file from the ZIP or folder. `path` uses forward slashes; its first segment is the ZIP or folder name. */
export type SourceFile = { path: string; size: number; load: () => Promise<Blob>; head: () => Promise<Uint8Array> };
/** Images going to one product, in upload order: the first one is the main image. */
export type ImageGroup = {
  product: BulkProduct;
  images: SourceFile[];
  /** What matched: the folder, ZIP or file names, for the preview. */
  sources: string[];
  /** The group has an image numbered 1: it becomes the main image, ahead of existing images. */
  hasFeatured: boolean;
};
export type UnassignedImage = { file: SourceFile; name: string; reason: string; candidates: BulkProduct[] };
export type SkippedFile = { path: string; reason: string };
export type ImageMatch = { groups: ImageGroup[]; unassigned: UnassignedImage[]; skipped: SkippedFile[]; imageCount: number };

/** Normalised name: ignores case, accents, spaces, punctuation and "&" vs "and". */
export function nameKey(value?: string | null) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function imageExtension(path: string) {
  const name = path.split("/").pop() || "";
  return name.includes(".") ? (name.split(".").pop() || "").toLowerCase() : "";
}

export function imageMime(path: string) {
  return IMAGE_TYPES[imageExtension(path)] || "";
}

export function productName(product: BulkProduct) {
  return product.title || product.name || product.sku || "Untitled";
}

function fileBase(path: string) {
  return (path.split("/").pop() || "").replace(/\.[^.]+$/, "").trim();
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
  return "";
}

type Lookup = (name: string) => { product: BulkProduct | null; ambiguous: BulkProduct[] };

/** Exact normalised match against title, then slug, then SKU. Never fuzzy. */
function buildLookup(products: BulkProduct[]): Lookup {
  const indexes = [
    (product: BulkProduct) => nameKey(product.title || product.name),
    (product: BulkProduct) => nameKey(product.slug),
    (product: BulkProduct) => nameKey(product.sku),
  ].map((keyOf) => {
    const map = new Map<string, BulkProduct[]>();
    for (const product of products) {
      const key = keyOf(product);
      if (key) map.set(key, [...(map.get(key) || []), product]);
    }
    return map;
  });
  return (name) => {
    const key = nameKey(name);
    if (!key) return { product: null, ambiguous: [] };
    for (const index of indexes) {
      const found = index.get(key) || [];
      if (found.length === 1) return { product: found[0], ambiguous: [] };
      if (found.length > 1) return { product: null, ambiguous: found };
    }
    return { product: null, ambiguous: [] };
  };
}

// Suffixes a loose file may add after "-" or "_": a number or a view word, optionally numbered.
// Anything else is not stripped, so "Cotton T-Shirt.jpg" can never match a product "Cotton T".
const VIEW_SUFFIX = /[-_]\s*(\d+|(front|back|rear|side|top|bottom|left|right|main|cover|detail|details|closeup|close|zoom|view|angle|box|pack|package|packaging|open|inside|label|lifestyle|model|alt|extra|full)\d*)$/i;

/** Name candidates of a loose file: "Name.jpg", then "Name" from "Name-1.jpg", "Name-front.webp" or "Name (2).jpg". */
function fileNameCandidates(base: string) {
  const names = [base];
  const stripped = base.replace(/\s*\(\d+\)$/, "").replace(VIEW_SUFFIX, "").trim();
  if (stripped && stripped !== base) names.push(stripped);
  return names;
}

const isNumbered = (base: string) => /^\d+$/.test(base);

export async function matchImages(files: SourceFile[], products: BulkProduct[]): Promise<ImageMatch> {
  const lookup = buildLookup(products);
  const skipped: SkippedFile[] = [];
  const unassigned: UnassignedImage[] = [];
  const groups = new Map<string, ImageGroup>();
  let imageCount = 0;

  const assign = (product: BulkProduct, file: SourceFile, source: string) => {
    let group = groups.get(product.id);
    if (!group) {
      group = { product, images: [], sources: [], hasFeatured: false };
      groups.set(product.id, group);
    }
    group.images.push(file);
    if (!group.sources.includes(source)) group.sources.push(source);
  };

  for (const file of files) {
    if (isIgnored(file.path)) continue;
    const extension = imageExtension(file.path);
    if (extension === "zip") {
      skipped.push({ path: file.path, reason: "A ZIP inside the ZIP is not opened. Upload each product ZIP directly." });
      continue;
    }
    if (!IMAGE_TYPES[extension]) {
      skipped.push({ path: file.path, reason: `".${extension || "?"}" is not supported. Use JPG, JPEG, PNG, WEBP or GIF.` });
      continue;
    }
    if (file.size === 0) {
      skipped.push({ path: file.path, reason: "The file is empty (0 bytes)." });
      continue;
    }
    try {
      const format = detectFormat(await file.head());
      if (!format) {
        skipped.push({ path: file.path, reason: "Not a real image or the file is damaged. Export it again as JPG, PNG or WEBP." });
        continue;
      }
    } catch (error) {
      skipped.push({ path: file.path, reason: `Cannot be read (${error instanceof Error ? error.message : "damaged file"}).` });
      continue;
    }
    imageCount += 1;

    const parts = file.path.split("/").filter(Boolean);
    const base = fileBase(parts.pop() || "");
    // Folders and ZIP names, innermost first: the nearest one named like a product wins.
    let folderMatch: { product: BulkProduct; index: number } | null = null;
    let folderAmbiguous: { name: string; products: BulkProduct[] } | null = null;
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const found = lookup(parts[index]);
      if (found.product) {
        folderMatch = { product: found.product, index };
        break;
      }
      if (found.ambiguous.length && !folderAmbiguous) folderAmbiguous = { name: parts[index], products: found.ambiguous };
    }

    // The file's own name, unless it is just a number (1.jpg) or a plain photo name inside a product folder.
    let fileMatch: BulkProduct | null = null;
    let fileAmbiguous: BulkProduct[] = [];
    if (!isNumbered(base)) {
      for (const candidate of fileNameCandidates(base)) {
        const found = lookup(candidate);
        if (found.product) {
          fileMatch = found.product;
          break;
        }
        if (found.ambiguous.length) {
          fileAmbiguous = found.ambiguous;
          break;
        }
      }
    }

    if (folderMatch) {
      const deeper = parts.slice(folderMatch.index + 1);
      if (deeper.length) {
        unassigned.push({ file, name: parts.join("/"), reason: `Inside the sub-folder "${deeper.join("/")}" of "${parts[folderMatch.index]}". Sub-folders are not used; put the images directly in the product folder.`, candidates: [folderMatch.product] });
        continue;
      }
      if (fileMatch && fileMatch.id !== folderMatch.product.id) {
        unassigned.push({ file, name: base, reason: `The folder is "${productName(folderMatch.product)}" but the file name is "${productName(fileMatch)}".`, candidates: [folderMatch.product, fileMatch] });
        continue;
      }
      assign(folderMatch.product, file, parts[folderMatch.index]);
      continue;
    }
    if (fileMatch) {
      assign(fileMatch, file, base);
      continue;
    }
    const ambiguous = fileAmbiguous.length ? fileAmbiguous : folderAmbiguous?.products || [];
    if (ambiguous.length) {
      unassigned.push({ file, name: fileAmbiguous.length ? base : folderAmbiguous!.name, reason: `Matches ${ambiguous.length} products. Pick the right one.`, candidates: ambiguous });
      continue;
    }
    const where = parts.length ? `${parts[parts.length - 1]}/${base}` : base;
    unassigned.push({ file, name: where, reason: "No product has this name, slug or SKU.", candidates: [] });
  }

  return { groups: [...groups.values()], unassigned, skipped, imageCount };
}

// Numbered images first in number order (1 = main), then the rest by name.
export function sortImages(images: SourceFile[]) {
  return [...images].sort((a, b) => {
    const [x, y] = [fileBase(a.path), fileBase(b.path)];
    const [nx, ny] = [isNumbered(x), isNumbered(y)];
    if (nx && ny) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    const [sx, sy] = [x.match(/[-_ ](\d+)$/), y.match(/[-_ ](\d+)$/)];
    if (sx && sy && x.slice(0, -sx[0].length) === y.slice(0, -sy[0].length)) return Number(sx[1]) - Number(sy[1]);
    return x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" }) || a.path.localeCompare(b.path);
  });
}

export function hasFeaturedImage(images: SourceFile[]) {
  return images.some((file) => /^0*1$/.test(fileBase(file.path)));
}
