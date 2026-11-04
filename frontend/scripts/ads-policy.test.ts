import assert from "node:assert/strict";
import test from "node:test";
import { adsEnvironment, adsHostAllowed, adsSiteHost } from "../lib/ads-policy";

test("pixels load only on NEXT_PUBLIC_SITE_URL's exact host", () => {
  const site = "https://www.zelvomart.com";
  assert.equal(adsHostAllowed("www.zelvomart.com", site), true);
  assert.equal(adsHostAllowed("WWW.ZELVOMART.COM", site), true);
  for (const host of ["zelvomart-storefront.vercel.app", "zelvomart.com", "localhost:3300", "www.zelvomart.com.evil.example", ""])
    assert.equal(adsHostAllowed(host, site), false, host);
  assert.equal(adsHostAllowed("www.zelvomart.com", ""), false, "no site URL: never");
  assert.equal(adsSiteHost("http://www.zelvomart.com"), "", "https only");
});

test("APP_ENV: the storefront's own value wins, else the backend's; only production loads pixels", () => {
  assert.equal(adsEnvironment(undefined, "production"), true);
  assert.equal(adsEnvironment("production", "staging"), true);
  assert.equal(adsEnvironment("staging", "production"), false);
  assert.equal(adsEnvironment(undefined, "staging"), false);
  assert.equal(adsEnvironment(undefined, undefined), false);
});
