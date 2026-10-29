import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryRateLimiter } from "./rate-limit-store";
import { STORE_LIMITS, checkoutRateRules, eventsRateRule, requestIp } from "./store-limits";

/** Runs the checkout rules the way the route does: both buckets are counted, the order goes through only if both allow it. */
function checkoutLimiter() {
  const consume = createMemoryRateLimiter();
  return (ip: string, phone: string) =>
    checkoutRateRules(ip, phone)
      .map((rule) => consume(rule.key, rule.limit, rule.windowMs))
      .every((result) => result.allowed);
}

test("the forwarded shopper IP is used only with the right proxy secret", () => {
  const before = process.env.STORE_PROXY_SECRET;
  process.env.STORE_PROXY_SECRET = "a".repeat(64);
  try {
    const headers = (secret: string) => ({ "x-zm-client-ip": "39.45.10.20", "x-zm-proxy-secret": secret });
    assert.equal(requestIp({ ip: "10.0.0.1", headers: headers("a".repeat(64)) }), "39.45.10.20");
    assert.equal(requestIp({ ip: "10.0.0.1", headers: headers("b".repeat(64)) }), "10.0.0.1");
    assert.equal(requestIp({ ip: "10.0.0.1", headers: headers("short") }), "10.0.0.1");
    assert.equal(requestIp({ ip: "10.0.0.1", headers: { "x-zm-client-ip": "39.45.10.20" } }), "10.0.0.1");
    assert.equal(
      requestIp({ ip: "10.0.0.1", headers: { "x-zm-client-ip": "not an ip", "x-zm-proxy-secret": "a".repeat(64) } }),
      "10.0.0.1",
    );
  } finally {
    if (before === undefined) delete process.env.STORE_PROXY_SECRET;
    else process.env.STORE_PROXY_SECRET = before;
  }
});

test("limits are generous per IP and strict per phone", () => {
  assert.equal(STORE_LIMITS.checkoutPerIp.limit, 60);
  assert.equal(STORE_LIMITS.checkoutPerPhone.limit, 6);
  assert.equal(STORE_LIMITS.eventsPerIp.limit, 1200);
  assert.equal(STORE_LIMITS.searchPerIp.limit, 120);
  assert.equal(STORE_LIMITS.couponPerIp.limit, 40);
});

test("20 orders from 20 different phones on one shared IP are not blocked", () => {
  const allow = checkoutLimiter();
  for (let i = 0; i < 20; i++)
    assert.equal(allow("39.45.10.20", `30012345${String(i).padStart(2, "0")}`), true, `order ${i + 1}`);
});

test("the 7th order from one phone is blocked, on any IP", () => {
  const allow = checkoutLimiter();
  for (let i = 0; i < 6; i++) assert.equal(allow(`39.45.10.${i}`, "3001234567"), true);
  assert.equal(allow("39.45.10.99", "3001234567"), false);
  assert.equal(allow("39.45.10.99", "3009999999"), true, "another phone on that IP still works");
});

test("different IPs are counted separately", () => {
  const allow = checkoutLimiter();
  for (let i = 0; i < 60; i++) assert.equal(allow("39.45.10.20", `3${String(i).padStart(9, "0")}`), true);
  assert.equal(allow("39.45.10.20", "3111111111"), false, "61st order on one IP");
  assert.equal(allow("39.45.10.21", "3222222222"), true, "a different IP has its own count");
});

test("tracking events are counted per visitor id, else per IP", () => {
  const visitor = "4b1d9c4e-1f2a-4c3b-9d8e-7f6a5b4c3d2e";
  assert.equal(eventsRateRule("1.2.3.4", visitor).key, `events-visitor:${visitor}`);
  assert.equal(eventsRateRule("5.6.7.8", visitor).key, eventsRateRule("1.2.3.4", visitor).key);
  assert.equal(eventsRateRule("1.2.3.4", "not-a-uuid").key, "events:1.2.3.4:");
  assert.equal(eventsRateRule("1.2.3.4", undefined).limit, 1200);
});
