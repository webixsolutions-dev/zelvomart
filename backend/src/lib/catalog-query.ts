import {Prisma} from '../generated/prisma/client';

type Options={search:string;category:string;featured:boolean;minPrice?:number;maxPrice?:number;availability:string;tag:string;sort:string};
/** Database ordering uses the same effective selling price that checkout displays. */
export function catalogQuery(options:Options){
 const price=Prisma.sql`CASE WHEN p."salePrice">0 AND p."salePrice"<p.price THEN p."salePrice" ELSE p.price END`;
 const filters=[Prisma.sql`p.status='PUBLISHED'`];
 if(options.featured)filters.push(Prisma.sql`p.featured=true`);
 if(options.category)filters.push(Prisma.sql`c.slug=${options.category}`);
 if(options.search){const term='%'+options.search+'%';filters.push(Prisma.sql`(p.title ILIKE ${term} OR p.sku ILIKE ${term} OR c.name ILIKE ${term})`);}
 if(options.minPrice!=null)filters.push(Prisma.sql`${price}>=${options.minPrice}`);
 if(options.maxPrice!=null)filters.push(Prisma.sql`${price}<=${options.maxPrice}`);
 if(options.availability==='instock')filters.push(Prisma.sql`(
  (NOT EXISTS(SELECT 1 FROM "Variant" v WHERE v."productId"=p.id AND v.active=true)
    AND ((p."trackStock"=true AND p.stock>0) OR (p."trackStock"=false AND p."stockStatus"='instock')))
  OR EXISTS(SELECT 1 FROM "Variant" v WHERE v."productId"=p.id AND v.active=true
    AND ((v."trackStock"=true AND v.stock>0) OR (v."trackStock"=false AND v."stockStatus"='instock'))))`);
 if(options.tag==='discount')filters.push(Prisma.sql`p."salePrice">0 AND p."salePrice"<p.price`);
 else if(options.tag==='best-selling')filters.push(Prisma.sql`COALESCE(s.orders,0)>0`);
 else if(options.tag)filters.push(Prisma.sql`p."sourceUrl" LIKE ${'%"'+options.tag+'"%'}`);
 const from=Prisma.sql`FROM "Product" p LEFT JOIN "Category" c ON c.id=p."categoryId"
 LEFT JOIN (SELECT i."productId",COUNT(DISTINCT i."orderId") AS orders FROM "OrderItem" i
   JOIN "Order" o ON o.id=i."orderId" WHERE o.test=false AND o."staffCreated"=false
   AND o."blocklistedAtOrder"=false AND o.status NOT IN ('CANCELLED','RETURNED') GROUP BY i."productId") s ON s."productId"=p.id
 WHERE ${Prisma.join(filters,' AND ')}`;
 const order=options.sort==='price-asc'?Prisma.sql`${price} ASC,p.id ASC`:options.sort==='price-desc'?Prisma.sql`${price} DESC,p.id ASC`:options.sort==='newest'?Prisma.sql`p."createdAt" DESC,p.id ASC`:Prisma.sql`COALESCE(s.orders,0) DESC,p."createdAt" DESC,p.id ASC`;
 return {from,order};
}
