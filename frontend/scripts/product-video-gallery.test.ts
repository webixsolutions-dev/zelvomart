import test from "node:test";
import assert from "node:assert/strict";
import { toDesignProduct } from "../storefront/lib/product-map";
import { parseVideoUrl } from "../lib/product-video";
import type { Product } from "../types/product";

test("the storefront keeps the admin's video and thumbnail, with a validated click-to-play URL", () => {
  const product = toDesignProduct({ id: "video-fixture", name: "Video fixture", slug: "video-fixture", sku: "VIDEO", price: 1000, stockStatus: "instock", images: [], categories: [], videoUrl: "https://youtu.be/M7lc1UVf-VE", videoThumbnail: "https://media.zelvomart.com/example.webp" } as unknown as Product);
  assert.equal(product.videoUrl, "https://youtu.be/M7lc1UVf-VE");
  assert.equal(product.videoThumbnail, "https://media.zelvomart.com/example.webp");
  assert.equal(parseVideoUrl(product.videoUrl)?.embedUrl, "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1&rel=0");
  assert.equal(parseVideoUrl("https://not-youtube.example/embed/unsafe"), null);
});
