import { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";

/**
 * Product cards (shop, category, home rows, cart, search) in one light read: the card fields only, the main image
 * instead of the whole gallery, the few catalog-meta keys a card uses instead of the whole meta JSON, and the review
 * count/average as an aggregate instead of one row per review. Descriptions, galleries and review text are never
 * read here (the product page loads those for one product).
 *
 * The rows are shaped like a `productListSelect` row, so `jsonProductSummary` builds exactly the same card JSON.
 */
type CardRow = {
  id: string;
  slug: string;
  title: string;
  sku: string;
  price: Prisma.Decimal;
  salePrice: Prisma.Decimal | null;
  stock: number;
  trackStock: boolean;
  stockStatus: string;
  featured: boolean;
  bundleEnabled: boolean;
  bundleDiscountPercent: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  shortDescription: string | null;
  image: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  reviewCount: number;
  ratingAvg: number | null;
  meta: Record<string, unknown> | null;
};

const VARIANT_SELECT = {
  id: true,
  productId: true,
  sku: true,
  name: true,
  stock: true,
  trackStock: true,
  stockStatus: true,
  active: true,
  priceOverride: true,
  imageUrl: true,
  attributes: true,
} satisfies Prisma.VariantSelect;

export async function loadCardRows(ids: string[]) {
  if (!ids.length) return [];
  const [rows, variants] = await Promise.all([
    prisma.$queryRaw<CardRow[]>(Prisma.sql`
      SELECT p.id, p.slug, p.title, p.sku, p.price, p."salePrice", p.stock, p."trackStock", p."stockStatus", p.featured,
        p."bundleEnabled", p."bundleDiscountPercent", p."createdAt", p."updatedAt", p."shortDescription",
        CASE WHEN jsonb_typeof(p.images->0)='string' THEN p.images->>0 END AS image,
        c.id AS "categoryId", c.name AS "categoryName", c.slug AS "categorySlug",
        COALESCE(r.count,0)::int AS "reviewCount", r.avg::float AS "ratingAvg",
        CASE WHEN m.meta IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
          'badge', m.meta->'badge',
          'badges', m.meta->'badges',
          'tags', m.meta->'tags',
          'freeShipping', m.meta->'freeShipping',
          'imageMeta', jsonb_strip_nulls(jsonb_build_object('alt', m.meta#>'{imageMeta,alt}', 'title', m.meta#>'{imageMeta,title}')),
          'variations', (SELECT jsonb_agg(jsonb_build_object('sku', v->'sku', 'name', v->'name', 'regularPrice', v->'regularPrice'))
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.meta->'variations')='array' THEN m.meta->'variations' ELSE '[]'::jsonb END) v)
        )) END AS meta
      FROM "Product" p
      LEFT JOIN "Category" c ON c.id=p."categoryId"
      LEFT JOIN LATERAL (SELECT CASE WHEN left(btrim(p."sourceUrl"),1)='{' AND pg_input_is_valid(p."sourceUrl",'jsonb')
        THEN p."sourceUrl"::jsonb->'zvmCatalog' END AS meta) m ON true
      LEFT JOIN LATERAL (SELECT count(*) AS count, avg(rv.rating) AS avg FROM "Review" rv
        WHERE rv."productId"=p.id AND rv.status='APPROVED' AND rv."deletedAt" IS NULL AND rv.origin<>'TEST') r ON true
      WHERE p.id = ANY(${ids})`),
    prisma.variant.findMany({
      where: { productId: { in: ids }, active: true },
      orderBy: { createdAt: "asc" },
      select: VARIANT_SELECT,
    }),
  ]);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    sku: row.sku,
    images: row.image ? [row.image] : [],
    price: row.price,
    salePrice: row.salePrice,
    stock: Number(row.stock),
    trackStock: row.trackStock,
    stockStatus: row.stockStatus,
    featured: row.featured,
    sourceUrl: row.meta ? JSON.stringify({ zvmCatalog: row.meta }) : null,
    shortDescription: row.shortDescription,
    bundleEnabled: row.bundleEnabled,
    bundleDiscountPercent: row.bundleDiscountPercent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    category: row.categoryId
      ? { id: row.categoryId, name: row.categoryName, slug: row.categorySlug, description: null, imageUrl: null }
      : null,
    variants: variants.filter((v) => v.productId === row.id),
    reviewStats: {
      count: Number(row.reviewCount || 0),
      average: row.ratingAvg == null ? undefined : Number(row.ratingAvg),
    },
  }));
}

/** `?ids=a,b,c` from the storefront cart/wishlist: at most 50 product ids, nothing but id characters. */
export function parseIds(value: unknown) {
  const ids = String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id));
  return [...new Set(ids)].slice(0, 50);
}
