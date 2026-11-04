import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADVANCE_DEFAULTS,
  advanceAvailability,
  advanceDiscount,
  advanceShortfall,
  advanceUsesDemoValues,
  codToCollect,
  normalizeAdvanceSettings,
  paymentToken,
  paymentTokenHash,
  paymentTokenMatches,
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

test("COD amount for the courier: 0 once verified, the balance after a partial payment, else the total", () => {
  assert.equal(codToCollect({ paymentMethod: "COD", paymentStatus: "NOT_REQUIRED", total: "3250.00" }), 3250);
  const adv = { paymentMethod: "ADVANCE_EASYPAISA", total: "3250.00" };
  assert.equal(codToCollect({ ...adv, paymentStatus: "VERIFIED" }), 0);
  assert.equal(codToCollect({ ...adv, paymentStatus: "MISMATCH", advanceReceived: "3000.00" }), 250);
  assert.equal(codToCollect({ ...adv, paymentStatus: "MISMATCH", advanceReceived: 0 }), 3250);
  for (const status of ["AWAITING_PAYMENT", "SUBMITTED", "REJECTED", "EXPIRED"])
    assert.equal(codToCollect({ ...adv, paymentStatus: status }), 3250, `${status}: never shipped as paid`);
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
  } finally {
    if (before === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = before;
  }
});
