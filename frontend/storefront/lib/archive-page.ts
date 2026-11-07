import "server-only";
import { permanentRedirect } from "next/navigation";
import { categories, type CategoryId, type CollectionKey } from "./catalog";
import { archiveCardQuery, archiveHref, hasRefinements, parseArchiveParams } from "./archive";
import { loadCards, loadCategoryCounts, loadStore } from "./backend";

type Search = Record<string, string | string[] | undefined>;

/**
 * Loads one listing page and keeps its URL clean: ?page=1 redirects to the plain URL (301) and a page past the end
 * goes to the last page, so there is never an empty grid at a numbered URL.
 */
async function listing(basePath: string, sp: Search, scope: { collection?: CollectionKey; category?: CategoryId }, opts?: { strict?: boolean }) {
  const params = parseArchiveParams(sp);
  // The proxy already answers ?page=1 with a 301 (proxy.ts); this is the fallback when it did not run.
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  if (rawPage != null && params.page === 1) permanentRedirect(archiveHref(basePath, params));
  const [, data] = await Promise.all([loadStore(), loadCards(archiveCardQuery(params, scope), opts)]);
  // Past the last page: show the last page itself (its canonical points there too), never an empty grid.
  if (data.total > 0 && params.page > data.totalPages) {
    const last = { ...params, page: data.totalPages };
    return { params: last, data: await loadCards(archiveCardQuery(last, scope)) };
  }
  return { params, data };
}

export function collectionListing(k: CollectionKey, basePath: string, sp: Search, opts?: { strict?: boolean }) {
  return listing(basePath, sp, { collection: k }, opts);
}

/** A category page; when the category has no products at all, the "coming soon" block data instead. */
export async function categoryListing(id: CategoryId, basePath: string, sp: Search, opts?: { strict?: boolean }) {
  const { params, data } = await listing(basePath, sp, { category: id }, opts);
  let soon: { others: CategoryId[]; picks: Awaited<ReturnType<typeof loadCards>>["items"] } | null = null;
  if (!data.unavailable && !data.total && !hasRefinements(params)) {
    const [counts, best] = await Promise.all([loadCategoryCounts(), loadCards({ tag: "bestsellers", limit: 4 })]);
    const picks = best.items.length ? best.items : (await loadCards({ limit: 4 })).items;
    soon = { others: categories.filter((c) => c.id !== id && (counts[c.id] || 0) > 0).map((c) => c.id), picks };
  }
  return { params, data, soon };
}

/**
 * Canonical and title for a listing URL: page 2+ is its own page ("… – Page 2", canonical /shop/?page=2);
 * filtered or re-sorted views canonicalise to the plain page so search engines index one URL per page.
 * A page past the end canonicalises to the last page (the count comes from the same cached request as the page).
 */
export async function listingMeta(
  basePath: string,
  sp: Search,
  title: string,
  scope: { collection?: CollectionKey; category?: CategoryId },
) {
  const params = parseArchiveParams(sp);
  if (params.page > 1) {
    const data = await loadCards(archiveCardQuery(params, scope));
    if (data.total > 0 && params.page > data.totalPages) params.page = data.totalPages;
  }
  const canonical = archiveHref(basePath, { ...params, sort: "featured", min: 0, max: 10000, stock: false, category: null });
  const brand = " | Zelvomart";
  const paged =
    params.page > 1
      ? title.endsWith(brand)
        ? `${title.slice(0, -brand.length)} – Page ${params.page}${brand}`
        : `${title} – Page ${params.page}`
      : title;
  return { canonical, title: paged, refined: hasRefinements(params) };
}
