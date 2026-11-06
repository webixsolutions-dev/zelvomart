import test from "node:test";
import assert from "node:assert/strict";
import { privatePaymentPath, privateSafeUrl, sanitizeReplayEvent } from "../lib/url-privacy";
import { replayDeliveryResult } from "../lib/replay-delivery";

test("browser snapshots and metadata cannot carry a private payment token", () => {
  const token = "SYNTHETIC_PRIVATE_PAYMENT";
  const full = { type: 2, data: { href: `https://www.zelvomart.com/pay/ZM-1/?t=${token}`, node: { attributes: { href: `/pay/ZM-1/?t=${token}` } } } };
  const mutation = { type: 3, data: { attributes: [{ attributes: { href: `https://www.zelvomart.com/pay/ZM-1/?t=${token}` } }] } };
  assert.equal(JSON.stringify(sanitizeReplayEvent([full, mutation])).includes(token), false);
  assert.equal(privateSafeUrl(`https://www.zelvomart.com/pay/ZM-1/?t=${token}&utm_campaign=test`).includes("utm_campaign=test"), true);
  assert.equal(privatePaymentPath("/pay/ZM-1/"), true);
  assert.equal(privatePaymentPath("/order-confirmed/"), true);
  assert.equal(privatePaymentPath("/product/payday/"), false);
  assert.equal(replayDeliveryResult(403, "REPLAY_DISABLED").terminal, true);
});
