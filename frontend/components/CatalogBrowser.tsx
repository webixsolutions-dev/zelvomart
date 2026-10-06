"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterIcon } from "@/components/Icons";
import type { Category } from "@/types/product";

type Props = {
  categories: Category[];
  currentCategory?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  sort: string;
  categoryMode?: "query" | "path";
  clearHref: string;
  children: ReactNode;
};

function safeNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function CatalogBrowser({
  categories,
  currentCategory = "",
  minPrice,
  maxPrice,
  availability = "",
  sort,
  categoryMode = "query",
  clearHref,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(minPrice == null ? "" : String(minPrice));
  const [max, setMax] = useState(maxPrice == null ? "" : String(maxPrice));

  const preserved = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  function navigateWith(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    const minValue = safeNumber(min);
    const maxValue = safeNumber(max);
    navigateWith({
      minPrice: minValue == null ? undefined : String(minValue),
      maxPrice: maxValue == null ? undefined : String(maxValue),
    });
    setOpen(false);
  }

  function categoryHref(slug: string) {
    if (categoryMode === "path") {
      const params = new URLSearchParams(preserved.toString());
      params.delete("page");
      params.delete("category");
      const query = params.toString();
      return `/product-category/${slug}/${query ? `?${query}` : ""}`;
    }
    const params = new URLSearchParams(preserved.toString());
    params.set("category", slug);
    params.delete("page");
    const query = params.toString();
    return `/shop?${query}`;
  }

  const filterPanel = (
    <div className="zm-filter-card">
      <div className="zm-filter-head">
        <strong>Filters</strong>
        <Link href={clearHref} onClick={() => setOpen(false)}>Clear all</Link>
      </div>
      <details open>
        <summary>Category</summary>
        <div className="zm-filter-category-list">
          {categories.map((category) => (
            <Link key={category.id} href={categoryHref(category.slug)} className={category.slug === currentCategory ? "active" : ""} onClick={() => setOpen(false)}>
              <span aria-hidden="true">{category.slug === currentCategory ? "■" : "□"}</span>
              {category.name}
            </Link>
          ))}
        </div>
      </details>
      <details open>
        <summary>Price</summary>
        <form className="zm-price-filter" onSubmit={applyPrice}>
          <div>
            <label><span>Min</span><input inputMode="numeric" type="number" min="0" placeholder="Rs 0" value={min} onChange={(event) => setMin(event.target.value)} /></label>
            <label><span>Max</span><input inputMode="numeric" type="number" min="0" placeholder="Rs 10,000+" value={max} onChange={(event) => setMax(event.target.value)} /></label>
          </div>
          <button type="submit">Apply price</button>
        </form>
      </details>
      <details open>
        <summary>Availability</summary>
        <label className="zm-stock-filter">
          <input type="checkbox" checked={availability === "instock"} onChange={(event) => navigateWith({ availability: event.target.checked ? "instock" : undefined })} />
          <span>In stock only</span>
        </label>
      </details>
    </div>
  );

  return (
    <div className="zm-catalog-browser">
      <aside className="zm-filter-desktop">{filterPanel}</aside>
      <div className="zm-catalog-main">
        <div className="zm-catalog-toolbar">
          <button type="button" className="zm-mobile-filter-button" onClick={() => setOpen(true)}>
            <FilterIcon size={17} /> Filters
          </button>
          <label className="zm-sort-control">
            <span className="sr-only">Sort products</span>
            <select value={sort} onChange={(event) => navigateWith({ sort: event.target.value === "popular" ? undefined : event.target.value })}>
              <option value="popular">Sort by popularity</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </label>
        </div>
        {children}
      </div>
      <div className={`zm-filter-drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <button type="button" className="zm-filter-backdrop" onClick={() => setOpen(false)} aria-label="Close filters" />
        <div className="zm-filter-drawer-panel">
          <div className="zm-filter-drawer-top"><b>Filter products</b><button type="button" onClick={() => setOpen(false)} aria-label="Close filters">×</button></div>
          {filterPanel}
        </div>
      </div>
    </div>
  );
}
