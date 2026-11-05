// Card reads (view=card) give the same product JSON as the full list, the new filters work, and the sitemap
// query reads only what it prints. In-process PostgreSQL (PGlite); nothing leaves this machine.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
const require = createRequire(import.meta.url);

const db = await PGlite.create();
const schema = execFileSync(
  process.execPath,
  [
    require.resolve("prisma/build/index.js"),
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url)),
    "--script",
  ],
  { encoding: "utf8" },
);
await db.exec(schema);
const socket = new PGLiteSocketServer({ db, port: 55461, host: "127.0.0.1" });
await socket.start();
Object.assign(process.env, {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55461/postgres",
  DIRECT_URL: "postgres://postgres:postgres@127.0.0.1:55461/postgres",
  DATABASE_SSL: "false",
  DATABASE_POOL_MAX: "1",
  JWT_SECRET: "isolated-local-catalog-test-secret-only",
  JOB_MODE: "cron",
  VERCEL: "1",
  REVALIDATION_SECRET: "",
});
const { prisma } = await import("../src/lib/db");
const { app } = await import("../src/server");

const home = await prisma.category.create({ data: { name: "Home & Living", slug: "home-living" } });
const beauty = await prisma.category.create({ data: { name: "Beauty", slug: "beauty-personal-care" } });
const meta = (extra: Record<string, unknown>) =>
  JSON.stringify({
    zvmCatalog: { imageMeta: { alt: "Main photo", title: "Photo" }, highlights: ["x".repeat(500)], ...extra },
  });
const bottle = await prisma.product.create({
  data: {
    title: "Steel Water Bottle",
    slug: "steel-bottle",
    sku: "SB-1",
    price: 1500,
    salePrice: 1200,
    status: "PUBLISHED",
    categoryId: home.id,
    images: ["https://cdn.example/a.webp", "https://cdn.example/b.webp"],
    shortDescription: "<p>Keeps drinks cold.</p>",
    descriptionHtml: "<p>" + "Long text. ".repeat(200) + "</p>",
    sourceUrl: meta({ freeShipping: true, tags: ["gym", "customer-favourite", "15-off"], badges: ["Gift pick"] }),
    createdAt: new Date(Date.now() - 90 * 86400000),
  },
});
await prisma.variant.create({
  data: { productId: bottle.id, sku: "SB-1-B", name: "Blue", attributes: { colour: "Blue" } },
});
await prisma.review.create({ data: { productId: bottle.id, name: "A", rating: 4, body: "Good", status: "APPROVED" } });
await prisma.review.create({ data: { productId: bottle.id, name: "B", rating: 5, body: "Great", status: "APPROVED" } });
await prisma.review.create({ data: { productId: bottle.id, name: "C", rating: 1, body: "Hidden", status: "PENDING" } });
await prisma.product.create({
  data: {
    title: "Rose Lip Tint",
    slug: "lip-tint",
    sku: "LT-1",
    price: 900,
    status: "PUBLISHED",
    categoryId: beauty.id,
    images: [],
    sourceUrl: meta({ robotsIndex: "noindex" }),
    featured: true,
  },
});
await prisma.product.create({
  data: {
    title: "Old Lamp",
    slug: "old-lamp",
    sku: "OL-1",
    price: 3000,
    status: "PUBLISHED",
    sourceUrl: "https://old.example/lamp",
  },
});

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const get = async (path: string) => (await fetch(base + path)).json() as Promise<any>;

const full = await get("/api/products?limit=50&sort=newest");
const card = await get("/api/products?limit=50&sort=newest&view=card");
assert.equal(full.items.length, 3);
const strip = (items: any[]) =>
  items.map((p) => ({ ...p, categories: p.categories.map(({ description, image, ...c }: any) => c) }));
assert.deepEqual(strip(card.items), strip(full.items));
const b = card.items.find((p: any) => p.slug === "steel-bottle");
assert.equal(b.reviewCount, 2);
assert.equal(b.averageRating, 4.5);
assert.equal(b.freeShipping, true);
assert.deepEqual(b.badges.slice(0, 2), ["Gift pick", "Customer favourite"]);
console.log("PASS: card read = full list JSON (3 products, reviews, variants, meta, plain-URL meta)");

assert.deepEqual(
  (await get(`/api/products?view=card&ids=${bottle.id},missing`)).items.map((p: any) => p.slug),
  ["steel-bottle"],
);
assert.ok(!(await get(`/api/products?view=card&exclude=${bottle.id}`)).items.some((p: any) => p.id === bottle.id));
assert.equal((await get("/api/products?view=card&tag=bestsellers")).total, 1, "featured counts as bestseller");
assert.equal((await get("/api/products?view=card&tag=new")).total, 3, "the 24 newest count as new");
assert.equal((await get("/api/products?view=card&tag=discount")).total, 1);
assert.equal((await get("/api/products?view=card&sort=name")).items[0].slug, "old-lamp");
assert.equal((await get("/api/products?view=card&sort=discount")).items[0].slug, "steel-bottle");
assert.deepEqual(
  (await get("/api/products?view=card&search=gym%20cold&sort=relevance")).items.map((p: any) => p.slug),
  ["steel-bottle"],
  "every word must match: keyword + short description",
);
assert.equal((await get("/api/products?view=card&search=100%25")).total, 0, "% is a literal, not a wildcard");
console.log("PASS: ids, exclude, collection tags, name/discount sort, multi-word search");

const seo = await get("/api/seo/sitemap?v=2");
assert.deepEqual(seo.products.map((p: any) => p.slug).sort(), ["old-lamp", "steel-bottle"], "noindex left out");
assert.equal(seo.products.find((p: any) => p.slug === "steel-bottle").images.length, 2);
console.log("PASS: sitemap query (noindex flag, images) without the full meta JSON");

// Group 2: the listing rank and COUNT are kept for 60 s per filter, and an admin save clears them at once.
const { invalidateFrontendCache } = await import("../src/lib/cache-invalidation");
const beautyList = "/api/products?view=card&category=beauty-personal-care";
const countBefore = (await get(beautyList)).total;
await prisma.product.create({
  data: {
    title: "Cache Probe",
    slug: "cache-probe",
    sku: "CP-1",
    price: 900,
    status: "PUBLISHED",
    categoryId: beauty.id,
    images: [],
  },
});
assert.equal((await get(beautyList)).total, countBefore, "repeat read within 60 s comes from the cache");
await invalidateFrontendCache(["products", "product:cache-probe"]);
const afterSave = await get(beautyList);
assert.equal(afterSave.total, countBefore + 1, "a product save clears the cached count");
assert.ok(
  afterSave.items.some((p: any) => p.slug === "cache-probe"),
  "and the cached ranking",
);
console.log("PASS: cached listing rank/count, cleared by a product save");

const { passwordStamp, signAdminToken } = await import("../src/lib/auth");
const owner = await prisma.user.create({
  data: { email: "catalog-test@example.invalid", name: "Catalog test", passwordHash: "catalog-test", role: "OWNER" },
});
const token = signAdminToken(owner, passwordStamp(owner.passwordHash));
const editPermalink = (slug: string, redirectOldPermalink: boolean) =>
  fetch(`${base}/api/admin/products/${bottle.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ slug, redirectOldPermalink }),
  });
const redirectAt = (sourcePath: string) => prisma.redirect.findUnique({ where: { sourcePath } });

const withoutRedirect = await editPermalink("steel-bottle-new", false);
assert.equal(withoutRedirect.status, 200, await withoutRedirect.text());
assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: bottle.id } })).slug, "steel-bottle-new");
assert.equal(await redirectAt("/product/steel-bottle/"), null, "an unchecked box leaves no 301");

const withRedirect = await editPermalink("steel-bottle-final", true);
assert.equal(withRedirect.status, 200, await withRedirect.text());
const redirect = await redirectAt("/product/steel-bottle-new/");
assert.deepEqual(
  [redirect?.destination, redirect?.permanent],
  ["/product/steel-bottle-final/", true],
  "a checked box creates a permanent redirect to the saved permalink",
);
assert.ok(
  (await get("/api/redirects/map")).some(
    ([source, destination, permanent]: unknown[]) =>
      source === "/product/steel-bottle-new/" && destination === "/product/steel-bottle-final/" && permanent === 1,
  ),
  "the storefront redirect map serves the new 301",
);

const duplicate = await editPermalink("old-lamp", true);
assert.equal(duplicate.status, 409);
assert.equal(await redirectAt("/product/steel-bottle-final/"), null, "failed slug updates create no redirect");

const renamedAgain = await editPermalink("steel-bottle-latest", false);
assert.equal(renamedAgain.status, 200, await renamedAgain.text());
assert.equal(await redirectAt("/product/steel-bottle-final/"), null);
assert.equal((await redirectAt("/product/steel-bottle-new/"))?.destination, "/product/steel-bottle-latest/");
console.log("PASS: published product permalink, optional 301, duplicate rejection, and existing redirects");

server.close();
await prisma.$disconnect();
await socket.stop();
await db.close();
console.log("All catalog tests passed.");
process.exit(0);
