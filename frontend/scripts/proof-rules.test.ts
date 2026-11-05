import assert from "node:assert/strict";
import test from "node:test";
import { detailsRequired, proofErrors, PROOF_NEEDS_SCREENSHOT_OR_DETAILS } from "../storefront/lib/proof-rules";
import { isIosDevice, isMobileDevice } from "../storefront/lib/device";

const empty = { hasScreenshot: false, tid: "", amount: "", senderName: "", senderLast4: "" };

test("proof form: a screenshot alone, or the TID + amount alone, is enough", () => {
  assert.deepEqual(proofErrors({ ...empty, hasScreenshot: true }), {}, "screenshot only passes");
  assert.deepEqual(proofErrors({ ...empty, tid: "41234567890", amount: "589" }), {}, "details only pass");
  assert.deepEqual(
    proofErrors({ ...empty, hasScreenshot: true, tid: "41234567890", amount: "589", senderName: "Ali Raza" }),
    {},
    "both are fine",
  );
  const neither = proofErrors(empty);
  assert.equal(neither.form, PROOF_NEEDS_SCREENSHOT_OR_DETAILS, "neither fails");
  assert.ok(neither.tid && neither.amount);
  assert.equal(proofErrors({ ...empty, tid: "41234567890" }).form, PROOF_NEEDS_SCREENSHOT_OR_DETAILS, "TID alone");
  assert.equal(proofErrors({ ...empty, amount: "589" }).form, PROOF_NEEDS_SCREENSHOT_OR_DETAILS, "amount alone");
});

test("proof form: typed values must still be valid; the sender name is optional", () => {
  const shot = { ...empty, hasScreenshot: true };
  assert.ok(proofErrors({ ...shot, tid: "12-3" }).tid, "short TID");
  assert.ok(proofErrors({ ...shot, amount: "0" }).amount, "zero amount");
  assert.ok(proofErrors({ ...shot, senderName: "A" }).senderName);
  assert.ok(proofErrors({ ...shot, senderLast4: "123" }).senderLast4);
  assert.deepEqual(proofErrors({ ...empty, tid: "41234567890", amount: "589", senderName: "" }), {}, "no sender");
});

test("required marks: shown without a screenshot, hidden with one, back when it is removed", () => {
  assert.equal(detailsRequired(false), true);
  assert.equal(detailsRequired(true), false);
  assert.equal(detailsRequired(false), true, "screenshot removed: required again");
});

test("iPhone hint only on iOS, including iPadOS reporting as a Mac with touch", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  const ipados = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
  assert.equal(isIosDevice(iphone), true);
  assert.equal(isIosDevice(ipados, 5), true, "iPad on iPadOS");
  assert.equal(isIosDevice(ipados, 0), false, "a real Mac");
  assert.equal(isIosDevice(android, 5), false);
  assert.equal(isIosDevice(windows), false);
  assert.equal(isMobileDevice(android, 5), true);
  assert.equal(isMobileDevice(windows), false, "desktop: scan with your phone");
  assert.equal(isMobileDevice(ipados, 0), false);
});
