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

  const [min, setMin] = useState(
    Math.min(PRICE_CEILING, minPrice ?? 0)
  );

  const [max, setMax] = useState(
    Math.min(PRICE_CEILING, maxPrice ?? PRICE_CEILING)
  );

  const preserved = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams]
  );

  function navigateWith(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());

    params.delete("page");

    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();

    window.dispatchEvent(new Event("zelvo:route-start"));
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyPrice(nextMin: number, nextMax: number) {
    const safeMin = Math.max(0, Math.min(nextMin, nextMax));
    const safeMax = Math.min(
      PRICE_CEILING,
      Math.max(nextMin, nextMax)
    );

    setMin(safeMin);
    setMax(safeMax);

    navigateWith({
      minPrice: safeMin > 0 ? String(safeMin) : undefined,
      maxPrice:
        safeMax < PRICE_CEILING ? String(safeMax) : undefined,
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

    return `/shop?${params.toString()}`;
  }

  const rangeStart = Math.min(min, max);
  const rangeEnd = Math.max(min, max);

  const left = (rangeStart / PRICE_CEILING) * 100;
  const right = 100 - (rangeEnd / PRICE_CEILING) * 100;

  const filterPanel = (
    <div className="zm-filter-card">
      <div className="zm-filter-head">
        <div>
          <strong>Filters</strong>
          <small>Refine products</small>
        </div>

        <Link href={clearHref} onClick={() => setOpen(false)}>
          Clear all
        </Link>
      </div>

      <details open className="zm-price-details">
        <summary>Price</summary>

        <div className="zm-price-range">
          <div className="zm-price-range-values">
            <span>Rs {rangeStart.toLocaleString()}</span>
            <span>
              {rangeEnd >= PRICE_CEILING
                ? `Rs ${PRICE_CEILING.toLocaleString()}+`
                : `Rs ${rangeEnd.toLocaleString()}`}
            </span>
          </div>

          <div
            className="zm-price-range-track"
            style={
              {
                "--range-left": `${left}%`,
                "--range-right": `${right}%`,
              } as CSSProperties
            }
          >
            <span />

            <input
              aria-label="Minimum price"
              type="range"
              min="0"
              max={PRICE_CEILING}
              step={PRICE_STEP}
              value={rangeStart}
              onChange={(event) =>
                setMin(
                  Math.min(
                    Number(event.target.value),
                    rangeEnd - PRICE_STEP
                  )
                )
              }
              onPointerUp={(event) =>
                applyPrice(Number(event.currentTarget.value), max)
              }
              onKeyUp={(event) =>
                applyPrice(Number(event.currentTarget.value), max)
              }
            />

            <input
              aria-label="Maximum price"
              type="range"
              min="0"
              max={PRICE_CEILING}
              step={PRICE_STEP}
              value={rangeEnd}
              onChange={(event) =>
                setMax(
                  Math.max(
                    Number(event.target.value),
                    rangeStart + PRICE_STEP
                  )
                )
              }
              onPointerUp={(event) =>
                applyPrice(min, Number(event.currentTarget.value))
              }
              onKeyUp={(event) =>
                applyPrice(min, Number(event.currentTarget.value))
              }
            />
          </div>
        </div>
      </details>

      <details open>
        <summary>Category</summary>

        <div className="zm-filter-category-list">
          {categories.map((category) => {
            const active = category.slug === currentCategory;

            return (
              <Link
                key={category.id}
                href={categoryHref(category.slug)}
                className={active ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true">
                  {active ? "●" : "○"}
                </span>

                <b>{category.name}</b>
              </Link>
            );
          })}
        </div>
      </details>

      <details open>
        <summary>Availability</summary>

        <label className="zm-stock-filter">
          <input
            type="checkbox"
            checked={availability === "instock"}
            onChange={(event) =>
              navigateWith({
                availability: event.target.checked
                  ? "instock"
                  : undefined,
              })
            }
          />

          <span>In stock only</span>
        </label>
      </details>
    </div>
  );

  return (
    <div className="zm-catalog-browser">
      <aside className="zm-filter-desktop">
        {filterPanel}
      </aside>

      <div className="zm-catalog-main">
        <div className="zm-catalog-toolbar">
          <button
            type="button"
            className="zm-mobile-filter-button"
            onClick={() => setOpen(true)}
          >
            <FilterIcon size={17} />
            Filters
          </button>

          <label className="zm-sort-control">
            <span className="sr-only">Sort products</span>

            <select
              value={sort}
              onChange={(event) =>
                navigateWith({
                  sort:
                    event.target.value === "popular"
                      ? undefined
                      : event.target.value,
                })
              }
            >
              <option value="popular">Sort by popularity</option>
              <option value="newest">Newest</option>
              <option value="price-asc">
                Price: Low to High
              </option>
              <option value="price-desc">
                Price: High to Low
              </option>
            </select>
          </label>
        </div>

        {children}
      </div>

      <div
        className={`zm-filter-drawer ${open ? "is-open" : ""}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="zm-filter-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close filters"
        />

        <div className="zm-filter-drawer-panel">
          <span className="zm-filter-drawer-handle" aria-hidden="true" />
          <div className="zm-filter-drawer-top">
            <b>Filter products</b>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
            >
              ×
            </button>
          </div>

          {filterPanel}
        </div>
      </div>

      <style jsx global>{`
        .zm-catalog-browser {
          align-items: start;
          grid-template-columns: 230px minmax(0, 1fr) !important;
          gap: 30px !important;
          padding-top: 0 !important;
        }

        .zm-filter-desktop {
          position: sticky;
          top: 120px;
          align-self: start;
        }

        .zm-filter-card {
          overflow: hidden;
          padding: 0 16px 8px;
          border: 1px solid #dce6eb !important;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 8px 28px rgba(14, 47, 65, .05);
        }

        .zm-filter-head {
          min-height: 58px !important;
          margin: 0 -16px !important;
          padding: 0 16px;
          background: #f7fafb;
          border-bottom: 1px solid #e1e9ed !important;
        }

        .zm-filter-head > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .zm-filter-head strong {
          color: #102d3e !important;
          font-size: 15px !important;
          font-weight: 900 !important;
        }

        .zm-filter-head small {
          color: #80909a;
          font-size: 10px;
          font-weight: 650;
        }

        .zm-filter-head a {
          color: #0b91c8 !important;
          font-size: 11px !important;
          font-weight: 800;
          text-decoration: none !important;
        }

        .zm-filter-card details {
          padding: 14px 0 !important;
        }

        .zm-filter-card summary {
          color: #102d3e !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .zm-filter-category-list {
          gap: 3px !important;
          margin-top: 10px !important;
        }

        .zm-filter-category-list a {
          min-height: 34px;
          padding: 7px 8px !important;
          border-radius: 8px;
          color: #526978 !important;
          font-size: 12px !important;
          transition:
            background .16s ease,
            color .16s ease;
        }

        .zm-filter-category-list a span {
          width: 12px;
          color: #0aa1da !important;
          font-size: 10px !important;
        }

        .zm-filter-category-list a b {
          font-weight: 650;
        }

        .zm-filter-category-list a:hover {
          background: #f2f8fb;
          color: #0a8fc5 !important;
        }

        .zm-filter-category-list a.active {
          background: #eaf7fc;
          color: #078fc8 !important;
        }

        .zm-filter-category-list a.active b {
          font-weight: 900;
        }

        .zm-price-range-values {
          margin-bottom: 10px !important;
          color: #657d8b !important;
          font-size: 11px !important;
        }

        .zm-price-range-track {
          height: 22px !important;
        }

        .zm-price-range-track:before,
        .zm-price-range-track > span {
          top: 9px !important;
          height: 4px !important;
        }

        .zm-stock-filter {
          min-height: 36px;
          margin-top: 9px !important;
          padding: 7px 8px;
          border-radius: 8px;
          background: #f8fbfc;
        }

        .zm-stock-filter span {
          color: #4f6573;
          font-size: 12px;
          font-weight: 700;
        }

        .zm-catalog-toolbar {
          min-height: 54px !important;
          margin-bottom: 18px !important;
          padding-bottom: 12px;
          border-bottom: 1px solid #e6edf1;
        }

        .zm-sort-control {
          width: 245px !important;
        }

        .zm-sort-control select {
          height: 44px !important;
          border: 1px solid #cfdae0 !important;
          border-radius: 10px !important;
          background: #fff !important;
          color: #17384c !important;
          font-size: 12.5px !important;
          font-weight: 750 !important;
        }

        .mock-listing-count {
          margin-top: 22px;
          color: #748692;
          font-size: 12px;
          font-weight: 650;
          text-align: center;
        }

        @media (max-width: 820px) {
          .zm-catalog-browser {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }

          .zm-catalog-toolbar {
            grid-template-columns: 108px minmax(0, 1fr) !important;
            gap: 9px !important;
            min-height: 46px !important;
            margin-bottom: 14px !important;
            padding-bottom: 10px;
          }

          .zm-mobile-filter-button,
          .zm-sort-control select {
            height: 42px !important;
          }

          .zm-filter-drawer-panel {
            width: 100% !important;
            max-height: min(82vh, 680px) !important;
            padding: 8px 16px calc(22px + env(safe-area-inset-bottom)) !important;
            border-radius: 22px 22px 0 0 !important;
            transform: translateY(110%);
            transition: transform .42s cubic-bezier(.22, 1, .36, 1) !important;
          }

          .zm-filter-drawer.is-open .zm-filter-drawer-panel {
            transform: translateY(0) !important;
          }

          .zm-filter-drawer .zm-filter-card {
            padding: 0;
            border: 0 !important;
            border-radius: 0;
            box-shadow: none;
          }

          .zm-filter-drawer .zm-filter-head {
            display: none !important;
          }

          .zm-filter-drawer .zm-filter-category-list a {
            min-height: 38px;
          }
        }
      `}</style>
    </div>
  );
}
