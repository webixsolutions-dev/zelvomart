import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { advanceQuote } from "../storefront/lib/payments";

// The checkout shows the advance discount from the same shared rule the backend saves (packages/delivery);
// backend/scripts/advance-orders.integration.mts checks the saved order totals against the same function.
const require = createRequire(import.meta.url);
const shared = require("@zelvomart/delivery");

test("checkout advance discount equals the shared rule the backend uses", () => {
  const offer = { available: true, discount: 200, minSubtotal: 3000 };
  const policy = shared.resolveAdvancePolicy(offer);
  for (const [subtotal, payable] of [
    [2999, 3189],
    [3000, 3190],
    [4500, 4590],
    [8000, 7900],
    [150, 340],
  ]) {
    const q = advanceQuote(offer, subtotal, payable);
    assert.equal(q.discount, shared.advanceDiscountFor(subtotal, payable, policy), `${subtotal}/${payable}`);
    assert.equal(q.shortfall, shared.amountUntilAdvanceDiscount(subtotal, policy));
  }
  assert.deepEqual(advanceQuote(offer, 2500, 2690), { discount: 0, shortfall: 500, flat: 200 });
  assert.deepEqual(advanceQuote(offer, 3000, 3190), { discount: 200, shortfall: 0, flat: 200 });
});

test("no offer (production on demo values, or switched off): never a discount", () => {
  assert.deepEqual(advanceQuote({ available: false }, 9000, 9000), { discount: 0, shortfall: 0, flat: 0 });
});
