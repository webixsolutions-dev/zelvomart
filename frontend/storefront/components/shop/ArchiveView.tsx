"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { categories, getCategory, type CategoryId, type Product, categoryPath } from "@store/lib/catalog";
import { archiveHref, pageWindow, PRICE_CAP, type ArchiveParams, type ArchiveSort } from "@store/lib/archive";
import { site } from "@store/lib/site";
import { waLink } from "@store/lib/format";
import { ProductGrid } from "@store/components/product/ProductGrid";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";

const PRICE_STEP = 100;
const categoryOrder: CategoryId[] = ["home-living", "home-decor", "beauty", "tech", "kids", "fashion", "fitness"];

function moneyLabel(n: number) {
  const text = `Rs ${n.toLocaleString("en-PK")}`;
  return n >= PRICE_CAP ? `${text}+` : text;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`filter-block ${open ? "open" : ""}`}>
      <button type="button" className="filter-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ChevronDown size={16} />
        <span>{title}</span>
      </button>
      {open && <div className="filter-body">{children}</div>}
    </div>
  );
}

function PriceRange({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const minPct = (min / PRICE_CAP) * 100;
  const maxPct = (max / PRICE_CAP) * 100;
  return (
    <div className="price-filter">
      <div className="price-scale">
        <span>{moneyLabel(min)}</span>
        <span>{moneyLabel(max)}</span>
      </div>
      <div className="range-wrap">
        <span className="range-track" />
        <span className="range-fill" style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }} />
        <input
          type="range"
          min={0}
          max={PRICE_CAP}
          step={PRICE_STEP}
          value={min}
          aria-label="Minimum price"
          style={{ zIndex: min >= max - PRICE_STEP ? 5 : 3 }}
          onChange={(e) => onChange(Math.min(Number(e.target.value), max - PRICE_STEP), max)}
        />
        <input
          type="range"
          min={0}
          max={PRICE_CAP}
          step={PRICE_STEP}
          value={max}
          aria-label="Maximum price"
          style={{ zIndex: 4 }}
          onChange={(e) => onChange(min, Math.max(Number(e.target.value), min + PRICE_STEP))}
        />
      </div>
    </div>
  );
}

/** A listing with no products at all yet (not filtered to zero): no count, filters or sort, just a way on. */
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="empty-state archive-coming-soon">
      <h3>New {name} picks are on the way.</h3>
      <p>
        We’re adding products to this category right now. Until then, explore what’s already in store, or message us on WhatsApp if
        you’re looking for something specific.
      </p>
      <div className="archive-coming-soon-actions">
        <Link href="/shop/" className="btn">
          Shop all products <ArrowRight size={16} />
        </Link>
        <a
          className="btn ghost"
          href={waLink(site.whatsappNumber, `Hi Zelvomart! I'm looking for something in ${name}.`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon size={17} /> Ask on WhatsApp
        </a>
      </div>
    </div>
  );
}

/**
 * One listing page (24 products) rendered on the server; filters, sort and page number live in the URL
 * (lib/archive.ts), so changing them loads that page from the server instead of filtering a full catalog here.
 * `heading` adds an H2 above the grid (e.g. "Shop Home & Living"); without it only the product count shows, so the page H1 is not repeated.
 * `name` is what the "on the way" state calls the listing when it has no products yet (defaults to the locked category's name).
 */
export function ArchiveView({
  items,
  total,
  totalPages,
  params,
  basePath,
  heading,
  lockedCategory,
  name,
}: {
  items: Product[];
  total: number;
  totalPages: number;
  params: ArchiveParams;
  basePath: string;
  heading?: string;
  lockedCategory?: CategoryId;
  name?: string;
}) {
  const router = useRouter();
  const top = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState(false);
  // The slider moves freely; the page is asked for once the shopper stops dragging.
  const [price, setPriceState] = useState({ min: params.min, max: params.max });
  useEffect(() => setPriceState({ min: params.min, max: params.max }), [params.min, params.max]);
  const priceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const category = lockedCategory ?? params.category;
  const orderedCategories = categoryOrder
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is (typeof categories)[number] => Boolean(c));

  const priceActive = params.min > 0 || params.max < PRICE_CAP;
  const categoryActive = !lockedCategory && Boolean(params.category);
  const activeCount = (categoryActive ? 1 : 0) + (priceActive ? 1 : 0) + (params.stock ? 1 : 0);

  /** Open the listing with changed params (filters reset the page to 1) and keep the grid in view. */
  const go = (change: Partial<ArchiveParams>, keepPage = false) => {
    const href = archiveHref(basePath, params, keepPage ? change : { ...change, page: 1 });
    startTransition(() => router.push(href, { scroll: false }));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setPrice = (min: number, max: number) => {
    setPriceState({ min, max });
    clearTimeout(priceTimer.current);
    priceTimer.current = setTimeout(() => go({ min, max }), 500);
  };

  const pickCategory = (id: string) => {
    if (lockedCategory) {
      if (id !== lockedCategory) router.push(categoryPath(id));
      return;
    }
    go({ category: id as CategoryId });
  };

  const reset = () => go({ category: lockedCategory ? params.category : null, min: 0, max: PRICE_CAP, stock: false });

  const filters = (scope: string) => (
    <>
      <FilterGroup title="Price">
        <PriceRange min={price.min} max={price.max} onChange={setPrice} />
      </FilterGroup>
      <FilterGroup title="Category">
        {orderedCategories.map((c) => {
          const selected = category === c.id;
          return (
            <label
              className={`filter-choice ${selected ? "active" : ""}`}
              key={c.id}
              onClick={() => {
                if (!lockedCategory && params.category === c.id) go({ category: null });
              }}
            >
              <input type="radio" name={`filter-category-${scope}`} checked={selected} onChange={() => pickCategory(c.id)} />
              <span>{c.name}</span>
            </label>
          );
        })}
      </FilterGroup>
      <FilterGroup title="Availability">
        <label className={`filter-choice check ${params.stock ? "active" : ""}`}>
          <input type="checkbox" checked={params.stock} onChange={(e) => go({ stock: e.target.checked })} />
          <span>In stock only</span>
        </label>
      </FilterGroup>
    </>
  );

  // No products at all yet (not filtered to zero): no count, filters or sort, just a way on.
  if (!total && !activeCount) {
    return (
      <div className="archive-wrap is-empty">
        <div>
          {heading && (
            <div className="archive-toolbar">
              <div>
                <h2>{heading}</h2>
              </div>
            </div>
          )}
          <ComingSoon name={name || (lockedCategory ? getCategory(lockedCategory)?.name : undefined) || "new"} />
        </div>
      </div>
    );
  }

  return (
    <div className="archive-wrap" ref={top} style={{ scrollMarginTop: 96 }}>
      <aside className="sidebar" aria-label="Filters">
        <div className="sidebar-head">
          <h3>Filter</h3>
          {activeCount > 0 && (
            <button type="button" className="link-btn" onClick={reset}>
              Clear all
            </button>
          )}
        </div>
        {filters("side")}
      </aside>

      <div aria-busy={pending}>
        <div className="archive-toolbar">
          <div>
            {heading && <h2>{heading}</h2>}
            <p>
              {total} product{total === 1 ? "" : "s"}
            </p>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="btn ghost sm filter-trigger" onClick={() => setSheet(true)}>
              <SlidersHorizontal size={15} /> Filter{activeCount ? ` (${activeCount})` : ""}
            </button>
            <label className="sort">
              <span className="sr-only">Sort products</span>
              <select value={params.sort} onChange={(e) => go({ sort: e.target.value as ArchiveSort })}>
                <option value="featured">Sort: Featured</option>
                <option value="low">Price: Low to High</option>
                <option value="high">Price: High to Low</option>
                <option value="discount">Biggest saving</option>
                <option value="name">Name: A to Z</option>
              </select>
            </label>
          </div>
        </div>

        {activeCount > 0 && (
          <div className="chips">
            {categoryActive && params.category && (
              <button type="button" onClick={() => go({ category: null })}>
                {getCategory(params.category)?.name} <X size={13} />
              </button>
            )}
            {priceActive && (
              <button type="button" onClick={() => go({ min: 0, max: PRICE_CAP })}>
                {moneyLabel(params.min)} – {moneyLabel(params.max)} <X size={13} />
              </button>
            )}
            {params.stock && (
              <button type="button" onClick={() => go({ stock: false })}>
                In stock only <X size={13} />
              </button>
            )}
            <button type="button" className="clear" onClick={reset}>
              Clear all
            </button>
          </div>
        )}

        {items.length ? (
          <div style={pending ? { opacity: 0.55, transition: "opacity .15s" } : undefined}>
            <ProductGrid items={items} cols={3} priorityCount={3} />
          </div>
        ) : (
          <div className="empty-state">
            <h3>No products match these filters.</h3>
            <p>Try removing a filter to see more.</p>
            <button type="button" className="btn" onClick={reset}>
              Clear filters
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            {params.page > 1 && (
              <Link href={archiveHref(basePath, params, { page: params.page - 1 })} scroll={false} onClick={() => top.current?.scrollIntoView({ behavior: "smooth" })} rel="prev" aria-label="Previous page">
                ‹ Prev
              </Link>
            )}
            {pageWindow(params.page, totalPages).map((n, i) =>
              n == null ? (
                <span key={`gap-${i}`} className="gap" aria-hidden="true">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={archiveHref(basePath, params, { page: n })}
                  scroll={false}
                  onClick={() => top.current?.scrollIntoView({ behavior: "smooth" })}
                  className={params.page === n ? "current" : ""}
                  aria-current={params.page === n ? "page" : undefined}
                  aria-label={`Page ${n}`}
                >
                  {n}
                </Link>
              ),
            )}
            {params.page < totalPages && (
              <Link href={archiveHref(basePath, params, { page: params.page + 1 })} scroll={false} onClick={() => top.current?.scrollIntoView({ behavior: "smooth" })} rel="next" aria-label="Next page">
                Next ›
              </Link>
            )}
          </nav>
        )}
      </div>

      <div className={`drawer-backdrop ${sheet ? "show" : ""}`} onClick={() => setSheet(false)} aria-hidden="true" />
      <div className={`sheet ${sheet ? "open" : ""}`} role="dialog" aria-label="Filters" aria-hidden={!sheet}>
        <div className="drawer-head">
          <h2>Filters</h2>
          <button className="icon-btn" type="button" aria-label="Close filters" onClick={() => setSheet(false)}>
            <X size={22} />
          </button>
        </div>
        <div className="sheet-body">{filters("sheet")}</div>
        <div className="sheet-foot">
          <button type="button" className="btn ghost" onClick={reset}>
            Clear
          </button>
          <button type="button" className="btn" onClick={() => setSheet(false)}>
            Show {total} products
          </button>
        </div>
      </div>
    </div>
  );
}
