import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { cartDeliveryFee } from "../storefront/lib/delivery";
import { applyStoreSettings } from "../storefront/lib/settings";

// The same cases backend/scripts/catalog.integration.mts sends through the real order endpoint.
const { policy, products, cases } = createRequire(import.meta.url)("@zelvomart/delivery/cases.json") as {
  policy: { flatRate: number; freeAbove: number };
  products: Record<string, { price: number; freeShipping: boolean }>;
  cases: { name: string; lines: [string, number][]; fee: number }[];
};

test("storefront delivery amount = the fee the order saves, for every shared case", () => {
  applyStoreSettings({ flatFee: policy.flatRate, freeOver: policy.freeAbove });
  for (const c of cases) {
    const items = c.lines.map(([key]) => ({ freeShipping: products[key].freeShipping }));
    const subtotal = c.lines.reduce((sum, [key, qty]) => sum + products[key].price * qty, 0);
    assert.equal(cartDeliveryFee(items, subtotal), c.fee, c.name);
  }
  assert.equal(cartDeliveryFee([], 0), 0, "empty cart");
});
