/**
 * Sitemaps, Yoast-style: one index (/sitemap_index.xml, also served at /sitemap.xml) and one child per type
 * (pages, categories, products). The XML files, the index and the HTML page /sitemap/ all read this module,
 * so they always list the same URLs. No `server-only` here: the tests import it directly.
 */
import { backendCategorySlugs, categories as designCategories, type CategoryId } from "./catalog";
import { site } from "./site";
import type { SeoIndex } from "./backend";

/**
 * The storefront's own pages, with the date their content last changed. A fixed date, not "now":
 * a sitemap that changes on every request tells search engines nothing. Update a date when that
 * page's content changes (policy pages too: their text lives in code).
 */
export const staticPages: { path: string; label: string; lastmod: string }[] = [
  { path: "", label: "Home", lastmod: "2026-10-21" },
  { path: "shop", label: "Shop", lastmod: "2026-10-21" },
  { path: "new-arrivals", label: "New Arrivals", lastmod: "2026-10-21" },
  { path: "bestsellers", label: "Bestsellers", lastmod: "2026-10-21" },
  { path: "deals-and-offers", label: "Deals & Offers", lastmod: "2026-10-21" },
  { path: "about-us", label: "About Us", lastmod: "2026-10-21" },
  { path: "contact-us", label: "Contact Us", lastmod: "2026-10-21" },
  { path: "faqs", label: "FAQs", lastmod: "2026-10-21" },
  { path: "track-your-order", label: "Track Your Order", lastmod: "2026-10-21" },
  { path: "shipping-policy", label: "Shipping Policy", lastmod: "2026-10-21" },
  { path: "refund_returns", label: "Returns & Refunds", lastmod: "2026-10-21" },
  { path: "privacy-policy", label: "Privacy Policy", lastmod: "2026-10-21" },
  { path: "terms-conditions", label: "Terms & Conditions", lastmod: "2026-10-21" },
];

/** Yoast's size: product-sitemap.xml holds the first 1,000, then product-sitemap2.xml, 3 … */
export const PRODUCTS_PER_SITEMAP = 1000;

export type SitemapUrl = { loc: string; lastmod: string; images?: string[] };
export type SitemapPage = SitemapUrl & { label: string };
export type SitemapCategory = SitemapUrl & { id: CategoryId; name: string; productCount: number };
/** `categoryId` is null when the backend category does not match one of the seven store categories. */
export type SitemapProduct = SitemapUrl & { title: string; categoryId: CategoryId | null; images: string[] };
export type SitemapData = { pages: SitemapPage[]; categories: SitemapCategory[]; products: SitemapProduct[] };
export type ChildSitemap = { file: string; label: string; urls: SitemapUrl[]; lastmod: string };

const iso = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(staticPages[0].lastmod).toISOString() : date.toISOString();
};
const newest = (dates: string[]) => dates.reduce((a, b) => (b > a ? b : a), "");

/**
 * The backend answer has the shape this module needs. An older backend (slug + updatedAt only) does not:
 * during a deploy the storefront can be built against it, and that must count as a failure (503), not as
 * "every product is in Home & Living and has no images".
 */
export function isSeoIndex(value: unknown): value is SeoIndex {
  const v = value as SeoIndex | null;
  if (!v || !Array.isArray(v.products) || !Array.isArray(v.categories)) return false;
  const product = (p: SeoIndex["products"][number]) =>
    !!p &&
    typeof p.slug === "string" &&
    typeof p.title === "string" &&
    typeof p.updatedAt === "string" &&
    "category" in p &&
    (p.category === null || typeof p.category === "string") &&
    Array.isArray(p.images) &&
    p.images.every((i) => typeof i === "string");
  const category = (c: SeoIndex["categories"][number]) =>
    !!c && typeof c.slug === "string" && typeof c.updatedAt === "string" && typeof c.publishedProducts === "number";
  return v.products.every(product) && v.categories.every(category);
}

/** A backend category slug → one of the seven store categories, exactly; no guessing, no default. */
export function exactCategoryId(slug: string | null | undefined): CategoryId | null {
  if (!slug) return null;
  const match = designCategories.find((c) => c.id === slug || c.slug === slug || backendCategorySlugs[c.id] === slug);
  return match ? match.id : null;
}

/** The URLs of every sitemap, from the backend's SEO index. Throws on a backend answer of the wrong shape. */
export function sitemapData(seo: SeoIndex): SitemapData {
  if (!isSeoIndex(seo)) throw new Error("SEO_INDEX_SHAPE");
  const pages = staticPages.map((p) => ({ loc: `${site.url}/${p.path ? p.path + "/" : ""}`, lastmod: iso(p.lastmod), label: p.label }));
  const products = seo.products.map((p) => {
    const categoryId = exactCategoryId(p.category);
    if (!categoryId) console.warn(`[sitemaps] product "${p.slug}" has no store category (backend category: ${p.category ?? "none"})`);
    return { loc: `${site.url}/product/${p.slug}/`, lastmod: iso(p.updatedAt), title: p.title, categoryId, images: p.images };
  });
  // Every store category the admin still has (a deleted category has no row and is left out), empty ones too:
  // an empty category page is indexable and shows a "coming soon" block (owner decision, 30 Oct 2026).
  const categories = designCategories.flatMap((c) => {
    const rows = seo.categories.filter((row) => exactCategoryId(row.slug) === c.id);
    if (!rows.length) return [];
    return [
      {
        loc: `${site.url}/product-category/${c.slug}/`,
        lastmod: newest(rows.map((row) => iso(row.updatedAt))),
        id: c.id,
        name: c.name,
        productCount: products.filter((p) => p.categoryId === c.id).length,
      },
    ];
  });
  return { pages, categories, products };
}

/** The child sitemaps that have URLs, in index order. */
export function childSitemaps(data: SitemapData): ChildSitemap[] {
  const children: Omit<ChildSitemap, "lastmod">[] = [
    { file: "page-sitemap.xml", label: "Pages", urls: data.pages },
    { file: "product_cat-sitemap.xml", label: "Categories", urls: data.categories },
  ];
  for (let start = 0, n = 1; start < data.products.length; start += PRODUCTS_PER_SITEMAP, n++) {
    children.push({
      file: `product-sitemap${n === 1 ? "" : n}.xml`,
      label: n === 1 ? "Products" : `Products (part ${n})`,
      urls: data.products.slice(start, start + PRODUCTS_PER_SITEMAP),
    });
  }
  return children.filter((c) => c.urls.length).map((c) => ({ ...c, lastmod: newest(c.urls.map((u) => u.lastmod)) }));
}

export function xmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch] as string);
}

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/css" href="/sitemap.css"?>\n';
const tag = (name: string, value: string) => `<${name}>${xmlEscape(value)}</${name}>`;

export function sitemapIndexXml(children: ChildSitemap[]) {
  const items = children.map((c) => `<sitemap>${tag("loc", `${site.url}/${c.file}`)}${tag("lastmod", c.lastmod)}</sitemap>`);
  return `${HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</sitemapindex>\n`;
}

export function urlsetXml(urls: SitemapUrl[]) {
  const withImages = urls.some((u) => u.images?.length);
  const ns = `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${withImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""}`;
  const items = urls.map((u) => {
    const images = (u.images || []).map((src) => `<image:image>${tag("image:loc", src)}</image:image>`).join("");
    return `<url>${tag("loc", u.loc)}${tag("lastmod", u.lastmod)}${images}</url>`;
  });
  return `${HEAD}<urlset ${ns}>\n${items.join("\n")}\n</urlset>\n`;
}

export const INDEX_FILES = ["sitemap_index.xml", "sitemap.xml"];

/** The XML for one published file name, or null when that file does not exist (or has no URLs). */
export function sitemapXml(file: string, data: SitemapData): string | null {
  const children = childSitemaps(data);
  if (INDEX_FILES.includes(file)) return sitemapIndexXml(children);
  const child = children.find((c) => c.file === file);
  return child ? urlsetXml(child.urls) : null;
}

const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8", "X-Robots-Tag": "noindex" };

/**
 * The response for one sitemap file. If the backend fails: 503 with Retry-After, never an empty list.
 * `onFailure` runs first (the routes rethrow Next's own signals and call `connection()`, so the failure is
 * never stored as the cached version; during a background refresh Next keeps serving the last good file).
 */
export async function sitemapResponse(
  file: string,
  load: () => Promise<SeoIndex>,
  onFailure: (error: unknown) => Promise<unknown> = async () => undefined,
) {
  let data: SitemapData;
  try {
    data = sitemapData(await load());
  } catch (error) {
    await onFailure(error);
    return new Response("Sitemap temporarily unavailable. Please try again in a few minutes.\n", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  }
  const xml = sitemapXml(file, data);
  if (xml === null) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });
  return new Response(xml, { headers: XML_HEADERS });
}
