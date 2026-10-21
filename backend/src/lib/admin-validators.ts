import { z } from "zod";

/**
 * Input checks for the admin's product, category and redirect writes (checkout already had its own).
 * Objects are "loose": fields the handlers read but these schemas do not list (previousSlug, catalogMeta
 * details, …) pass through unchanged. What is listed is checked for type, length and format.
 */

const blank = (value: unknown) => value === "" || value === undefined || value === null;

/** A money amount: a finite number ≥ 0; "" and null mean "not set". */
const optionalAmount = z.preprocess(
  (v) => (blank(v) ? null : Number(v)),
  z.number().finite().min(0).max(100_000_000).nullable(),
);
const amount = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number({ error: "Enter a price." }).finite().min(0).max(100_000_000),
);
const percent = z.preprocess((v) => (blank(v) ? null : Number(v)), z.number().finite().min(0).max(100).nullable());
const wholeNumber = z.preprocess(
  (v) => (blank(v) ? undefined : Number(v)),
  z.number().int().min(0).max(1_000_000).optional(),
);
const text = (max: number) => z.preprocess((v) => (blank(v) ? null : v), z.string().max(max).nullable());

/** Lower-case letters, digits, hyphens and underscores (and %-encoded characters from WordPress imports). */
const slug = z
  .string()
  .trim()
  .min(1, "Add a slug.")
  .max(200)
  .regex(/^[a-z0-9%][a-z0-9%_-]*$/, "Slugs use lower-case letters, numbers, - and _ only.");

const isWebUrlOrPath = (value: string) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
/** A link the storefront may render: an absolute http(s) URL or a site path. Never javascript:/data:. */
const webLink = (max = 2000) =>
  z.string().trim().max(max).refine(isWebUrlOrPath, "Use a full https:// link or a path starting with /.");
const optionalWebLink = (max = 2000) => z.preprocess((v) => (blank(v) ? null : v), webLink(max).nullable());

const productStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const stockStatus = z.enum(["instock", "outofstock", "onbackorder"]);

const variant = z.looseObject({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(100),
  priceOverride: optionalAmount.optional(),
  stock: wholeNumber,
  trackStock: z.boolean().optional(),
  stockStatus: stockStatus.optional(),
  imageUrl: optionalWebLink().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

const productFields = {
  title: z.string().trim().min(1, "Add a product name.").max(200),
  slug,
  sku: z.string().trim().min(1, "Add a SKU.").max(100),
  categoryId: z.preprocess((v) => (blank(v) ? null : v), z.string().max(100).nullable()),
  price: amount,
  salePrice: optionalAmount,
  costPrice: optionalAmount,
  stock: wholeNumber,
  trackStock: z.boolean(),
  stockStatus,
  status: productStatus,
  featured: z.boolean(),
  bundleEnabled: z.boolean(),
  bundleDiscountPercent: percent,
  shortDescription: text(20_000),
  descriptionHtml: text(300_000),
  images: z.array(webLink()).max(40),
  videoUrl: optionalWebLink(1000),
  seoTitle: text(200),
  seoDescription: text(1000),
  canonicalUrl: optionalWebLink(),
  variants: z.array(variant).max(300),
  catalogMeta: z.looseObject({}).nullable(),
};

const requiredOnCreate = new Set(["title", "slug", "sku", "price"]);
const createShape = Object.fromEntries(
  Object.entries(productFields).map(([key, schema]) => [key, requiredOnCreate.has(key) ? schema : schema.optional()]),
) as Record<string, z.ZodType>;

/** Sale price must be below the regular price when both are set (the storefront ignores it otherwise). */
export function salePriceProblem(price: unknown, salePrice: unknown) {
  const regular = Number(price);
  const sale = salePrice == null || salePrice === "" ? null : Number(salePrice);
  if (sale == null || sale === 0 || !Number.isFinite(regular)) return null;
  return sale >= regular ? "The sale price must be lower than the regular price." : null;
}

export const productCreateSchema = z.looseObject(createShape).superRefine((value, ctx) => {
  const problem = salePriceProblem(value.price, value.salePrice);
  if (problem) ctx.addIssue({ code: "custom", path: ["salePrice"], message: problem });
});

/** PATCH: every field optional; the sale/regular comparison is made in the route against the saved values. */
export const productUpdateSchema = z.looseObject(
  Object.fromEntries(Object.entries(productFields).map(([key, schema]) => [key, schema.optional()])) as Record<
    string,
    z.ZodType
  >,
);

export const variantCreateSchema = variant;

const categoryFields = {
  name: z.string().trim().min(1, "Add a category name.").max(100),
  slug,
  sortOrder: z.preprocess(
    (v) => (blank(v) ? undefined : Number(v)),
    z.number().int().min(-100_000).max(100_000).optional(),
  ),
  imageUrl: optionalWebLink(),
  description: text(5000),
  seoTitle: text(200),
  seoDescription: text(1000),
};
export const categoryCreateSchema = z.looseObject({
  ...categoryFields,
  imageUrl: categoryFields.imageUrl.optional(),
  description: categoryFields.description.optional(),
  seoTitle: categoryFields.seoTitle.optional(),
  seoDescription: categoryFields.seoDescription.optional(),
});
export const categoryUpdateSchema = z.looseObject(
  Object.fromEntries(Object.entries(categoryFields).map(([k, s]) => [k, s.optional()])),
);

export const redirectSchema = z.looseObject({
  sourcePath: z
    .string()
    .trim()
    .min(2, "Enter the old path, e.g. /old-page/.")
    .max(500)
    .refine(
      (v) => v.startsWith("/") && !v.startsWith("//") && !/\s/.test(v),
      "The old URL must be a path on this site, starting with /.",
    ),
  destination: webLink(2000),
  permanent: z.boolean().optional(),
});

/**
 * Checks `body` against `schema`. On failure answers 400 with the first readable message and every field
 * issue, and returns false so the route stops. The route keeps using the original body: a PATCH must only
 * touch the fields that were sent, and the parsed output fills absent optional fields.
 */
export function validAdminBody(
  schema: z.ZodType,
  body: unknown,
  res: { status: (code: number) => { json: (value: unknown) => unknown } },
): boolean {
  const result = schema.safeParse(body ?? {});
  if (result.success) return true;
  const issues = result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
  res.status(400).json({ error: issues[0]?.message || "INVALID_INPUT", issues });
  return false;
}
