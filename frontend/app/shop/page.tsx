import Link from "next/link";
import { headers } from "next/headers";
import ProductGrid from "@/components/ProductGrid";
import { getCategories, getProducts } from "@/lib/store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { safeIp } from "@/lib/security";
import SearchTracker from "@/components/SearchTracker";

export const revalidate = 120;

function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input || ""; }

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = value(params.q).trim();
  const category = value(params.category).trim();
  const sortRaw = value(params.sort);
  const sort = sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "newest";
  const page = Math.max(1, Number(value(params.page)) || 1);

  let rateLimited = false;
  if (q) {
    const h = await headers();
    try { await enforceRateLimit(`search:${safeIp(h)}`, 60, 10 * 60 * 1000); } catch { rateLimited = true; }
  }

  if (rateLimited) {
    return <div className="site-shell py-20 text-center"><h1 className="text-3xl font-black text-slate-800">Too many searches</h1><p className="mx-auto mt-3 max-w-xl text-slate-500">Please wait a few minutes and try again. If you need help now, message Zelvomart on WhatsApp.</p><a className="btn-green mt-6" href="https://wa.me/923002026711" target="_blank" rel="noreferrer">Ask on WhatsApp</a></div>;
  }

  const [result, categories] = await Promise.all([
    getProducts({ search: q || undefined, category: category || undefined, sort, page, limit: 12 }),
    getCategories(),
  ]);

  const link = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    if (sort) sp.set("sort", sort);
    sp.set("page", String(targetPage));
    return `/shop?${sp.toString()}`;
  };

  return (
    <div className="site-shell pb-20">
      {q ? <SearchTracker query={q} /> : null}
      <div className="page-head"><h1>{q ? `Search: ${q}` : "Shop"}</h1><p>Browse real products from the Zelvomart database.</p></div>
      <form className="mb-7 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_220px_180px_auto]" action="/shop">
        <input name="q" defaultValue={q} placeholder="Search products or categories" className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none" />
        <select name="category" defaultValue={category} className="rounded-xl border border-slate-200 bg-white px-3 py-3"><option value="">All categories</option>{categories.map((row) => <option value={row.slug} key={row.id}>{row.name}</option>)}</select>
        <select name="sort" defaultValue={sort} className="rounded-xl border border-slate-200 bg-white px-3 py-3"><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select>
        <button className="btn-dark">Apply</button>
      </form>
      <div className="mb-5 text-sm text-slate-500">{result.total} product{result.total === 1 ? "" : "s"}</div>
      <ProductGrid products={result.items} emptyText="Try a different search, or ask us on WhatsApp and we'll help." />
      {result.totalPages > 1 ? <nav className="mt-9 flex flex-wrap justify-center gap-2">{Array.from({ length: result.totalPages }, (_, index) => index + 1).map((n) => <Link className={`grid h-10 w-10 place-items-center rounded-lg border text-sm font-extrabold ${n === result.page ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`} href={link(n)} key={n}>{n}</Link>)}</nav> : null}
    </div>
  );
}
