import assert from "node:assert/strict";
import test from "node:test";
import { memoPrefixesForTags } from "./cache-invalidation";

test("admin saves clear the matching backend caches", () => {
  assert.deepEqual(memoPrefixesForTags(["settings"]).sort(), ["bootstrap", "catalog:", "settings:"]);
  assert.deepEqual(memoPrefixesForTags(["setting:store.productTabs"]).sort(), ["bootstrap", "catalog:", "settings:"]);
  assert.deepEqual(memoPrefixesForTags(["categories"]).sort(), ["bootstrap", "catalog:", "categories"]);
  assert.deepEqual(memoPrefixesForTags(["cities"]), ["cities"]);
  assert.deepEqual(memoPrefixesForTags(["redirects"]), ["redirects"]);
  // A product save, a tag save or a stock change clears only the listing rank and count (catalog:*), no settings.
  assert.deepEqual(memoPrefixesForTags(["products", "product:steel-bottle", "product-pages"]), ["catalog:"]);
  assert.deepEqual(memoPrefixesForTags(["category:home-living"]), ["catalog:"]);
});
