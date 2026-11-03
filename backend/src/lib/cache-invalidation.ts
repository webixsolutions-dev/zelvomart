import { forget, MEMO_TTL_MS } from "./memo";
import { runInBackground } from "./background";

/** The sitemaps and the HTML sitemap page. Extra product sitemaps (2, 3 …) refresh through the "products" tag. */
const SITEMAP_PATHS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/page-sitemap.xml",
  "/product_cat-sitemap.xml",
  "/product-sitemap.xml",
  "/sitemap",
];

function cachePathsForTags(tags: string[]) {
  const paths = new Set<string>();
  const refreshesCatalog = tags.some(
    (tag) =>
      ["products", "featured-products", "categories", "store"].includes(tag) ||
      tag.startsWith("product:") ||
      tag.startsWith("category:"),
  );
  if (refreshesCatalog) {
    paths.add("/");
    paths.add("/shop");
    for (const path of ["/new-arrivals", "/bestsellers", "/deals-and-offers", "/llms.txt", ...SITEMAP_PATHS])
      paths.add(path);
  }
  for (const tag of tags) {
    if (tag.startsWith("category:")) {
      paths.add(`/product-category/${tag.slice("category:".length)}/`);
    }
    if (tag.startsWith("product:")) paths.add(`/product/${tag.slice("product:".length)}/`);
  }
  return [...paths];
}

/** Backend memo keys (lib/memo.ts) each storefront tag stands for. */
const MEMO_PREFIXES: Record<string, string[]> = {
  settings: ["settings:", "bootstrap", "catalog:"],
  store: ["settings:", "bootstrap", "categories", "catalog:"],
  categories: ["categories", "bootstrap", "catalog:"],
  products: ["catalog:"],
  "featured-products": ["catalog:"],
  cities: ["cities"],
  redirects: ["redirects"],
  pages: ["pages:"],
};

export function memoPrefixesForTags(tags: string[]) {
  const prefixes = new Set<string>();
  for (const tag of tags) {
    for (const prefix of MEMO_PREFIXES[tag] || []) prefixes.add(prefix);
    if (tag.startsWith("setting:")) prefixes.add("settings:").add("bootstrap").add("catalog:");
    if (tag.startsWith("product:") || tag.startsWith("category:")) prefixes.add("catalog:");
  }
  return [...prefixes];
}

/**
 * Tells the storefront what changed (POST /api/revalidate: Next.js tags + page paths) after clearing the backend's
 * own copy of the same data. On serverless another running backend instance may still hold the old copy for up to
 * MEMO_TTL_MS; if the storefront re-fetched from that instance it would keep the old value, so for memo-backed tags
 * the refresh is sent once more after that window.
 */
export async function invalidateFrontendCache(tags: string[], options: { repeat?: boolean } = {}) {
  const prefixes = memoPrefixesForTags(tags);
  prefixes.forEach(forget);
  await postRevalidation(tags);
  if (prefixes.length && process.env.VERCEL && options.repeat !== false) {
    const memoTags = tags.filter((tag) => memoPrefixesForTags([tag]).length);
    runInBackground("storefront refresh after cache expiry", async () => {
      await new Promise((resolve) => setTimeout(resolve, MEMO_TTL_MS + 5_000));
      await postRevalidation(memoTags);
    });
  }
}

async function postRevalidation(tags: string[]) {
  const secret = process.env.REVALIDATION_SECRET;
  const configuredFrontend = process.env.FRONTEND_URL?.split(",")
    .map((value) => value.trim())
    .find(Boolean);
  if (!secret || !configuredFrontend || !tags.length) return;

  const endpoint = `${configuredFrontend.replace(/\/$/, "")}/api/revalidate`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidation-secret": secret,
      },
      body: JSON.stringify({
        tags: [...new Set(tags)],
        paths: cachePathsForTags(tags),
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok && process.env.NODE_ENV === "development") {
      console.warn("Frontend cache invalidation failed:", response.status);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.warn("Frontend cache invalidation error:", error);
  }
}
