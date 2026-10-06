"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
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

const PRICE_CEILING = 10000;
const PRICE_STEP = 100;

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
  const [min, setMin] = useState(Math.min(PRICE_CEILING, minPrice ?? 0));
  const [max, setMax] = useState(Math.min(PRICE_CEILING, maxPrice ?? PRICE_CEILING));

  const preserved = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  function navigateWith(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    window.dispatchEvent(new Event("zelvo:route-start"));
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyPrice(nextMin: number, nextMax: number) {
    const safeMin = Math.max(0, Math.min(nextMin, nextMax));
    const safeMax = Math.min(PRICE_CEILING, Math.max(nextMin, nextMax));
    setMin(safeMin);
    setMax(safeMax);
    navigateWith({
      minPrice: safeMin > 0 ? String(safeMin) : undefined,
      maxPrice: safeMax < PRICE_CEILING ? String(safeMax) : undefined,
    });
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

  const rangeStart = Math.min(min, max);
  const rangeEnd = Math.max(min, max);
  const left = (rangeStart / PRICE_CEILING) * 100;
  const right = 100 - (rangeEnd / PRICE_CEILING) * 100;

  const filterPanel = (
    <div className="zm-filter-card">
      <div className="zm-filter-head">
        <strong>Filters</strong>
        <Link href={clearHref} onClick={() => setOpen(false)}>Clear all</Link>
      </div>
      <details open className="zm-price-details">
        <summary>Price</summary>
        <div className="zm-price-range">
          <div className="zm-price-range-values">
            <span>Rs {rangeStart.toLocaleString()}</span>
            <span>{rangeEnd >= PRICE_CEILING ? `Rs ${PRICE_CEILING.toLocaleString()}+` : `Rs ${rangeEnd.toLocaleString()}`}</span>
          </div>
          <div className="zm-price-range-track" style={{ "--range-left": `${left}%`, "--range-right": `${right}%` } as CSSProperties}>
            <span />
            <input
              aria-label="Minimum price"
              type="range"
              min="0"
              max={PRICE_CEILING}
              step={PRICE_STEP}
              value={rangeStart}
              onChange={(event) => setMin(Math.min(Number(event.target.value), rangeEnd - PRICE_STEP))}
              onPointerUp={(event) => applyPrice(Number(event.currentTarget.value), max)}
              onKeyUp={(event) => applyPrice(Number(event.currentTarget.value), max)}
            />
            <input
              aria-label="Maximum price"
              type="range"
              min="0"
              max={PRICE_CEILING}
              step={PRICE_STEP}
              value={rangeEnd}
              onChange={(event) => setMax(Math.max(Number(event.target.value), rangeStart + PRICE_STEP))}
              onPointerUp={(event) => applyPrice(min, Number(event.currentTarget.value))}
              onKeyUp={(event) => applyPrice(min, Number(event.currentTarget.value))}
            />
          </div>
        </div>
      </details>
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
