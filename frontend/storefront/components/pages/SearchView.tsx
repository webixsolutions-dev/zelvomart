"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { categories, products, searchProducts, categoryPath } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SearchBox } from "@/components/layout/SearchBox";
import { SectionHead } from "@/components/ui/SectionHead";

export function SearchView() {
  const q = useSearchParams().get("q") ?? "";
  const results = searchProducts(q);
  return (
    <>
      <div className="page-intro container">
        <div className="eyebrow">Search Zelvomart</div>
        <h1>{q ? <>Results for “{q}”</> : "Search products"}</h1>
        <p>{q ? `${results.length} product${results.length === 1 ? "" : "s"} found` : "Find exactly what you need."}</p>
        <div className="search-page-box">
          <SearchBox />
        </div>
      </div>
      <section className="section pt-sm">
        <div className="container">
          {results.length ? (
            <ProductGrid items={results} />
          ) : (
            <>
              {q && (
                <div className="empty-state">
                  <h2>No exact matches for “{q}”.</h2>
                  <p>Try a broader word, or browse a category:</p>
                  <div className="chips center">
                    {categories.map((c) => (
                      <Link key={c.id} href={categoryPath(c.id)}>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="section">
                <SectionHead title="Popular right now" href="/bestsellers/" linkLabel="Bestsellers" />
                <ProductGrid items={products.filter((p) => p.isBestseller).slice(0, 4)} />
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
