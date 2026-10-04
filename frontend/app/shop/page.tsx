import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import { getCategories, getProducts } from "@/lib/store";
import SearchTracker from "@/components/SearchTracker";

export const revalidate = 120;

function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input || ""; }

function paginationPages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

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

  const categoryName = category ? categories.find((row) => row.slug === category)?.name : "";
  const heading = q ? `Results for ${q}` : categoryName || "The full Zelvomart collection.";

  const link = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    if (sort !== "newest") sp.set("sort", sort);
    if (targetPage > 1) sp.set("page", String(targetPage));
    const query = sp.toString();
    return query ? `/shop?${query}#products` : "/shop#products";
  };

  const pages = paginationPages(result.page, result.totalPages);

  return (
    <div className="shop-page brand-shop-page professional-shop-page pb-20">
      {q ? <SearchTracker query={q} /> : null}

      <section className="professional-shop-hero">
        <div className="site-shell professional-shop-hero-grid">
          <div className="professional-shop-title">
            <span className="premium-overline">THE ZELVOMART STORE</span>
            <h1>{heading}</h1>
          </div>
          <div className="professional-shop-intro">
            <p>Practical products across home, beauty, tech, fashion and fitness — with clear pricing, Cash on Delivery and real support.</p>
            <a href="#products" className="professional-inline-link">Browse products <span>↓</span></a>
          </div>
        </div>
      </section>

      <section className="professional-shop-promise">
        <div className="site-shell professional-shop-promise-grid">
          <div><span>01</span><b>Clear choices</b><p>Useful details without unnecessary clutter.</p></div>
          <div><span>02</span><b>Cash on Delivery</b><p>A familiar checkout experience across Pakistan.</p></div>
          <div><span>03</span><b>Real support</b><p>WhatsApp help before and after your order.</p></div>
        </div>
      </section>

      <div className="site-shell brand-shop-content professional-shop-content">
        <div className="professional-shop-section-head">
          <div>
            <span className="premium-overline">BROWSE YOUR WAY</span>
            <h2>Find what fits your routine.</h2>
          </div>
          <p>Use categories, search or sorting to narrow the collection quickly.</p>
        </div>

        <div className="shop-category-pills brand-shop-categories professional-shop-categories">
          <Link className={!category ? "active" : ""} href="/shop">All Products</Link>
          {categories.slice(0, 6).map((row) => <Link className={category === row.slug ? "active" : ""} href={`/product-category/${row.slug}/`} key={row.id}>{row.name}</Link>)}
        </div>

        <form className="shop-filter brand-shop-filter professional-shop-filter" action="/shop">
          <div className="brand-filter-field brand-filter-search"><label>Search</label><input name="q" defaultValue={q} placeholder="What are you looking for?" /></div>
          <div className="brand-filter-field"><label>Category</label><select name="category" defaultValue={category}><option value="">All categories</option>{categories.slice(0, 6).map((row) => <option value={row.slug} key={row.id}>{row.name}</option>)}</select></div>
          <div className="brand-filter-field"><label>Sort by</label><select name="sort" defaultValue={sort}><option value="newest">Newest first</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select></div>
          <button className="brand-filter-button">Apply filters</button>
        </form>

        <div id="products" className="shop-result-bar brand-result-bar professional-result-bar">
          <span>{result.total} product{result.total === 1 ? "" : "s"}</span>
          <span>{result.total > 0 ? `Page ${result.page} of ${result.totalPages} • 12 products per page` : "Quality checked • Cash on Delivery • WhatsApp support"}</span>
        </div>
        <ProductGrid products={result.items} emptyText="No products match these filters yet. Try another category or search." />

        {result.totalPages > 1 ? (
          <nav className="brand-pagination brand-pagination-full" aria-label="Shop pagination">
            {result.page > 1 ? <Link className="brand-page-nav" href={link(result.page - 1)} aria-label="Previous page">← Previous</Link> : <span className="brand-page-nav disabled">← Previous</span>}
            <div className="brand-page-numbers">
              {pages.map((item, index) => item === "ellipsis"
                ? <span className="brand-page-ellipsis" key={`ellipsis-${index}`}>…</span>
                : <Link className={item === result.page ? "active" : ""} aria-current={item === result.page ? "page" : undefined} href={link(item)} key={item}>{item}</Link>)}
            </div>
            {result.page < result.totalPages ? <Link className="brand-page-nav" href={link(result.page + 1)} aria-label="Next page">Next →</Link> : <span className="brand-page-nav disabled">Next →</span>}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
