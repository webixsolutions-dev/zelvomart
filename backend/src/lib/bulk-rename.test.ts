import assert from "node:assert/strict";
import test from "node:test";
import { parseRenameInput, planBulkRename, redirectFromSlug, repointRedirects, type CatalogRow } from "./bulk-rename";

const row = (over: Partial<CatalogRow>): CatalogRow => ({
  id: "p1",
  title: "Pink Tumbler",
  slug: "pink-tumbler",
  status: "PUBLISHED",
  price: 1500,
  salePrice: null,
  seoTitle: null,
  seoDescription: null,
  categoryId: "c-home",
  categoryName: "Home & Living",
  categorySlug: "home-living",
  image: null,
  ...over,
});

const catalog: CatalogRow[] = [
  row({}),
  row({
    id: "p2",
    title: "Glow Serum",
    slug: "glow-serum",
    categoryId: "c-beauty",
    categoryName: "Beauty",
    seoTitle: "Best Glow Serum in Pakistan",
    seoDescription: "Hand written.",
  }),
  row({ id: "p3", title: "Gift Box", slug: "gift-box", categoryId: "c-home" }),
  row({ id: "p4", title: "Gift  box", slug: "gift-box-2", categoryId: "c-kids", categoryName: "Kids" }),
  row({ id: "p5", title: "Steel Bottle", slug: "steel-bottle", seoTitle: "Steel Bottle" }),
  row({ id: "p6", title: "Old Lamp", slug: "lamp" }),
];

const plan = (text: string, opts: { categoryId?: string; redirect?: boolean } = {}) =>
  planBulkRename(parseRenameInput(text).lines, catalog, { redirect: false, ...opts });

test("paste: TAB or | separated, header row and empty lines ignored, CSV upload too", () => {
  const tab = parseRenameInput("old title\tnew title\n\nPink Tumbler\tRose Tumbler\t1,299\n");
  assert.equal(tab.lines.length, 1);
  assert.deepEqual(
    { ...tab.lines[0], line: 0 },
    {
      line: 0,
      oldTitle: "Pink Tumbler",
      newTitle: "Rose Tumbler",
      price: "1,299",
      salePrice: "",
      seoTitle: "",
      seoDescription: "",
    },
  );
  assert.equal(parseRenameInput("Pink Tumbler | Rose Tumbler | | - ").lines[0].salePrice, "-");
  const csv = parseRenameInput(
    'old_title,new_title,price,sale_price,seo_title,seo_description\n"Pink Tumbler","Rose, Tumbler",,,,\n',
  );
  assert.equal(csv.lines[0].newTitle, "Rose, Tumbler");
  assert.match(parseRenameInput(Array.from({ length: 501 }, (_, i) => `a${i}|b`).join("\n")).error || "", /500/);
});

test("match by exact title, case-insensitive with collapsed spaces; new slug; no fuzzy match", () => {
  const [r] = plan("  pink   TUMBLER |Rose Tumbler");
  assert.equal(r.status, "ok");
  assert.equal(r.product?.id, "p1");
  assert.equal(r.after?.slug, "rose-tumbler");
  assert.equal(r.redirect, "none");
  assert.equal(plan("Pink Tumblr|Rose")[0].status, "error");
  assert.match(plan("Pink Tumblr|Rose")[0].reason || "", /no product has this title/);
});

test("ambiguous title lists the categories; a category filter resolves it", () => {
  const [amb] = plan("gift box|Luxury Gift Box");
  assert.equal(amb.status, "error");
  assert.match(amb.reason || "", /ambiguous.*Home & Living.*Kids/);
  const [ok] = plan("gift box|Luxury Gift Box", { categoryId: "c-kids" });
  assert.equal(ok.status, "ok");
  assert.equal(ok.product?.id, "p4");
  // Outside the chosen category it is not found.
  assert.equal(plan("Glow Serum|X", { categoryId: "c-kids" })[0].status, "error");
});

test("a product listed twice is an error on both lines", () => {
  const rows = plan("Pink Tumbler|A\npink tumbler|B");
  assert.deepEqual(
    rows.map((r) => r.status),
    ["error", "error"],
  );
  assert.match(rows[0].reason || "", /more than once/);
});

test("slug collision gets -2/-3; same slug is kept; redirect only when ticked", () => {
  const [r] = plan("Pink Tumbler|Glow Serum", { redirect: true });
  assert.equal(r.after?.slug, "glow-serum-2");
  assert.equal(r.slugSuffixed, true);
  assert.equal(r.redirect, "301");
  const two = plan("Pink Tumbler|Gift Box\nOld Lamp|Gift Box!");
  assert.deepEqual(
    two.map((x) => x.after?.slug),
    ["gift-box-3", "gift-box-4"],
  );
  const [caseOnly] = plan("Pink Tumbler|PINK tumbler");
  assert.equal(caseOnly.after?.slug, "pink-tumbler");
  assert.equal(caseOnly.redirect, undefined);
});

test("price and sale price: validated, '-' removes the sale price, blank leaves it", () => {
  const [p] = plan("Pink Tumbler||1,299|999");
  assert.equal(p.status, "ok");
  assert.deepEqual(
    [p.after?.title, p.after?.slug, p.after?.price, p.after?.salePrice],
    ["Pink Tumbler", "pink-tumbler", 1299, 999],
  );
  assert.match(plan("Pink Tumbler||1000|1200")[0].reason || "", /sale price must be lower/);
  assert.match(plan("Pink Tumbler||0")[0].reason || "", /above 0/);
  assert.match(plan("Pink Tumbler||abc")[0].reason || "", /above 0/);
  const cat = [row({ salePrice: 1200 })];
  const [rm] = planBulkRename(parseRenameInput("Pink Tumbler|||-").lines, cat, { redirect: false });
  assert.equal(rm.after?.salePrice, null);
});

test("SEO: explicit values applied with limits; hand-written kept; copy of old title follows", () => {
  const [set] = plan(`Pink Tumbler|Rose Tumbler|||Rose Tumbler 1200ml|Keeps drinks cold.`);
  assert.equal(set.seoTitleAction, "set");
  assert.equal(set.after?.seoTitle, "Rose Tumbler 1200ml");
  assert.equal(set.after?.seoDescription, "Keeps drinks cold.");
  assert.match(plan(`Pink Tumbler|X|||${"a".repeat(61)}`)[0].reason || "", /SEO title is longer than 60/);
  assert.match(plan(`Pink Tumbler|X||||${"a".repeat(156)}`)[0].reason || "", /SEO description is longer than 155/);
  const [kept] = plan("Glow Serum|Radiance Serum");
  assert.equal(kept.seoTitleAction, "kept");
  assert.equal(kept.after?.seoTitle, "Best Glow Serum in Pakistan");
  assert.equal(kept.after?.seoDescription, "Hand written.");
  const [follow] = plan("Steel Bottle|Steel Water Bottle");
  assert.equal(follow.seoTitleAction, "follow");
  assert.equal(follow.after?.seoTitle, "Steel Water Bottle");
  const [empty] = plan("Pink Tumbler|Rose Tumbler");
  assert.equal(empty.seoTitleAction, "follow");
  assert.equal(empty.after?.seoTitle, null);
});

test("only title, slug, price, sale price and SEO are in the write (no variants, stock, category)", () => {
  const [r] = plan("Pink Tumbler|Rose Tumbler|1300");
  assert.deepEqual(Object.keys(r.after || {}).sort(), [
    "price",
    "salePrice",
    "seoDescription",
    "seoTitle",
    "slug",
    "title",
  ]);
});

test("applying the same batch again is a no-op", () => {
  const [first] = plan("Pink Tumbler|Rose Tumbler|1300");
  const renamed = catalog.map((p) =>
    p.id === "p1" ? { ...p, title: first.after!.title, slug: first.after!.slug, price: first.after!.price } : p,
  );
  const [again] = planBulkRename(parseRenameInput("Pink Tumbler|Rose Tumbler|1300").lines, renamed, {
    redirect: false,
  });
  assert.equal(again.status, "unchanged");
  // A different price on a line whose old title no longer exists is not guessed.
  const [other] = planBulkRename(parseRenameInput("Pink Tumbler|Rose Tumbler|1400").lines, renamed, {
    redirect: false,
  });
  assert.equal(other.status, "error");
});

test("redirects: old URL redirects only when ticked; existing ones repointed, no chain, no loop", () => {
  assert.equal(redirectFromSlug("pink-tumbler", "rose-tumbler", true), "pink-tumbler");
  assert.equal(redirectFromSlug("pink-tumbler", "rose-tumbler", false), undefined);
  assert.equal(redirectFromSlug("same", "same", true), undefined);
  const fix = repointRedirects(
    [
      { id: "a", sourcePath: "/product/older/", destination: "/product/pink-tumbler/" },
      { id: "b", sourcePath: "/product/rose-tumbler/", destination: "/product/pink-tumbler/" },
      { id: "c", sourcePath: "/x/", destination: "/shop" },
    ],
    "/product/pink-tumbler/",
    "/product/rose-tumbler/",
  );
  assert.deepEqual(fix.update, ["a"]);
  assert.deepEqual(fix.remove, ["b"]);
  assert.equal(fix.previous.length, 2);
});
