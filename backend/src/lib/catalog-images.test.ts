import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

process.env.DATABASE_URL ||= "postgresql://test@localhost:5432/test";

test("uploads become WebP, at most 1600 px wide, without metadata", async () => {
  const { toSiteWebp } = await import("./catalog-images");
  const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c0392b" } })
    .withMetadata({ exif: { IFD0: { Copyright: "camera" } } })
    .jpeg()
    .toBuffer();
  const out = await toSiteWebp(big, "image/jpeg");
  const meta = await sharp(out.bytes).metadata();
  assert.equal(out.contentType, "image/webp");
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 1067);
  assert.equal(meta.exif, undefined);

  const png = await sharp({ create: { width: 400, height: 300, channels: 4, background: "#00000000" } })
    .png()
    .toBuffer();
  const small = await toSiteWebp(png, "image/png");
  assert.equal((await sharp(small.bytes).metadata()).width, 400); // never enlarged
  assert.equal((await sharp(small.bytes).metadata()).hasAlpha, true);
});

test("a WebP that already fits is kept byte for byte; GIFs and videos pass through", async () => {
  const { toSiteWebp } = await import("./catalog-images");
  const webp = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#2980b9" } })
    .webp({ quality: 80 })
    .toBuffer();
  const kept = await toSiteWebp(webp, "image/webp");
  assert.equal(kept.converted, false);
  assert.ok(kept.bytes.equals(webp));
  const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } })
    .gif()
    .toBuffer();
  assert.deepEqual(await toSiteWebp(gif, "image/gif"), {
    bytes: gif,
    contentType: "image/gif",
    ext: "gif",
    converted: false,
  });
  const video = Buffer.from("not an image");
  assert.equal((await toSiteWebp(video, "video/mp4")).bytes, video);
});

test("feeds use the JPG copy, never the site's WebP", async () => {
  const { feedImage, imageCopyKey } = await import("./catalog-images");
  const webp = "https://cdn.example/products/a.webp";
  const copies = { [imageCopyKey(webp)]: "https://cdn.example/catalog-images/a.jpg" };
  assert.equal(feedImage(webp, "meta", copies), "https://cdn.example/catalog-images/a.jpg");
  assert.equal(feedImage(webp, "google", copies), "https://cdn.example/catalog-images/a.jpg");
  assert.equal(feedImage(webp, "meta", {}), undefined);
  assert.equal(feedImage("https://cdn.example/x.jpg", "tiktok", {}), "https://cdn.example/x.jpg");
});
