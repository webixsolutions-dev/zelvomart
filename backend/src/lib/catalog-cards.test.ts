import assert from "node:assert/strict";
import test from "node:test";
import { parseIds } from "./catalog-cards";
import { searchTerms } from "./catalog-query";

test("cart ids: only id characters, no duplicates, at most 50", () => {
  assert.deepEqual(parseIds("abc, def,abc,,x y,'; drop--"), ["abc", "def"]);
  assert.equal(parseIds(Array.from({ length: 80 }, (_, i) => `id${i}`).join(",")).length, 50);
  assert.deepEqual(parseIds(undefined), []);
});

test("search words: lower case, at most 6", () => {
  assert.deepEqual(searchTerms("  Steel   BOTTLE "), ["steel", "bottle"]);
  assert.equal(searchTerms("a b c d e f g h").length, 6);
  assert.deepEqual(searchTerms("   "), []);
});
