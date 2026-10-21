import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import sharp from "sharp";
import {
  calendarDate,
  csv,
  REVIEW_COLUMNS,
  readReviewCsv,
  matchProduct,
  validateReview,
  rowMedia,
  readMediaZip,
  inspectMedia,
} from "./review-import";
const products = [
  { id: "a", title: "Travel Bag", sku: "BAG-1" },
  { id: "b", title: "Travel Bag Large", sku: "BAG-2" },
  { id: "c", title: "USB Cable", sku: "USB-1" },
];
const base = {
  reviewRef: "TEST-001",
  productTitle: "Travel Bag",
  productSku: "BAG-1",
  reviewerName: "Test reviewer",
  reviewerEmail: "qa@example.invalid",
  rating: "5",
  reviewText:
    'TEST ONLY, not customer feedback. Commas, quotes "and"\nnewlines.',
  reviewDate: "2025-02-14",
  mediaFiles: "",
  avatarFile: "",
};
test("one quoted UTF-8 CSV supports multiple products and multiple reviews each", () => {
  const records = [
    base,
    { ...base, reviewRef: "TEST-002", reviewerName: "آزمائش" },
    {
      ...base,
      reviewRef: "TEST-003",
      productTitle: "USB Cable",
      productSku: "USB-1",
    },
    {
      ...base,
      reviewRef: "TEST-004",
      productTitle: "USB Cable",
      productSku: "USB-1",
    },
  ];
  const parsed = readReviewCsv(
    Buffer.from(
      csv([
        REVIEW_COLUMNS,
        ...records.map((r) =>
          REVIEW_COLUMNS.map((k) => (r as Record<string, string>)[k]),
        ),
      ]),
    ),
  );
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].reviewText, base.reviewText);
  assert.equal(parsed[1].reviewerName, "آزمائش");
  assert.deepEqual(
    parsed.map((r) => matchProduct(r, products).product?.id),
    ["a", "a", "c", "c"],
  );
});
test("matching never guesses similar titles, conflicting SKU or ambiguous normalized names", () => {
  assert.equal(
    matchProduct(
      { ...base, productTitle: "  travel   BAG  ", productSku: "" },
      products,
    ).product?.id,
    "a",
  );
  assert.equal(
    matchProduct({ ...base, productTitle: "Travel" }, products).product,
    undefined,
  );
  assert.equal(
    matchProduct({ ...base, productTitle: "USB Cable" }, products).product,
    undefined,
  );
  assert.equal(
    matchProduct({ ...base, productSku: "missing" }, products).product,
    undefined,
  );
  assert.equal(
    matchProduct({ ...base, productSku: "", productTitle: "TRAVEL BAG" }, [
      ...products,
      { id: "d", title: "travel bag", sku: "X" },
    ]).product,
    undefined,
  );
});
test("calendar dates are strict, preserve the entered day and reject future dates", () => {
  assert.equal(calendarDate("2024-02-29", "2026-10-21"), true);
  assert.equal(calendarDate("2025-02-29"), false);
  assert.equal(calendarDate("2026-13-01"), false);
  assert.equal(calendarDate("2026-10-22", "2026-10-21"), false);
  assert.equal(calendarDate("2026-1-01"), false);
  assert.equal(
    new Date(`${base.reviewDate}T00:00:00Z`).toISOString().slice(0, 10),
    base.reviewDate,
  );
});
test("ratings, references, private email and missing historical details are validated", () => {
  assert.equal(validateReview(base).errors.length, 0);
  for (const rating of ["0", "6", "3.5", "NaN"])
    assert.ok(validateReview({ ...base, rating }).errors.length);
  assert.equal(
    validateReview({ ...base, reviewerEmail: "" }).warnings.length,
    1,
  );
  assert.ok(
    validateReview({ ...base, reviewerEmail: "" }, false).errors.length,
  );
  assert.ok(validateReview({ ...base, reviewRef: "../escape" }).errors.length);
});
test("media stays with its reviewRef; missing, oversized, fake or excess media is rejected", async () => {
  const photo = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "#abc" },
  })
    .png()
    .toBuffer();
  const files = readMediaZip(
    Buffer.from(
      zipSync({
        "TEST-001/photo.png": photo,
        "TEST-002/photo.png": photo,
        "unassigned.txt": strToU8("unused"),
      }),
    ),
  );
  const attached = await rowMedia(
    { ...base, mediaFiles: "TEST-001/photo.png" },
    files,
    true,
  );
  assert.equal(attached.length, 1);
  assert.equal(attached[0].path, "TEST-001/photo.png");
  assert.ok(attached[0].url?.startsWith("data:image/webp;"));
  await assert.rejects(
    () => rowMedia({ ...base, mediaFiles: "TEST-002/photo.png" }, files),
    /own reviewRef/,
  );
  await assert.rejects(
    () => rowMedia({ ...base, mediaFiles: "TEST-001/missing.png" }, files),
    /Missing file/,
  );
  await assert.rejects(() =>
    inspectMedia(Buffer.from("not a picture"), "fake.jpg"),
  );
  await assert.rejects(
    () => inspectMedia(new Uint8Array(5 * 1024 * 1024 + 1), "large.png"),
    /5 MB/,
  );
  const six = Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [`TEST-001/${i}.png`, photo]),
  );
  await assert.rejects(
    () => rowMedia({ ...base, mediaFiles: Object.keys(six).join("|") }, six),
    /Maximum 5/,
  );
  assert.throws(
    () =>
      readMediaZip(
        Buffer.from(zipSync({ "../escape.txt": strToU8("unsafe") })),
      ),
    /Unsafe/,
  );
});
