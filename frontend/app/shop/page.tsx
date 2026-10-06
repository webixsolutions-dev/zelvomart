import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import StorePagination from "@/components/StorePagination";
import TrustStrip from "@/components/TrustStrip";
import CatalogBrowser from "@/components/CatalogBrowser";
import { getCategories, getProducts } from "@/lib/store";
import SearchTracker from "@/components/SearchTracker";

export const revalidate = 120;
const v = (x: string | string[] | undefined) => Array.isArray(x) ? x[0] : x || "";
const n = (x: string | string[] | undefined) => {
  const value = Number(v(x));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = v(sp.q).trim();
  const category = v(sp.category).trim();
  const sortRaw = v(sp.sort);
  const sort = sortRaw === "newest" || sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "popular";
  const page = Math.max(1, Number(v(sp.page)) || 1);
  const gift = v(sp.gift) === "1";
  const minPrice = n(sp.minPrice);
  const maxPrice = n(sp.maxPrice);
  const availability = v(sp.availability) === "instock" ? "instock" : "";

  const [result, categories] = await Promise.all([
    getProducts({
      search: q || undefined,
      category: category || undefined,
      sort,
      page,
      limit: 12,
      featured: gift || undefined,
      minPrice,
      maxPrice,
      availability: availability || undefined,
    }),
    getCategories(),
  ]);

  const heading = q ? `Results for ${q}` : gift ? "Gift sets" : "Shop all";
  const description = gift
    ? "Gift-ready favourites, useful finds and easy-to-order picks in one place."
    : "Everything useful, giftable and worth keeping — all in one place.";

  return (
    <div className="mock-listing-page">
      {q ? <SearchTracker query={q} /> : null}
      <section className="site-shell mock-listing-intro">
        <nav>Home <span>›</span> {gift ? "Gift sets" : "Shop"}</nav>
        <h1>{heading}</h1>
        <p>{description}</p>
      </section>

      <section className="site-shell mock-listing-categories" id="categories">
        {categories.slice(0, 7).map((c) => (
          <Link key={c.id} href={`/product-category/${c.slug}/`}>
            <span><Image src={c.image || `/images/categories/${c.slug}.webp`} alt={c.name} fill /></span>
            <b>{c.name}</b>
          </Link>
        ))}
      </section>

      <section id="products" className="site-shell">
        <CatalogBrowser
          categories={categories}
          currentCategory={category}
          minPrice={minPrice}
          maxPrice={maxPrice}
          availability={availability}
          sort={sort}
          categoryMode="query"
          clearHref="/shop"
        >
          <ProductGrid products={result.items} emptyText="No products found. Try another category, price range or search." />
          <div className="mock-listing-count">Showing {result.items.length} of {result.total || result.items.length} products</div>
          <StorePagination
            currentPage={result.page || page}
            totalPages={result.totalPages || 1}
            basePath="/shop"
            query={{
              q: q || undefined,
              category: category || undefined,
              sort: sort !== "popular" ? sort : undefined,
              gift: gift ? 1 : undefined,
              minPrice,
              maxPrice,
              availability: availability || undefined,
            }}
          />
        </CatalogBrowser>
      </section>
      <section className="site-shell mock-listing-trust"><TrustStrip /></section>
    </div>
  );
}
