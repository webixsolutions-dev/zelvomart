import assert from "node:assert/strict";
import test from "node:test";

const OLD = "https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev";
process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://media.zelvomart.com";

test("product data from the backend reaches the page on the media domain (images, variants, reviews, HTML)", async () => {
  const { toDesignProduct } = await import("../storefront/lib/product-map");
  const product = toDesignProduct({
    id: "p1",
    slug: "bottle",
    sku: "B1",
    name: "Bottle",
    price: 1000,
    regularPrice: 1000,
    image: `${OLD}/products/main.webp`,
    images: [{ src: `${OLD}/products/main.webp` }, { src: `${OLD}/products/side.webp` }, { src: "/brand/local.png" }],
    descriptionHtml: `<p>Text <img src="${OLD}/products/inline.webp"></p>`,
    reviews: [{ id: "r1", name: "A", rating: 5, body: "Good", createdAt: "2026-01-01", verified: true, media: [{ type: "image", url: `${OLD}/reviews/r1.webp` }] }],
  } as never);
  const json = JSON.stringify(product);
  assert.ok(!json.includes(OLD), "no old-host URL left");
  assert.equal(product.image, "https://media.zelvomart.com/products/main.webp");
  assert.deepEqual((product.gallery || []).map((g) => g.src), [
    "https://media.zelvomart.com/products/main.webp",
    "https://media.zelvomart.com/products/side.webp",
    "/brand/local.png",
  ]);
  assert.ok(String(product.descriptionHtml).includes('src="https://media.zelvomart.com/products/inline.webp"'));
});

test("home videos and posters default to the media domain", async () => {
  delete process.env.NEXT_PUBLIC_HOME_VIDEO_BASE;
  const { homeShorts, unboxingVideo } = await import("../storefront/lib/home-videos");
  for (const v of [...homeShorts, unboxingVideo]) {
    assert.ok(v.src.startsWith("https://media.zelvomart.com/videos/"), v.src);
    assert.ok(v.poster.startsWith("https://media.zelvomart.com/videos/"), v.poster);
  }
});
