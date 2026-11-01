import { categories, type CategoryId, type CollectionKey } from "./catalog";

/**
 * Shop, collection and category listings: 24 products per page, filters and sort in the URL so every page is
 * server-rendered and shareable. /shop/ = page 1; /shop/?page=2 …; ?sort=low&min=500&max=3000&stock=1&category=beauty.
 */
export const ARCHIVE_PAGE_SIZE = 24;
export const PRICE_CAP = 10000;

export type ArchiveSort = "featured" | "low" | "high" | "name" | "discount";
export const ARCHIVE_SORTS: ArchiveSort[] = ["featured", "low", "high", "discount", "name"];

export type ArchiveParams = {
  page: number;
  sort: ArchiveSort;
  min: number;
  max: number;
  stock: boolean;
  category: CategoryId | null;
};

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseArchiveParams(sp: Search): ArchiveParams {
  const page = Math.floor(Number(first(sp.page)));
  const sort = first(sp.sort) as ArchiveSort;
  const min = Math.floor(Number(first(sp.min)));
  const max = Math.floor(Number(first(sp.max)));
  const category = first(sp.category);
  return {
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 1000) : 1,
    sort: ARCHIVE_SORTS.includes(sort) ? sort : "featured",
    min: Number.isFinite(min) && min > 0 ? Math.min(min, PRICE_CAP) : 0,
    max: Number.isFinite(max) && max > 0 && max < PRICE_CAP ? max : PRICE_CAP,
    stock: first(sp.stock) === "1",
    category: categories.some((c) => c.id === category) ? (category as CategoryId) : null,
  };
}

/** True when a filter or a non-default sort is set (those URLs canonicalise to the plain listing page). */
export function hasRefinements(p: ArchiveParams) {
  return p.sort !== "featured" || p.min > 0 || p.max < PRICE_CAP || p.stock || p.category != null;
}

/** The listing URL for these params; page 1 has no ?page (the clean URL). */
export function archiveHref(basePath: string, p: ArchiveParams, change: Partial<ArchiveParams> = {}) {
  const next = { ...p, ...change };
  const query = new URLSearchParams();
  if (next.category) query.set("category", next.category);
  if (next.min > 0) query.set("min", String(next.min));
  if (next.max < PRICE_CAP) query.set("max", String(next.max));
  if (next.stock) query.set("stock", "1");
  if (next.sort !== "featured") query.set("sort", next.sort);
  if (next.page > 1) query.set("page", String(next.page));
  const text = query.toString();
  return text ? `${basePath}?${text}` : basePath;
}

const SORT_TO_BACKEND: Record<ArchiveSort, string> = {
  // "Featured" keeps the catalogue order the store always used: newest first.
  featured: "newest",
  low: "price-asc",
  high: "price-desc",
  name: "name",
  discount: "discount",
};
const COLLECTION_TAG: Record<CollectionKey, string | undefined> = {
  shop: undefined,
  "new-arrivals": "new",
  bestsellers: "bestsellers",
  deals: "discount",
};

/** The backend card query for one listing page. */
export function archiveCardQuery(p: ArchiveParams, scope: { collection?: CollectionKey; category?: CategoryId }) {
  return {
    page: p.page,
    limit: ARCHIVE_PAGE_SIZE,
    sort: SORT_TO_BACKEND[p.sort],
    tag: scope.collection ? COLLECTION_TAG[scope.collection] : undefined,
    category: scope.category ?? p.category ?? undefined,
    minPrice: p.min > 0 ? p.min : undefined,
    maxPrice: p.max < PRICE_CAP ? p.max : undefined,
    inStock: p.stock || undefined,
  };
}

/** Page numbers to show: first, last, and two either side of the current one, with gaps as null. */
export function pageWindow(current: number, total: number): (number | null)[] {
  const pages = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}
