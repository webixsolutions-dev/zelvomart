import { loadCards } from "@store/lib/backend";

/**
 * Small product lists for the browser (storefront/lib/catalog-client.ts), from the same cached card reads the pages
 * use. ?ids=a,b (cart, wishlist) · ?list=bestsellers|upsell · ?q=words (search suggestions). At most 24 per answer.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(24, Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || 8)));
  const ids = url.searchParams.get("ids");
  const list = url.searchParams.get("list");
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const clientIp = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

  let items;
  if (ids != null) {
    const wanted = ids.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 50);
    if (url.searchParams.get("fresh") === "1") {
      try {
        const { items } = await loadCards({ ids: wanted, limit: Math.max(1, wanted.length) }, { fresh: true });
        return Response.json({ items }, { headers: { "cache-control": "private, no-store" } });
      } catch {
        return Response.json({ error: "CART_CATALOG_UNAVAILABLE" }, { status: 503, headers: { "cache-control": "private, no-store" } });
      }
    }
    items = (await loadCards({ ids: wanted, limit: Math.max(1, wanted.length) })).items;
  } else if (list === "bestsellers") {
    items = (await loadCards({ tag: "bestsellers", limit })).items;
  } else if (list === "upsell") {
    // Cart add-ons: in stock and up to Rs 2,000 (the old cart drawer rule).
    items = (await loadCards({ maxPrice: 2000, inStock: true, limit })).items;
  } else if (q) {
    items = (await loadCards({ search: q, sort: "relevance", limit }, { clientIp })).items;
  } else {
    return Response.json({ items: [] }, { status: 400 });
  }
  return Response.json(
    { items },
    { headers: { "cache-control": q ? "private, max-age=60" : "public, max-age=60, s-maxage=60, stale-while-revalidate=300" } },
  );
}
