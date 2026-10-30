/**
 * Bulk rename (Admin → Products → Bulk rename): the pure part. Reads the pasted lines, matches each one to a
 * product by its current title, and works out what changes (title, slug, price, SEO, redirect). Nothing here
 * touches the database; the route loads the catalog, calls `planBulkRename` and writes the "ok" rows.
 */
import { parse } from "csv-parse/sync";
import { salePriceProblem } from "./admin-validators";
import { slugify } from "./product-import";

export const BULK_RENAME_MAX_LINES = 500;
export const BULK_RENAME_CHUNK = 50;
export const TITLE_MAX = 120;
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 155;

export type RenameLine = {
  line: number;
  oldTitle: string;
  newTitle: string;
  price: string;
  salePrice: string;
  seoTitle: string;
  seoDescription: string;
};

export type CatalogRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number;
  salePrice: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  image: string | null;
};

export type ProductFields = {
  title: string;
  slug: string;
  price: number;
  salePrice: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type PlanRow = {
  line: number;
  input: RenameLine;
  /** ok = will be applied; unchanged = nothing to do (e.g. already applied); error = skipped with `reason`. */
  status: "ok" | "unchanged" | "error";
  reason?: string;
  product?: {
    id: string;
    title: string;
    slug: string;
    status: string;
    category: string | null;
    categorySlug: string | null;
    image: string | null;
  };
  before?: ProductFields;
  after?: ProductFields;
  slugSuffixed?: boolean;
  seoTitleAction?: "set" | "follow" | "kept";
  seoDescriptionAction?: "set" | "kept";
  /** URL changes: "301" = old URL redirects to the new one; "none" = old URL stops working. */
  redirect?: "301" | "none";
};

const HEADER_FIRST_CELLS = new Set(["old title", "old_title", "title"]);
const CSV_COLUMNS = ["old_title", "new_title", "price", "sale_price", "seo_title", "seo_description"];

/** Case-insensitive title match key with trimmed and collapsed spaces (no fuzzy matching). */
export const matchKey = (value: string) => cleanText(value).toLowerCase();
export const cleanText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();

function toLine(cells: string[], line: number): RenameLine {
  const cell = (i: number) => cleanText(cells[i]);
  return {
    line,
    oldTitle: cell(0),
    newTitle: cell(1),
    price: cell(2),
    salePrice: cell(3),
    seoTitle: cell(4),
    seoDescription: cell(5),
  };
}

/**
 * Pasted text (one product per line, cells separated by TAB as copied from Sheets/Excel, or by "|"), or an
 * uploaded CSV with the header old_title,new_title,price,sale_price,seo_title,seo_description.
 */
export function parseRenameInput(text: string): { lines: RenameLine[]; error?: string } {
  const raw = String(text || "").replace(/^﻿/, "");
  const firstLine = raw.split(/\r?\n/).find((l) => l.trim()) || "";
  const lines: RenameLine[] = [];
  if (/^\s*"?old_title"?\s*,/i.test(firstLine)) {
    let records: string[][];
    try {
      records = parse(raw, { relax_column_count: true, skip_empty_lines: true, bom: true }) as string[][];
    } catch {
      return { lines: [], error: "The CSV file could not be read. Check that it is saved as CSV (comma separated)." };
    }
    const header = records[0].map((h) => cleanText(h).toLowerCase());
    const index = CSV_COLUMNS.map((name) => header.indexOf(name));
    if (index[0] < 0 || index[1] < 0) return { lines: [], error: "The CSV needs the columns old_title and new_title." };
    records.slice(1).forEach((record, i) => {
      const cells = index.map((at) => (at >= 0 ? (record[at] ?? "") : ""));
      if (cells.every((c) => !cleanText(c))) return;
      lines.push(toLine(cells, i + 2));
    });
  } else {
    raw.split(/\r?\n/).forEach((text, i) => {
      if (!text.trim()) return;
      const cells = text.includes("\t") ? text.split("\t") : text.split("|");
      if (lines.length === 0 && HEADER_FIRST_CELLS.has(cleanText(cells[0]).toLowerCase())) return;
      lines.push(toLine(cells, i + 1));
    });
  }
  if (lines.length > BULK_RENAME_MAX_LINES)
    return {
      lines: [],
      error: `Up to ${BULK_RENAME_MAX_LINES} lines per run (this has ${lines.length}). Split it into smaller runs.`,
    };
  return { lines };
}

/** "Rs 1,299", "1299" → 1299; blank → undefined; anything else → NaN. */
function amount(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value.replace(/rs\.?/i, "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/**
 * The plan for every line. `products` = the whole catalog (for title matching and slug collisions);
 * `categoryId` limits matching to one category.
 */
export function planBulkRename(
  lines: RenameLine[],
  products: CatalogRow[],
  options: { categoryId?: string | null; redirect: boolean },
): PlanRow[] {
  const candidates = options.categoryId ? products.filter((p) => p.categoryId === options.categoryId) : products;
  const byTitle = new Map<string, CatalogRow[]>();
  for (const p of candidates) {
    const key = matchKey(p.title);
    byTitle.set(key, [...(byTitle.get(key) || []), p]);
  }
  const rows: PlanRow[] = lines.map((input) => planLine(input, byTitle, options));

  // A product listed twice in one batch: error on every line that names it.
  const seen = new Map<string, number>();
  for (const row of rows)
    if (row.product && row.status !== "error") seen.set(row.product.id, (seen.get(row.product.id) || 0) + 1);
  for (const row of rows)
    if (row.product && (seen.get(row.product.id) || 0) > 1)
      Object.assign(row, { status: "error", reason: "This product is listed more than once in this batch." });

  // Slugs: new title → slug; taken by another product (or earlier in this batch) → -2, -3 …
  const taken = new Map(products.map((p) => [p.slug, p.id]));
  for (const row of rows) {
    if (row.status === "error" || !row.after || !row.before || !row.product) continue;
    if (row.after.title === row.before.title) {
      // Title unchanged (price or SEO only): the URL stays exactly as it is.
      if (sameFields(row.before, row.after)) row.status = "unchanged";
      continue;
    }
    const base = slugify(row.after.title);
    if (!base) {
      Object.assign(row, { status: "error", reason: "The new title has no letters or numbers to make a URL from." });
      continue;
    }
    let slug = base;
    if (base !== row.before.slug) {
      for (let n = 2; taken.has(slug) && taken.get(slug) !== row.product.id; n++) slug = `${base}-${n}`;
      row.slugSuffixed = slug !== base;
      taken.set(slug, row.product.id);
    }
    row.after.slug = slug;
    if (slug !== row.before.slug) row.redirect = options.redirect ? "301" : "none";
    if (row.status === "ok" && sameFields(row.before, row.after)) row.status = "unchanged";
  }
  return rows;
}

function sameFields(a: ProductFields, b: ProductFields) {
  return (Object.keys(a) as (keyof ProductFields)[]).every((k) => a[k] === b[k]);
}

function describe(p: CatalogRow): PlanRow["product"] {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    category: p.categoryName,
    categorySlug: p.categorySlug,
    image: p.image,
  };
}

function planLine(input: RenameLine, byTitle: Map<string, CatalogRow[]>, options: { redirect: boolean }): PlanRow {
  const fail = (reason: string, product?: CatalogRow): PlanRow => ({
    line: input.line,
    input,
    status: "error",
    reason,
    ...(product ? { product: describe(product) } : {}),
  });
  if (!input.oldTitle) return fail("Not applied: the old title is empty.");
  const matches = byTitle.get(matchKey(input.oldTitle)) || [];
  if (matches.length > 1) {
    const cats = [...new Set(matches.map((m) => m.categoryName || "no category"))].join(", ");
    return fail(
      `Not applied: ambiguous, ${matches.length} products have this title (${cats}). Choose a category above.`,
    );
  }
  let product = matches[0];
  if (!product) {
    // Already renamed (e.g. the same batch applied twice): nothing to do when the rest already matches.
    const renamed = input.newTitle ? byTitle.get(matchKey(input.newTitle)) || [] : [];
    if (renamed.length !== 1) return fail("Not applied: no product has this title.");
    product = renamed[0];
  }
  const before: ProductFields = {
    title: product.title,
    slug: product.slug,
    price: product.price,
    salePrice: product.salePrice,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  };
  const after: ProductFields = { ...before };

  const title = cleanText(input.newTitle) || product.title;
  if (title.length > TITLE_MAX)
    return fail(`Not applied: the new title is longer than ${TITLE_MAX} characters.`, product);
  after.title = title;

  const price = amount(input.price);
  if (price !== undefined) {
    if (!(price > 0)) return fail("Not applied: the price must be a number above 0.", product);
    after.price = price;
  }
  if (input.salePrice === "-") after.salePrice = null;
  else {
    const sale = amount(input.salePrice);
    if (sale !== undefined) {
      if (!(sale > 0))
        return fail('Not applied: the sale price must be a number above 0 (or "-" to remove it).', product);
      after.salePrice = sale;
    }
  }
  const saleIssue = salePriceProblem(after.price, after.salePrice);
  if (saleIssue) return fail(`Not applied: ${saleIssue}`, product);

  let seoTitleAction: PlanRow["seoTitleAction"];
  if (input.seoTitle) {
    if (input.seoTitle.length > SEO_TITLE_MAX)
      return fail(`Not applied: the SEO title is longer than ${SEO_TITLE_MAX} characters.`, product);
    after.seoTitle = input.seoTitle;
    seoTitleAction = "set";
  } else if (!before.seoTitle || cleanText(before.seoTitle) === cleanText(before.title)) {
    // Empty, or a copy of the old title: follow the new title (empty stays empty: the page uses the title).
    after.seoTitle = before.seoTitle ? title : before.seoTitle;
    seoTitleAction = "follow";
  } else seoTitleAction = "kept";

  let seoDescriptionAction: PlanRow["seoDescriptionAction"] = "kept";
  if (input.seoDescription) {
    if (input.seoDescription.length > SEO_DESCRIPTION_MAX)
      return fail(`Not applied: the SEO description is longer than ${SEO_DESCRIPTION_MAX} characters.`, product);
    after.seoDescription = input.seoDescription;
    seoDescriptionAction = "set";
  }

  if (!matches[0] && !sameFieldsExceptSlug(before, after))
    return fail(
      "Not applied: no product has the old title. A product already has the new title; use that as the old title.",
      product,
    );
  return {
    line: input.line,
    input,
    status: "ok",
    product: describe(product),
    before,
    after,
    seoTitleAction,
    seoDescriptionAction,
  };
}

function sameFieldsExceptSlug(a: ProductFields, b: ProductFields) {
  return (
    a.title === b.title &&
    a.price === b.price &&
    a.salePrice === b.salePrice &&
    a.seoTitle === b.seoTitle &&
    a.seoDescription === b.seoDescription
  );
}

/**
 * Redirects to fix when a product URL changes: those that pointed at the old URL now point at the new one (no
 * chains); one that would then point at itself is deleted (no loops).
 */
export function repointRedirects(
  redirects: { id: string; sourcePath: string; destination: string }[],
  oldPath: string,
  newPath: string,
) {
  const pointing = redirects.filter((r) => r.destination === oldPath);
  return {
    update: pointing.filter((r) => r.sourcePath !== newPath).map((r) => r.id),
    remove: pointing.filter((r) => r.sourcePath === newPath).map((r) => r.id),
    previous: pointing.map((r) => ({ sourcePath: r.sourcePath, destination: r.destination })),
  };
}

/** The old slug passed to syncProductRedirect: only when the URL changes and the 301 box is ticked. */
export const redirectFromSlug = (before: string, after: string, redirect: boolean) =>
  before !== after && redirect ? before : undefined;

/** CSV text (with header) for a list of rows; values quoted when needed. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const q = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(q).join(",")).join("\n") + "\n";
}
