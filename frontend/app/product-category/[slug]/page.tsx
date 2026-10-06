import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGrid from "@/components/ProductGrid";
import StorePagination from "@/components/StorePagination";
import CatalogBrowser from "@/components/CatalogBrowser";
import { getCategories, getProducts } from "@/lib/store";

export const revalidate = 120;

const v = (x: string | string[] | undefined) => Array.isArray(x) ? x[0] : x || "";
const n = (x: string | string[] | undefined) => {
  const value = Number(v(x));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCategories()).find((x) => x.slug === slug);
  return c ? { title: c.seoTitle || c.name, description: c.seoDescription || c.description || `Shop ${c.name} at Zelvomart.` } : {};
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const sortRaw = v(sp.sort);
  const sort = sortRaw === "newest" || sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "popular";
  const page = Math.max(1, Number(v(sp.page)) || 1);
  const minPrice = n(sp.minPrice);
  const maxPrice = n(sp.maxPrice);
  const availability = v(sp.availability) === "instock" ? "instock" : "";

  const result = await getProducts({
    category: slug,
    sort,
    page,
    limit: 12,
    minPrice,
    maxPrice,
    availability: availability || undefined,
  });

  return (
    <div className="mock-category-page">
      <section className="site-shell mock-category-hero">
        <div>
          <nav>Home <span>›</span> {category.name}</nav>
          <span className="mock-eyebrow">SHOP THE COLLECTION</span>
          <h1>{category.name}</h1>
          <p>{category.description || `Useful ${category.name.toLowerCase()} picks, checked and ready for Cash on Delivery.`}</p>
        </div>
        <div className="mock-category-hero-art"><Image src={category.image || `/images/categories/${category.slug}.webp`} alt={category.name} fill /></div>
      </section>

      <section className="site-shell">
        <Suspense fallback={<div className="mock-catalog-browser-loading" aria-hidden="true" />}>
        <CatalogBrowser
          categories={categories}
          currentCategory={slug}
          minPrice={minPrice}
          maxPrice={maxPrice}
          availability={availability}
          sort={sort}
          categoryMode="path"
          clearHref={`/product-category/${slug}/`}
        >
          <ProductGrid products={result.items} />
          <div className="mock-listing-count">Showing {result.items.length} of {result.total || result.items.length} products</div>
          <StorePagination
            currentPage={result.page || page}
            totalPages={result.totalPages || 1}
            basePath={`/product-category/${slug}/`}
            query={{
              sort: sort !== "popular" ? sort : undefined,
              minPrice,
              maxPrice,
              availability: availability || undefined,
            }}
          />
        </CatalogBrowser>
        </Suspense>
      </section>

      <section className="mock-category-about">
        <div className="site-shell">
          <span className="mock-eyebrow">ABOUT THE COLLECTION</span>
          <div className="mock-category-about-grid">
            <div className="mock-category-about-copy">
              <h2>Why shop {category.name} at Zelvomart?</h2>
              <p><strong>Useful picks, clearly presented.</strong> {category.description || `Our ${category.name.toLowerCase()} selection focuses on useful products with clear descriptions, straightforward prices and dependable support.`}</p>
            </div>
            <div className="mock-category-about-faq">
              <details open><summary>Checked before dispatch</summary><p>Eligible products are checked before they leave us.</p></details>
              <details><summary>Cash on Delivery</summary><p>Available across Pakistan for a simple, familiar checkout.</p></details>
              <details><summary>Need help choosing?</summary><p>Chat with us on WhatsApp for quick product guidance.</p></details>
            </div>
          </div>
        </div>
      </section>

      <section className="site-shell mock-other-cats">
        <div className="mock-section-head"><h2>Explore other categories</h2></div>
        <div>
          {categories.filter((c) => c.slug !== slug).slice(0, 6).map((c) => (
            <Link key={c.id} href={`/product-category/${c.slug}/`}>
              <span><Image src={c.image || `/images/categories/${c.slug}.webp`} alt={c.name} fill /></span>
              <b>{c.name}</b>
            </Link>
          ))}
        </div>
      </section>
      
    </div>
  );
}
