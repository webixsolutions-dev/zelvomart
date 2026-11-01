import assert from "node:assert/strict";
import test from "node:test";
import { memoPrefixesForTags } from "./cache-invalidation";

test("admin saves clear the matching backend caches", () => {
  assert.deepEqual(memoPrefixesForTags(["settings"]).sort(), ["bootstrap", "settings:"]);
  assert.deepEqual(memoPrefixesForTags(["setting:store.productTabs"]).sort(), ["bootstrap", "settings:"]);
  assert.deepEqual(memoPrefixesForTags(["categories"]).sort(), ["bootstrap", "categories"]);
  assert.deepEqual(memoPrefixesForTags(["cities"]), ["cities"]);
  assert.deepEqual(memoPrefixesForTags(["redirects"]), ["redirects"]);
  // A product save or a stock change touches no cached settings.
  assert.deepEqual(memoPrefixesForTags(["products", "product:steel-bottle", "product-pages"]), []);
});
