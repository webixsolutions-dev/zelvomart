import { test } from "node:test";
import assert from "node:assert/strict";
import { productCreateSchema, productUpdateSchema, categoryCreateSchema, redirectSchema, salePriceProblem } from "./admin-validators";

// The shape Admin → Products → Save sends (components/admin/ProductForm.tsx).
const formPayload = {
  title: "Rhinestone Watch and Bracelet Set", slug: "rhinestone-watch-set", sku: "ZM-WATCH-01", categoryId: "cat_1",
  price: 2999, salePrice: 2399, trackStock: true, stockStatus: "instock", stock: 12, status: "PUBLISHED", featured: false,
  previousSlug: undefined, redirectFallback: true, bundleEnabled: true, bundleDiscountPercent: 5,
  shortDescription: "<ul><li>Gift box</li></ul>", descriptionHtml: "<p>Details</p>",
  images: ["https://pub-1.r2.dev/a.webp", "/images/products/legacy/b.webp"], seoTitle: null, seoDescription: null, canonicalUrl: null, videoUrl: null,
  variants: [{ name: "Silver", sku: "ZM-WATCH-01-S", trackStock: true, stockStatus: "instock", stock: 4, priceOverride: 2399, imageUrl: null, attributes: { Colour: "Silver" } }],
  catalogMeta: { productType: "variable", robotsIndex: "index", tags: ["best-selling"] },
};

test("the product form's own payload is accepted for create and update", () => {
  assert.equal(productCreateSchema.safeParse(formPayload).success, true);
  assert.equal(productUpdateSchema.safeParse(formPayload).success, true);
  assert.equal(productUpdateSchema.safeParse({ status: "ARCHIVED" }).success, true);
  assert.equal(productCreateSchema.safeParse({ ...formPayload, salePrice: "", costPrice: "" }).success, true);
});

test("bad product input is refused with a field", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ ...formPayload, title: "" }, "title"],
    [{ ...formPayload, slug: "Bad Slug/x" }, "slug"],
    [{ ...formPayload, price: "abc" }, "price"],
    [{ ...formPayload, price: -5 }, "price"],
    [{ ...formPayload, salePrice: 3500 }, "salePrice"],
    [{ ...formPayload, status: "LIVE" }, "status"],
    [{ ...formPayload, images: ["javascript:alert(1)"] }, "images.0"],
    [{ ...formPayload, canonicalUrl: "//evil.example" }, "canonicalUrl"],
    [{ ...formPayload, stock: 1.5 }, "stock"],
    [{ ...formPayload, variants: [{ name: "", sku: "x" }] }, "variants.0.name"],
  ];
  for (const [input, field] of cases) {
    const result = productCreateSchema.safeParse(input);
    assert.equal(result.success, false, `expected ${field} to fail`);
    assert.ok(!result.success && result.error.issues.some((i) => i.path.join(".") === field), `issue on ${field}`);
  }
});

test("sale price must be lower than the regular price", () => {
  assert.equal(salePriceProblem(700, 900) !== null, true);
  assert.equal(salePriceProblem(700, 700) !== null, true);
  assert.equal(salePriceProblem(900, 700), null);
  assert.equal(salePriceProblem(900, null), null);
  assert.equal(salePriceProblem(900, ""), null);
});

test("categories and redirects", () => {
  assert.equal(categoryCreateSchema.safeParse({ name: "Home & Living", slug: "home-living", sortOrder: "10" }).success, true);
  assert.equal(categoryCreateSchema.safeParse({ name: "", slug: "home-living" }).success, false);
  assert.equal(redirectSchema.safeParse({ sourcePath: "/old-page/", destination: "/shop/", permanent: true }).success, true);
  assert.equal(redirectSchema.safeParse({ sourcePath: "/x/", destination: "https://zelvomart.com/shop/" }).success, true);
  assert.equal(redirectSchema.safeParse({ sourcePath: "old-page", destination: "/shop/" }).success, false);
  assert.equal(redirectSchema.safeParse({ sourcePath: "/x/", destination: "javascript:alert(1)" }).success, false);
});
