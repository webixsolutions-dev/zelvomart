import assert from "node:assert/strict";
import test from "node:test";
import { LEGACY_MEDIA_HOST, mediaBase, mediaHtml, mediaUrl } from "@zelvomart/media";

const OLD = `${LEGACY_MEDIA_HOST}/products/abc.webp`;

test("media base: NEXT_PUBLIC_MEDIA_BASE_URL, then S3_PUBLIC_BASE_URL, then the old host", () => {
  assert.equal(
    mediaBase({ NEXT_PUBLIC_MEDIA_BASE_URL: "https://media.zelvomart.com/" }),
    "https://media.zelvomart.com",
  );
  assert.equal(mediaBase({ S3_PUBLIC_BASE_URL: "https://media.zelvomart.com" }), "https://media.zelvomart.com");
  assert.equal(
    mediaBase({ NEXT_PUBLIC_MEDIA_BASE_URL: "https://a.example", S3_PUBLIC_BASE_URL: "https://b.example" }),
    "https://a.example",
  );
  assert.equal(mediaBase({}), LEGACY_MEDIA_HOST);
  assert.equal(mediaBase({ NEXT_PUBLIC_MEDIA_BASE_URL: "not a url" }), LEGACY_MEDIA_HOST, "bad values are ignored");
  assert.equal(
    mediaBase({ NEXT_PUBLIC_MEDIA_BASE_URL: "http://media.zelvomart.com" }),
    LEGACY_MEDIA_HOST,
    "https only",
  );
});

test("only old-host URLs are rewritten, keeping the key", () => {
  assert.equal(mediaUrl(OLD, "https://media.zelvomart.com"), "https://media.zelvomart.com/products/abc.webp");
  assert.equal(mediaUrl("/brand/logo.png", "https://media.zelvomart.com"), "/brand/logo.png");
  assert.equal(mediaUrl("https://cdn.example/x.webp", "https://media.zelvomart.com"), "https://cdn.example/x.webp");
  assert.equal(mediaUrl(OLD, LEGACY_MEDIA_HOST), OLD, "no media base: unchanged");
  assert.equal(
    mediaUrl(`${LEGACY_MEDIA_HOST}.evil.com/x`, "https://media.zelvomart.com"),
    `${LEGACY_MEDIA_HOST}.evil.com/x`,
  );
  assert.equal(mediaUrl(undefined, "https://media.zelvomart.com"), undefined);
});

test("every old-host URL inside description HTML is rewritten", () => {
  const html = `<p><img src="${OLD}" srcset="${OLD} 1x, ${LEGACY_MEDIA_HOST}/products/abc@2x.webp 2x"><a href="https://x.example">x</a></p>`;
  const out = mediaHtml(html, "https://media.zelvomart.com");
  assert.ok(!out.includes(LEGACY_MEDIA_HOST));
  assert.equal(out.split("https://media.zelvomart.com/products/").length - 1, 3);
  assert.ok(out.includes('href="https://x.example"'));
});

test("the backend reads its media base from the environment at call time (catalog feeds)", async () => {
  const { publicMediaUrl } = await import("./media");
  assert.equal(publicMediaUrl(OLD), OLD, "nothing set: unchanged");
  process.env.S3_PUBLIC_BASE_URL = "https://media.zelvomart.com";
  try {
    assert.equal(publicMediaUrl(OLD), "https://media.zelvomart.com/products/abc.webp");
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://media2.example";
    assert.equal(publicMediaUrl(OLD), "https://media2.example/products/abc.webp", "NEXT_PUBLIC_MEDIA_BASE_URL wins");
  } finally {
    delete process.env.S3_PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  }
});
