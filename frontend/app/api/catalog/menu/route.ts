import { categories } from "@store/lib/catalog";
import { loadCards } from "@store/lib/backend";

/**
 * The "Categories" menu in the search bar: product count and the first 6 products of each group. Loaded when the
 * menu is first opened, from cached card reads (5 minutes, refreshed with the "products" tag).
 */
export async function GET() {
  const groups: Record<string, Parameters<typeof loadCards>[0]> = {
    all: {},
    best: { tag: "bestsellers" },
    new: { tag: "new" },
    deals: { tag: "discount" },
    ...Object.fromEntries(categories.map((c) => [c.id, { category: c.id }])),
  };
  const entries = await Promise.all(
    Object.entries(groups).map(async ([key, query]) => {
      const page = await loadCards({ ...query, limit: 6 });
      return [key, { count: page.total, items: page.items }] as const;
    }),
  );
  return Response.json(
    { groups: Object.fromEntries(entries) },
    { headers: { "cache-control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600" } },
  );
}
