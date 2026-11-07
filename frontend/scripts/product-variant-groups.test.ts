import test from "node:test";
import assert from "node:assert/strict";
import { toDesignProduct } from "../storefront/lib/product-map";
import type { Product, Variant } from "../types/product";

const variants: Variant[] = [
  {
    id: "eden-oslo",
    sku: "TRIO-V1",
    name: "Oslo / Eden",
    attributes: { "Loose Powder": "Eden", Foundation: "Oslo" },
    priceOverride: 1200,
    stockStatus: "instock",
    stock: 0,
    active: true,
  },
  {
    id: "desert-oslo",
    sku: "TRIO-V2",
    name: "Oslo / Desert",
    attributes: { "Loose Powder": "Desert", Foundation: "Oslo" },
    stockStatus: "outofstock",
    stock: 0,
    active: true,
  },
];

test("component selectors use the configured order and retain the exact orderable variant", () => {
  const product = toDesignProduct({
    id: "bundle", name: "Bundle", slug: "bundle", sku: "BUNDLE", price: 1000,
    stockStatus: "instock", images: [], categories: [], variants,
    categorySlugs: [], regularPrice: 1000, onSale: false, discountPercent: 0,
    stockQuantity: null, featured: false, hasOptions: true, bundleEnabled: false,
    catalogMeta: {
      attributes: [
        { name: "Foundation", valuesText: "Oslo | Missing", forVariations: true },
        { name: "Loose Powder", valuesText: "Desert | Eden", forVariations: true },
      ],
    },
  } satisfies Product);

  assert.deepEqual(product.variants?.groups, [
    { name: "Foundation", values: ["Oslo"] },
    { name: "Loose Powder", values: ["Desert", "Eden"] },
  ]);
  assert.equal(product.variants?.options[0].id, "eden-oslo");
  assert.equal(product.variants?.options[0].name, "Oslo / Eden");
  assert.equal(product.variants?.options[0].price, 1200);
  assert.equal(product.variants?.options[1].soldOut, true);
});
