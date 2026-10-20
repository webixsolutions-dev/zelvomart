import type { Metadata } from "next";
import Link from "next/link";
import { categories, categoryPath, products } from "@/lib/catalog";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SearchBox } from "@/components/layout/SearchBox";

// Next.js marks the not-found page noindex itself.
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="section">
      <div className="container">
        <div className="empty-state not-found">
          <div className="not-found-code">
            404
          </div>
          <h1>We couldn’t find that page.</h1>
          <p>Search the shop or choose one of the top categories below.</p>
          <div className="search-page-box">
            <SearchBox />
          </div>
          <ul className="not-found-chips" aria-label="Top categories">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={categoryPath(c.id)}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="section">
          <ProductGrid items={products.filter((p) => p.isBestseller).slice(0, 4)} />
        </div>
      </div>
    </section>
  );
}
