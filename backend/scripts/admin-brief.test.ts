import { test } from "node:test";
import assert from "node:assert/strict";
import { couponCode, couponDiscount, couponInput } from "../src/lib/coupons";
import { quoteDelivery, amountUntilFreeShipping } from "../src/lib/shipping";
import { quoteDelivery as browserQuote } from "../../frontend/lib/shipping";
import { checkoutSchema } from "../src/lib/validators";
import { assertContactable, recoveryStatus } from "../src/recovery";
test("checkout accepts no email, postcode or terms checkbox", () => {
  const result = checkoutSchema.safeParse({
    idempotencyKey: "12345554-99d3-409f-bb15-de0e90deca76",
    fullName: "QA Customer",
    phone: "03001234567",
    city: "Lahore",
    address: "Test address 123",
    cart: [{ productId: "qa", quantity: 1 }],
  });
  assert.equal(result.success, true);
  assert.equal(result.success && result.data.email, undefined);
  assert.equal(result.success && result.data.postcode, undefined);
});
test("shipping threshold is inclusive, consistent and ignores historical COD fees", () => {
  const rule = { flatRate: 250, freeAbove: 8000, codFee: 999 };
  for (const subtotal of [7999, 8000, 8001])
    assert.deepEqual(quoteDelivery(subtotal, false, rule), browserQuote(subtotal, false, rule));
  assert.equal(quoteDelivery(8000, false, rule).fee, 0);
  assert.equal(quoteDelivery(7999, false, rule).fee, 250);
  assert.equal(amountUntilFreeShipping(8000, 8000), 0);
  assert.equal("codFee" in quoteDelivery(8000, false, rule), false);
});
test("coupons normalize case, cap fixed discounts and expire at Pakistan midnight", () => {
  assert.equal(couponCode(" next15 "), "NEXT15");
  const c = couponInput({ code: "next15", type: "PERCENT", amount: 15, expiresAt: "2026-10-18", active: true });
  assert.equal(c.expiresAt?.toISOString(), "2026-10-18T18:59:59.999Z");
  assert.equal(couponDiscount(c, 1000, new Date("2026-10-18T18:59:59Z")), 150);
  assert.throws(() => couponDiscount(c, 1000, new Date("2026-10-18T19:00:00Z")), /expired/);
  assert.equal(couponDiscount({ ...c, type: "FIXED", amount: 5000, expiresAt: null }, 1000), 1000);
  assert.throws(() => couponInput({ ...c, expiresAt: "", amount: 101 }), /valid/);
  assert.throws(() => couponDiscount({ ...c, active: false }, 1000), /inactive/);
});
test("recovery requires one hour and distinguishes genuine follow-up", () => {
  const now = Date.now();
  assert.throws(() => assertContactable({ convertedAt: null, updatedAt: new Date(now - 3599999) }, now), /one hour/);
  assert.doesNotThrow(() => assertContactable({ convertedAt: null, updatedAt: new Date(now - 3600000) }, now));
  assert.throws(() => assertContactable({ convertedAt: new Date(), updatedAt: new Date(0) }, now), /converted/);
  assert.equal(recoveryStatus({ convertedAt: new Date(now), followedUpAt: new Date(now - 1) }), "Recovered");
  assert.equal(recoveryStatus({ convertedAt: new Date(now), followedUpAt: null }), "Ordered without follow-up");
  assert.equal(recoveryStatus({ convertedAt: null, followedUpAt: null, lostAt: new Date() }), "Lost");
});
