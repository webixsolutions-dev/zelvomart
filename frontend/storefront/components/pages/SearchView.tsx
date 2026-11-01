"use client";

import Link from "next/link";
import { categories, categoryPath, type Product } from "@store/lib/catalog";
import { ProductGrid } from "@store/components/product/ProductGrid";
import { SearchBox } from "@store/components/layout/SearchBox";
import { SectionHead } from "@store/components/ui/SectionHead";

/** Results come from the server (app/(store)/search/page.tsx: one limited backend query), not a browser scan. */
export function SearchView({ q, results, total, popular }: { q: string; results: Product[]; total: number; popular: Product[] }) {
  return (
    <>
      <div className="page-intro container">
        <div className="eyebrow">Search Zelvomart</div>
        <h1>{q ? <>Results for “{q}”</> : "Search products"}</h1>
        <p>{q ? `${total} product${total === 1 ? "" : "s"} found` : "Find exactly what you need."}</p>
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
                <ProductGrid items={popular} />
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
