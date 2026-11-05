import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADVANCE_DEFAULTS,
  advanceAvailability,
  advanceDiscount,
  advanceShortfall,
  advanceStatusBlocked,
  advanceUsesDemoValues,
  codToCollect,
  normalizeAdvanceSettings,
  paymentToken,
  paymentTokenHash,
  paymentTokenMatches,
  refundableAmount,
  suggestedRefund,
  verifyOutcome,
} from "./advance-payment";
import { validateSettingsUpdate } from "./settings-validation";

process.env.JWT_SECRET ||= "unit-test-secret-0123456789abcdef";
const real = {
  ...ADVANCE_DEFAULTS,
  tillId: "981234567",
  qrImageUrl: "https://media.zelvomart.com/payments/raast-qr.png",
};

test("defaults: off, demo values, Rs 200, no minimum", () => {
  const s = normalizeAdvanceSettings(null);
  assert.deepEqual(s, ADVANCE_DEFAULTS);
  assert.equal(s.enabled, false);
  assert.equal(advanceUsesDemoValues(s), true);
  assert.equal(normalizeAdvanceSettings({ discount: "x", minSubtotal: -5, enabled: "yes" }).discount, 200);
  assert.equal(normalizeAdvanceSettings({ enabled: "yes" }).enabled, false, "only a real true enables it");
});

test("demo values: missing or DEMO Till, missing or demo QR", () => {
  assert.equal(advanceUsesDemoValues(real), false);
  assert.equal(advanceUsesDemoValues({ ...real, tillId: "demo-till" }), true);
  assert.equal(advanceUsesDemoValues({ ...real, tillId: "" }), true);
  assert.equal(advanceUsesDemoValues({ ...real, qrImageUrl: "" }), true);
  assert.equal(advanceUsesDemoValues({ ...real, qrImageUrl: "https://x/demo-qr.png" }), true);
});

test("production shows the option only when enabled with real values; elsewhere it is a demo", () => {
  const prod = { APP_ENV: "production" };
  assert.deepEqual(advanceAvailability(ADVANCE_DEFAULTS, prod), { available: false, demo: false });
  assert.deepEqual(advanceAvailability({ ...ADVANCE_DEFAULTS, enabled: true }, prod), {
    available: false,
    demo: false,
  });
  assert.deepEqual(advanceAvailability(real, prod), { available: false, demo: false }, "real but not enabled");
  assert.deepEqual(advanceAvailability({ ...real, enabled: true }, prod), { available: true, demo: false });
  assert.deepEqual(advanceAvailability(ADVANCE_DEFAULTS, {}), { available: true, demo: true });
  assert.deepEqual(advanceAvailability({ ...real, enabled: true }, {}), { available: true, demo: false });
  assert.deepEqual(advanceAvailability(real, { APP_ENV: "preview" }), { available: true, demo: true });
});

test("discount only from the minimum, never above what is payable, whole rupees", () => {
  const s = { ...ADVANCE_DEFAULTS, discount: 200, minSubtotal: 3000 };
  assert.equal(advanceDiscount(s, 2999, 3189), 0);
  assert.equal(advanceShortfall(s, 2999), 1);
  assert.equal(advanceDiscount(s, 3000, 3190), 200);
  assert.equal(advanceShortfall(s, 3000), 0);
  assert.equal(advanceDiscount({ ...s, minSubtotal: 0 }, 120, 150), 150, "capped at the payable amount");
  assert.equal(advanceDiscount({ ...s, discount: 0 }, 5000, 5000), 0);
});

test("payment link token: derived from the order number, only its hash is stored, constant-time check", () => {
  const token = paymentToken("ZM-10020");
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(paymentToken("ZM-10020"), token, "same order, same token");
  assert.notEqual(paymentToken("ZM-10021"), token);
  const hash = paymentTokenHash(token);
  assert.equal(paymentTokenMatches(token, hash), true);
  for (const wrong of [paymentToken("ZM-10021"), "", undefined, null, 42, token + "x", "a".repeat(500)])
    assert.equal(paymentTokenMatches(wrong, hash), false);
  assert.equal(paymentTokenMatches(token, null), false);
});

test("COD amount for the courier = total − received + refunded, between 0 and the total", () => {
  assert.equal(codToCollect({ paymentMethod: "COD", paymentStatus: "NOT_REQUIRED", total: "3250.00" }), 3250);
  assert.equal(
    codToCollect({ paymentMethod: "COD", status: "CANCELLED", total: "3250.00" }),
    0,
    "cancelled: not booked",
  );
  const adv = { paymentMethod: "ADVANCE_EASYPAISA", total: "589.00" };
  // The four cases from the ZM-10018 review.
  assert.equal(codToCollect({ ...adv, paymentStatus: "VERIFIED", advanceReceived: "589.00" }), 0, "full verify");
  assert.equal(
    codToCollect({ ...adv, paymentStatus: "MISMATCH", advanceReceived: "9.00" }),
    580,
    "partial Rs 9 of 589",
  );
  assert.equal(
    codToCollect({
      ...adv,
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
      advanceReceived: 589,
      advanceRefunded: 589,
    }),
    0,
    "refunded and cancelled: no booking",
  );
  assert.equal(
    codToCollect({ ...adv, status: "NEW", paymentStatus: "REFUNDED", advanceReceived: 589, advanceRefunded: 589 }),
    589,
    "refunded but kept: the full amount again",
  );
  assert.equal(codToCollect({ ...adv, advanceReceived: 700 }), 0, "overpaid: never below 0");
  assert.equal(codToCollect({ ...adv, advanceReceived: 0, advanceRefunded: 100 }), 589, "never above the total");
  for (const status of ["AWAITING_PAYMENT", "SUBMITTED", "REJECTED", "EXPIRED"])
    assert.equal(codToCollect({ ...adv, paymentStatus: status }), 589, `${status}: never shipped as paid`);
});

test("status guard: an unverified advance order cannot be confirmed or shipped", () => {
  const adv = { paymentMethod: "ADVANCE_EASYPAISA", advanceReceived: 0 };
  for (const paymentStatus of ["AWAITING_PAYMENT", "SUBMITTED", "MISMATCH", "REJECTED", "EXPIRED"]) {
    assert.equal(advanceStatusBlocked({ ...adv, paymentStatus }, "CONFIRMED"), true, paymentStatus);
    assert.equal(advanceStatusBlocked({ ...adv, paymentStatus }, "BOOKED"), true, paymentStatus);
    assert.equal(advanceStatusBlocked({ ...adv, paymentStatus }, "CANCELLED"), false, "cancel is always allowed");
    assert.equal(advanceStatusBlocked({ ...adv, paymentStatus }, "ON_HOLD"), false);
  }
  assert.equal(advanceStatusBlocked({ ...adv, paymentStatus: "VERIFIED", advanceReceived: 589 }, "CONFIRMED"), false);
  assert.equal(
    advanceStatusBlocked({ ...adv, paymentStatus: "MISMATCH", advanceReceived: 9 }, "CONFIRMED"),
    false,
    "accepted partial",
  );
  assert.equal(advanceStatusBlocked({ ...adv, paymentStatus: "REFUNDED" }, "CONFIRMED"), false, "refunded and kept");
  assert.equal(advanceStatusBlocked({ paymentMethod: "COD", paymentStatus: "NOT_REQUIRED" }, "CONFIRMED"), false);
});

test("verify: the full amount (or more) verifies, less is a partial", () => {
  assert.equal(verifyOutcome(589, "589.00"), "VERIFIED");
  assert.equal(verifyOutcome(700, 589), "VERIFIED");
  assert.equal(verifyOutcome(9, 589), "PARTIAL");
  assert.equal(verifyOutcome(588.6, 589), "VERIFIED", "whole rupees");
});

test("refund: never above received − refunded; prefill follows the reason", () => {
  const order = { total: 589, deliveryFee: 150, advanceReceived: 589, advanceRefunded: 0 };
  assert.equal(refundableAmount(order), 589);
  assert.equal(suggestedRefund("CUSTOMER_CANCELLED", order), 439, "paid − delivery charges");
  assert.equal(suggestedRefund("COULD_NOT_SHIP", order), 589, "everything back");
  assert.equal(suggestedRefund("OVERPAID", { ...order, advanceReceived: 700 }), 111);
  assert.equal(suggestedRefund("OVERPAID", order), 0);
  assert.equal(refundableAmount({ ...order, advanceRefunded: 519 }), 70, "ZM-10018: Rs 519 already refunded");
  assert.equal(
    codToCollect({ paymentMethod: "ADVANCE_EASYPAISA", total: 589, advanceReceived: 589, advanceRefunded: 519 }),
    519,
    "ZM-10018 as stored: refunded but kept → the courier collects the refunded part",
  );
  assert.equal(suggestedRefund("CUSTOMER_CANCELLED", { ...order, advanceReceived: 100 }), 0, "never below 0");
});

test("settings: production refuses to enable advance payment on demo values", () => {
  const value = { ...ADVANCE_DEFAULTS, enabled: true };
  const before = process.env.APP_ENV;
  try {
    process.env.APP_ENV = "production";
    assert.throws(() => validateSettingsUpdate({ "payments.advance": value }), /real Easypaisa Till ID/);
    assert.doesNotThrow(() => validateSettingsUpdate({ "payments.advance": { ...value, enabled: false } }));
    assert.doesNotThrow(() => validateSettingsUpdate({ "payments.advance": { ...real, enabled: true } }));
    delete process.env.APP_ENV;
    assert.doesNotThrow(() => validateSettingsUpdate({ "payments.advance": value }), "demo is fine off production");
    assert.throws(
      () => validateSettingsUpdate({ "payments.advance": { ...real, qrImageUrl: "http://insecure/qr.png" } }),
      /https/,
    );
    assert.throws(
      () => validateSettingsUpdate({ "payments.advance": { ...real, reminderHours: 24, expiryHours: 24 } }),
      /expiry/,
    );
    assert.throws(
      () => validateSettingsUpdate({ "payments.advance": { ...real, firstReminderMinutes: 120, reminderHours: 2 } }),
      /first payment reminder/,
    );
    assert.doesNotThrow(
      () => validateSettingsUpdate({ "payments.advance": { ...real, firstReminderMinutes: 30 } }),
      "30 minutes, then 2 hours",
    );
    assert.equal(normalizeAdvanceSettings({}).firstReminderMinutes, 30, "default 30 minutes");
  } finally {
    if (before === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = before;
  }
});
