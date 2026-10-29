import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import type { SeoIndex } from "../storefront/lib/backend";
import { childSitemaps, exactCategoryId, sitemapData, sitemapResponse, sitemapXml, staticPages } from "../storefront/lib/sitemaps";

const WWW = "https://www.zelvomart.com";
const R2 = "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products";

const index = (over: Partial<SeoIndex> = {}): SeoIndex => ({
  products: [
    {
      slug: "steel-tumbler",
      title: "Steel Tumbler & Lid",
      updatedAt: "2026-10-25T08:00:00.000Z",
      category: "home-living",
      images: [`${R2}/a.webp`, `${R2}/b.webp?w=1&h=2`],
    },
    { slug: "led-lamp", title: "LED Lamp", updatedAt: "2026-10-27T08:00:00.000Z", category: "tech-gadgets", images: [] },
  ],
  categories: [
    { slug: "home-living", name: "Home & Living", updatedAt: "2026-10-22T08:00:00.000Z", imageUrl: null, publishedProducts: 1 },
    { slug: "tech-gadgets", name: "Tech", updatedAt: "2026-10-23T08:00:00.000Z", imageUrl: null, publishedProducts: 1 },
    { slug: "kids-toys", name: "Kids", updatedAt: "2026-10-28T08:00:00.000Z", imageUrl: null, publishedProducts: 0 },
  ],
  ...over,
});

/** xmllint exits non-zero on any well-formedness error. */
function assertWellFormed(xml: string) {
  execFileSync("xmllint", ["--noout", "-"], { input: xml, stdio: ["pipe", "pipe", "pipe"] });
}

const locs = (xml: string, tag = "loc") => [...xml.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, "g"))].map((m) => m[1]);

test("every sitemap file is well-formed XML with the CSS stylesheet and lastmod only", () => {
  const data = sitemapData(index());
  for (const file of ["sitemap_index.xml", "sitemap.xml", ...childSitemaps(data).map((c) => c.file)]) {
    const xml = sitemapXml(file, data);
    assert.ok(xml, file);
    assertWellFormed(xml);
    assert.match(xml, /<\?xml-stylesheet type="text\/css" href="\/sitemap\.css"\?>/);
    assert.doesNotMatch(xml, /xsl|<priority>|<changefreq>|<script/i);
  }
});

test("index lists only non-empty children; /sitemap.xml serves the same index", () => {
  const data = sitemapData(index());
  const xml = sitemapXml("sitemap_index.xml", data)!;
  assert.deepEqual(locs(xml), [`${WWW}/page-sitemap.xml`, `${WWW}/product_cat-sitemap.xml`, `${WWW}/product-sitemap.xml`]);
  assert.equal(sitemapXml("sitemap.xml", data), xml);
  // Index lastmod = newest lastmod inside each child.
  assert.deepEqual(locs(xml, "lastmod"), ["2026-10-21T00:00:00.000Z", "2026-10-28T08:00:00.000Z", "2026-10-27T08:00:00.000Z"]);

  const empty = sitemapData(index({ products: [], categories: [] }));
  assert.deepEqual(locs(sitemapXml("sitemap_index.xml", empty)!), [`${WWW}/page-sitemap.xml`]);
  assert.equal(sitemapXml("product-sitemap.xml", empty), null);
});

test("pages: the 13 static pages with a trailing slash", () => {
  const urls = locs(sitemapXml("page-sitemap.xml", sitemapData(index()))!);
  assert.equal(urls.length, 13);
  assert.equal(staticPages.length, 13);
  assert.equal(urls[0], `${WWW}/`);
  assert.ok(urls.every((u) => u.startsWith(`${WWW}/`) && u.endsWith("/")));
  assert.ok(urls.includes(`${WWW}/refund_returns/`));
});

test("categories: every category the admin has, empty ones too, design URLs", () => {
  const data = sitemapData(index());
  const urls = locs(sitemapXml("product_cat-sitemap.xml", data)!);
  assert.deepEqual(urls, [`${WWW}/product-category/home-living/`, `${WWW}/product-category/tech-gadgets/`, `${WWW}/product-category/kids-toys/`]);
  assert.deepEqual(
    data.categories.map((c) => [c.id, c.productCount]),
    [
      ["home-living", 1],
      ["tech", 1],
      ["kids", 0],
    ],
  );
  // A category deleted in the admin has no row: not listed.
  const noKids = sitemapData(index({ categories: index().categories.filter((c) => c.slug !== "kids-toys") }));
  assert.ok(!noKids.categories.some((c) => c.id === "kids"));
});

test("an unknown or missing category is never filed under Home & Living", () => {
  assert.equal(exactCategoryId(undefined), null);
  assert.equal(exactCategoryId("garden-tools"), null);
  assert.equal(exactCategoryId("beauty-personal-care"), "beauty");
  const base = index();
  const data = sitemapData({
    ...base,
    products: [...base.products, { slug: "mystery", title: "Mystery", updatedAt: "2026-10-26T08:00:00.000Z", category: "garden-tools", images: [] }],
  });
  assert.equal(data.products.find((p) => p.loc.endsWith("/mystery/"))?.categoryId, null);
  assert.equal(data.categories.find((c) => c.id === "home-living")?.productCount, 1);
});

test("products: absolute URLs, absolute image URLs, escaped values", () => {
  const xml = sitemapXml("product-sitemap.xml", sitemapData(index()))!;
  assert.match(xml, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  assert.deepEqual(locs(xml), [`${WWW}/product/steel-tumbler/`, `${WWW}/product/led-lamp/`]);
  const images = locs(xml, "image:loc");
  assert.deepEqual(images, [`${R2}/a.webp`, `${R2}/b.webp?w=1&amp;h=2`]);
  assert.ok(images.every((u) => u.startsWith(R2)));
  assert.doesNotMatch(xml.replace(/&(amp|lt|gt|quot|apos);/g, ""), /&/);
});

test("more than 1,000 products split into product-sitemap2.xml, 3 …", () => {
  const products = Array.from({ length: 2500 }, (_, i) => ({
    slug: `p-${i}`,
    title: `P ${i}`,
    updatedAt: "2026-10-25T08:00:00.000Z",
    category: "home-living",
    images: [],
  }));
  const children = childSitemaps(sitemapData(index({ products })));
  assert.deepEqual(
    children.map((c) => [c.file, c.urls.length]),
    [
      ["page-sitemap.xml", 13],
      ["product_cat-sitemap.xml", 3],
      ["product-sitemap.xml", 1000],
      ["product-sitemap2.xml", 1000],
      ["product-sitemap3.xml", 500],
    ],
  );
});

test("backend down: 503 with Retry-After, not cached, never an empty sitemap", async () => {
  let failureHook = 0;
  const res = await sitemapResponse(
    "product-sitemap.xml",
    async () => {
      throw new Error("API_502");
    },
    async () => {
      failureHook++;
    },
  );
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("retry-after"), "600");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(failureHook, 1);
  assert.doesNotMatch(await res.text(), /urlset/);
});

test("the old backend answer (slug + updatedAt only) is a failure: 503, not a sitemap", async () => {
  const old = {
    products: [{ slug: "steel-tumbler", updatedAt: "2026-10-25T08:00:00.000Z" }],
    categories: [{ slug: "home-living", updatedAt: "2026-10-22T08:00:00.000Z" }],
  } as unknown as SeoIndex;
  for (const file of ["sitemap_index.xml", "product-sitemap.xml", "product_cat-sitemap.xml"]) {
    const res = await sitemapResponse(file, async () => old);
    assert.equal(res.status, 503, file);
    assert.equal(res.headers.get("retry-after"), "600");
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
  assert.throws(() => sitemapData(old), /SEO_INDEX_SHAPE/);
});

test("a good response carries the XML content type and noindex; unknown files are 404", async () => {
  const ok = await sitemapResponse("sitemap_index.xml", async () => index());
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.equal(ok.headers.get("x-robots-tag"), "noindex");
  const missing = await sitemapResponse("product-sitemap7.xml", async () => index());
  assert.equal(missing.status, 404);
});
