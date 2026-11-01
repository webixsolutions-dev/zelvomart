import assert from "node:assert/strict";
import test from "node:test";
import { archiveCardQuery, archiveHref, hasRefinements, pageWindow, parseArchiveParams, PRICE_CAP } from "../storefront/lib/archive";

test("listing URLs: page 1 is the clean URL, filters and page survive a round trip", () => {
  const p = parseArchiveParams({});
  assert.deepEqual(p, { page: 1, sort: "featured", min: 0, max: PRICE_CAP, stock: false, category: null });
  assert.equal(archiveHref("/shop/", p), "/shop/");
  assert.equal(archiveHref("/shop/", p, { page: 2 }), "/shop/?page=2");
  const q = parseArchiveParams({ page: "3", sort: "low", min: "500", max: "3000", stock: "1", category: "beauty" });
  assert.equal(archiveHref("/shop/", q), "/shop/?category=beauty&min=500&max=3000&stock=1&sort=low&page=3");
  assert.deepEqual(parseArchiveParams(Object.fromEntries(new URL("http://x" + archiveHref("/shop/", q)).searchParams)), q);
  assert.ok(hasRefinements(q));
  assert.ok(!hasRefinements(parseArchiveParams({ page: "4" })));
});

test("listing params: nonsense falls back to safe values", () => {
  const p = parseArchiveParams({ page: "-2", sort: "drop table", min: "abc", max: "99999", category: "cars" });
  assert.deepEqual(p, { page: 1, sort: "featured", min: 0, max: PRICE_CAP, stock: false, category: null });
  assert.equal(parseArchiveParams({ page: "999999" }).page, 1000);
});

test("listing query: 24 per page, collection tags, featured = newest", () => {
  const p = parseArchiveParams({ page: "2", sort: "high", stock: "1" });
  assert.deepEqual(archiveCardQuery(p, { collection: "deals" }), {
    page: 2,
    limit: 24,
    sort: "price-desc",
    tag: "discount",
    category: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    inStock: true,
  });
  assert.equal(archiveCardQuery(parseArchiveParams({}), { collection: "new-arrivals" }).sort, "newest");
  assert.equal(archiveCardQuery(parseArchiveParams({}), { collection: "new-arrivals" }).tag, "new");
  assert.equal(archiveCardQuery(parseArchiveParams({ category: "tech" }), { category: "kids" }).category, "kids");
});

test("page numbers: first, last and two either side, gaps marked", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(pageWindow(10, 20), [1, null, 8, 9, 10, 11, 12, null, 20]);
});
