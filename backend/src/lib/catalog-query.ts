import { Prisma } from "../generated/prisma/client";

type Options = {
  search: string;
  category: string;
  featured: boolean;
  minPrice?: number;
  maxPrice?: number;
  availability: string;
  tag: string;
  sort: string;
  /** Only these products (cart, wishlist). */
  ids?: string[];
  /** Leave this product out (related products on its own page). */
  exclude?: string;
};

/** Days a product counts as "new" (storefront product-map.ts NEW_FOR_DAYS); the 24 newest always count too. */
export const NEW_FOR_DAYS = 30;
export const NEWEST_COUNT = 24;

/** Search words: at most 6, each at least 1 character after trimming. */
export function searchTerms(search: string) {
  return search.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 6);
}

/** Database ordering uses the same effective selling price that checkout displays. */
export function catalogQuery(options: Options) {
  const price = Prisma.sql`CASE WHEN p."salePrice">0 AND p."salePrice"<p.price THEN p."salePrice" ELSE p.price END`;
  const filters = [Prisma.sql`p.status='PUBLISHED'`];
  if (options.featured) filters.push(Prisma.sql`p.featured=true`);
  if (options.category) filters.push(Prisma.sql`c.slug=${options.category}`);
  if (options.ids) filters.push(Prisma.sql`p.id = ANY(${options.ids})`);
  if (options.exclude) filters.push(Prisma.sql`p.id<>${options.exclude}`);
  // Every word must appear in the name, SKU, category, short description or the product's keywords
  // (the same fields the storefront search used to scan in the browser).
  const terms = searchTerms(options.search);
  const keywords = Prisma.sql`(CASE WHEN left(btrim(p."sourceUrl"),1)='{' AND pg_input_is_valid(p."sourceUrl",'jsonb')
    THEN p."sourceUrl"::jsonb #>> '{zvmCatalog,tags}' END)`;
  for (const term of terms) {
    const like = "%" + term.replace(/[\\%_]/g, (ch) => "\\" + ch) + "%";
    filters.push(
      Prisma.sql`(p.title ILIKE ${like} OR p.sku ILIKE ${like} OR c.name ILIKE ${like} OR p."shortDescription" ILIKE ${like} OR ${keywords} ILIKE ${like})`,
    );
  }
  if (options.minPrice != null) filters.push(Prisma.sql`${price}>=${options.minPrice}`);
  if (options.maxPrice != null) filters.push(Prisma.sql`${price}<=${options.maxPrice}`);
  if (options.availability === "instock")
    filters.push(Prisma.sql`(
  (NOT EXISTS(SELECT 1 FROM "Variant" v WHERE v."productId"=p.id AND v.active=true)
    AND ((p."trackStock"=true AND p.stock>0) OR (p."trackStock"=false AND p."stockStatus"='instock')))
  OR EXISTS(SELECT 1 FROM "Variant" v WHERE v."productId"=p.id AND v.active=true
    AND ((v."trackStock"=true AND v.stock>0) OR (v."trackStock"=false AND v."stockStatus"='instock'))))`);
  if (options.tag === "discount") filters.push(Prisma.sql`p."salePrice">0 AND p."salePrice"<p.price`);
  else if (options.tag === "best-selling") filters.push(Prisma.sql`COALESCE(s.orders,0)>0`);
  // Storefront "Bestsellers": ordered at least once, or marked featured in the admin.
  else if (options.tag === "bestsellers") filters.push(Prisma.sql`(COALESCE(s.orders,0)>0 OR p.featured=true)`);
  // Storefront "New Arrivals": added in the last 30 days, or among the 24 newest.
  else if (options.tag === "new")
    filters.push(Prisma.sql`(p."createdAt">=NOW()-make_interval(days=>${NEW_FOR_DAYS}) OR p.id IN
      (SELECT n.id FROM "Product" n WHERE n.status='PUBLISHED' ORDER BY n."createdAt" DESC LIMIT ${NEWEST_COUNT}))`);
  else if (options.tag) filters.push(Prisma.sql`p."sourceUrl" LIKE ${'%"' + options.tag + '"%'}`);
  const from = Prisma.sql`FROM "Product" p LEFT JOIN "Category" c ON c.id=p."categoryId"
 LEFT JOIN (SELECT i."productId",COUNT(DISTINCT i."orderId") AS orders FROM "OrderItem" i
   JOIN "Order" o ON o.id=i."orderId" WHERE o.test=false AND o."staffCreated"=false
   AND o."blocklistedAtOrder"=false AND o.status NOT IN ('CANCELLED','RETURNED') GROUP BY i."productId") s ON s."productId"=p.id
 WHERE ${Prisma.join(filters, " AND ")}`;
  const newest = Prisma.sql`p."createdAt" DESC,p.id ASC`;
  // Relevance: a word in the name counts 3, anywhere else 1 (the old browser search's scoring).
  const relevance = terms.length
    ? Prisma.join(
        terms.map((term) => {
          const like = "%" + term.replace(/[\\%_]/g, (ch) => "\\" + ch) + "%";
          return Prisma.sql`(CASE WHEN p.title ILIKE ${like} THEN 3 ELSE 0 END)`;
        }),
        " + ",
      )
    : null;
  const order =
    options.sort === "price-asc"
      ? Prisma.sql`${price} ASC,p.id ASC`
      : options.sort === "price-desc"
        ? Prisma.sql`${price} DESC,p.id ASC`
        : options.sort === "newest"
          ? newest
          : options.sort === "name"
            ? Prisma.sql`lower(p.title) ASC,p.id ASC`
            : options.sort === "discount"
              ? Prisma.sql`(CASE WHEN p."salePrice">0 AND p."salePrice"<p.price THEN (p.price-p."salePrice")/p.price ELSE 0 END) DESC,${newest}`
              : options.sort === "relevance" && relevance
                ? Prisma.sql`(${relevance}) DESC,${newest}`
                : Prisma.sql`COALESCE(s.orders,0) DESC,${newest}`;
  return { from, order };
}
