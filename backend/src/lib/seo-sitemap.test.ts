import assert from "node:assert/strict";
import test from "node:test";
import { SITEMAP_IMAGE_LIMIT, absoluteImageUrl, seoSitemapIndex, type SitemapProductRow } from "./seo-sitemap";

const origin = "https://www.zelvomart.com";
const r2 = (n: number) => `https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev/products/${n}.webp`;
const at = new Date("2026-10-20T10:00:00.000Z");
const product = (over: Partial<SitemapProductRow>): SitemapProductRow => ({
  slug: "lamp",
  title: "Lamp",
  status: "PUBLISHED",
  updatedAt: at,
  sourceUrl: null,
  images: [],
  category: { slug: "home-decor" },
  ...over,
});

test("seo sitemap lists published, indexable products with absolute images, main image first", () => {
  const index = seoSitemapIndex(
    [
      product({
        slug: "lamp",
        images: [r2(1), "/uploads/products/2.webp", r2(1), "http://insecure.test/3.jpg", "", 42],
      }),
      product({ slug: "draft", status: "DRAFT" }),
      product({ slug: "hidden", sourceUrl: JSON.stringify({ zvmCatalog: { robotsIndex: "noindex" } }) }),
      product({ slug: "shown", sourceUrl: JSON.stringify({ zvmCatalog: { robotsIndex: "index" } }), category: null }),
    ],
    [{ slug: "home-decor", name: "Home & Decor", updatedAt: at, imageUrl: "/uploads/c.webp", _count: { products: 2 } }],
    origin,
  );
  assert.deepEqual(
    index.products.map((p) => p.slug),
    ["lamp", "shown"],
  );
  assert.deepEqual(index.products[0], {
    slug: "lamp",
    title: "Lamp",
    updatedAt: "2026-10-20T10:00:00.000Z",
    category: "home-decor",
    images: [r2(1), "https://www.zelvomart.com/uploads/products/2.webp"],
  });
  assert.equal(index.products[1].category, null);
  assert.deepEqual(index.categories, [
    {
      slug: "home-decor",
      name: "Home & Decor",
      updatedAt: "2026-10-20T10:00:00.000Z",
      imageUrl: "https://www.zelvomart.com/uploads/c.webp",
      publishedProducts: 2,
    },
  ]);
});

test("seo sitemap keeps at most the image limit per product", () => {
  const images = Array.from({ length: 14 }, (_, i) => r2(i));
  const [p] = seoSitemapIndex([product({ images })], [], origin).products;
  assert.equal(p.images.length, SITEMAP_IMAGE_LIMIT);
  assert.equal(p.images[0], r2(0));
});

test("only absolute https image URLs are kept", () => {
  assert.equal(absoluteImageUrl("//cdn.test/a.jpg", origin), null);
  assert.equal(absoluteImageUrl("javascript:alert(1)", origin), null);
  assert.equal(absoluteImageUrl(null, origin), null);
  assert.equal(absoluteImageUrl(" https://cdn.test/a b.jpg ", origin), "https://cdn.test/a%20b.jpg");
});
