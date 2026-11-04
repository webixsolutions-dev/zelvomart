import assert from "node:assert/strict";
import test from "node:test";
import { adsAllowedForUrl, adsEnvironment, adsSiteHost } from "./ads-policy";

const PROD = { APP_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://www.zelvomart.com" };

test("server-side conversion events only for the real shop in production", () => {
  assert.equal(adsAllowedForUrl("https://www.zelvomart.com/product/bottle/", PROD), true);
  assert.equal(adsAllowedForUrl("https://www.zelvomart.com/order-confirmed/?order=ZM-1", PROD), true);
  // Every other host stays silent: previews, vercel.app, the apex (it redirects to www), look-alikes.
  for (const url of [
    "https://zelvomart-storefront.vercel.app/",
    "https://zelvomart-storefront-git-x-zelvomart.vercel.app/",
    "https://zelvomart.com/",
    "https://www.zelvomart.com.evil.example/",
    "http://www.zelvomart.com/",
    "https://www.zelvomart.com/admin/orders",
    "not a url",
    "",
  ])
    assert.equal(adsAllowedForUrl(url, PROD), false, url);
});

test("staging or a missing APP_ENV keeps everything silent, even on the real host", () => {
  for (const APP_ENV of ["staging", "development", "", undefined, "prod"])
    assert.equal(adsAllowedForUrl("https://www.zelvomart.com/", { ...PROD, APP_ENV }), false, String(APP_ENV));
  assert.equal(adsEnvironment({ APP_ENV: " Production " }), true);
  assert.equal(adsAllowedForUrl("https://www.zelvomart.com/", { APP_ENV: "production" }), false, "no site URL");
});

test("today's staging setup (vercel.app site URL, APP_ENV=staging) sends nothing", () => {
  const today = { APP_ENV: "staging", NEXT_PUBLIC_SITE_URL: "https://zelvomart-storefront.vercel.app" };
  assert.equal(adsAllowedForUrl("https://zelvomart-storefront.vercel.app/", today), false);
  assert.equal(adsSiteHost(today), "zelvomart-storefront.vercel.app");
  assert.equal(adsSiteHost({ NEXT_PUBLIC_SITE_URL: "http://localhost:3300" }), "", "https only");
});
