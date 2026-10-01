import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import { getCategories, getProducts } from "@/lib/store";
import SearchTracker from "@/components/SearchTracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input || ""; }

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = value(params.q).trim();
  const category = value(params.category).trim();
  const sortRaw = value(params.sort);
  const sort = sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "newest";
  const page = Math.max(1, Number(value(params.page)) || 1);

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
    <div className="site-shell shop-page pb-20">
      {q ? <SearchTracker query={q} /> : null}
      <div className="page-head shop-head">
        <span className="static-page-kicker">SHOP ZELVOMART</span>
        <h1>{q ? `Search: ${q}` : category ? categories.find((row) => row.slug === category)?.name || "Shop" : "Shop All Products"}</h1>
        <p>Discover useful everyday products with Cash on Delivery across Pakistan.</p>
      </div>

      <div className="shop-category-pills">
        <Link className={!category ? "active" : ""} href="/shop">All Products</Link>
        {categories.slice(0,6).map((row) => <Link className={category === row.slug ? "active" : ""} href={`/product-category/${row.slug}/`} key={row.id}>{row.name}</Link>)}
      </div>

      <form className="shop-filter" action="/shop">
        <input name="q" defaultValue={q} placeholder="Search products or categories" />
        <select name="category" defaultValue={category}><option value="">All categories</option>{categories.slice(0,6).map((row) => <option value={row.slug} key={row.id}>{row.name}</option>)}</select>
        <select name="sort" defaultValue={sort}><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select>
        <button className="btn-dark">Apply</button>
      </form>

      <div className="shop-result-bar"><span>{result.total} product{result.total === 1 ? "" : "s"}</span><span>Quality checked • Cash on Delivery</span></div>
      <ProductGrid products={result.items} emptyText="Try a different search, or ask us on WhatsApp and we'll help." />
      {result.totalPages > 1 ? <nav className="mt-9 flex flex-wrap justify-center gap-2">{Array.from({ length: result.totalPages }, (_, index) => index + 1).map((n) => <Link className={`grid h-10 w-10 place-items-center rounded-lg border text-sm font-extrabold ${n === result.page ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"}`} href={link(n)} key={n}>{n}</Link>)}</nav> : null}
    </div>
  );
}
