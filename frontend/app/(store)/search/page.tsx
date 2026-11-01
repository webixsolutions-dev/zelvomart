import type { Metadata } from "next";
import { headers } from "next/headers";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { SearchView } from "@store/components/pages/SearchView";
import { loadCards, loadStore } from "@store/lib/backend";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

/** Search runs on the server: one backend query with a limit (24), every word must match, best matches first. */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = String(Array.isArray(raw) ? raw[0] : raw || "").trim().slice(0, 80);
  const h = await headers();
  const clientIp = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const [, found, popular] = await Promise.all([
    loadStore(),
    q ? loadCards({ search: q, sort: "relevance", limit: 24 }, { clientIp }) : Promise.resolve({ items: [], total: 0 }),
    loadCards({ tag: "bestsellers", limit: 4 }),
  ]);
  return (
    <>
      <Breadcrumbs items={[{ label: "Search" }]} />
      <SearchView q={q} results={found.items} total={found.total} popular={popular.items} />
    </>
  );
}
