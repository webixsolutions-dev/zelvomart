"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { categories, getCategory, products, type CategoryId, categoryPath } from "@store/lib/catalog";
import { site } from "@store/lib/site";
import { waLink } from "@store/lib/format";
import { ProductGrid } from "@store/components/product/ProductGrid";
import { WhatsAppIcon } from "@store/components/ui/BrandIcons";

type Sort = "featured" | "low" | "high" | "name" | "discount";

const PRICE_CAP = 10000;
const PRICE_STEP = 100;
const PAGE = 12;
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
 * `heading` adds an H2 above the grid (e.g. "Shop Home & Living"); without it only the product count shows, so the page H1 is not repeated.
 * `name` is what the "on the way" state calls the listing when it has no products yet (defaults to the locked category's name).
 */
export function ArchiveView({ ids, heading, lockedCategory, name }: { ids: string[]; heading?: string; lockedCategory?: CategoryId; name?: string }) {
  const router = useRouter();
  const base = useMemo(() => products.filter((p) => ids.includes(p.id)), [ids]);
  const [category, setCategory] = useState<string | null>(lockedCategory ?? null);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(PRICE_CAP);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState(false);

  const orderedCategories = categoryOrder
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is (typeof categories)[number] => Boolean(c));

  const priceActive = minPrice > 0 || maxPrice < PRICE_CAP;
  const categoryActive = !lockedCategory && Boolean(category);

  const list = useMemo(() => {
    let a = [...base];
    if (!lockedCategory && category) a = a.filter((p) => p.category === category);
    a = a.filter((p) => p.price >= minPrice && (maxPrice >= PRICE_CAP || p.price <= maxPrice));
    if (inStockOnly) a = a.filter((p) => p.inStock !== false);
    if (sort === "low") a.sort((x, y) => x.price - y.price);
    if (sort === "high") a.sort((x, y) => y.price - x.price);
    if (sort === "name") a.sort((x, y) => x.name.localeCompare(y.name));
    if (sort === "discount") a.sort((x, y) => (y.compare ? (y.compare - y.price) / y.compare : 0) - (x.compare ? (x.compare - x.price) / x.compare : 0));
    return a;
  }, [base, category, lockedCategory, minPrice, maxPrice, inStockOnly, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice((page - 1) * PAGE, page * PAGE);
  const activeCount = (categoryActive ? 1 : 0) + (priceActive ? 1 : 0) + (inStockOnly ? 1 : 0);

  const setPrice = (min: number, max: number) => {
    setMinPrice(min);
    setMaxPrice(max);
    setPage(1);
  };

  const pickCategory = (id: string) => {
    if (lockedCategory) {
      if (id !== lockedCategory) router.push(categoryPath(id));
      return;
    }
    setCategory(id);
    setPage(1);
  };

  const reset = () => {
    if (!lockedCategory) setCategory(null);
    setMinPrice(0);
    setMaxPrice(PRICE_CAP);
    setInStockOnly(false);
    setPage(1);
  };

  const filters = (scope: string) => (
    <>
      <FilterGroup title="Price">
        <PriceRange min={minPrice} max={maxPrice} onChange={setPrice} />
      </FilterGroup>
      <FilterGroup title="Category">
        {orderedCategories.map((c) => {
          const selected = (lockedCategory ?? category) === c.id;
          return (
            <label
              className={`filter-choice ${selected ? "active" : ""}`}
              key={c.id}
              onClick={() => {
                if (!lockedCategory && category === c.id) {
                  setCategory(null);
                  setPage(1);
                }
              }}
            >
              <input type="radio" name={`filter-category-${scope}`} checked={selected} onChange={() => pickCategory(c.id)} />
              <span>{c.name}</span>
            </label>
          );
        })}
      </FilterGroup>
      <FilterGroup title="Availability">
        <label className={`filter-choice check ${inStockOnly ? "active" : ""}`}>
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              setInStockOnly(e.target.checked);
              setPage(1);
            }}
          />
          <span>In stock only</span>
        </label>
      </FilterGroup>
    </>
  );

  if (!base.length) {
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
    <div className="archive-wrap">
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

      <div>
        <div className="archive-toolbar">
          <div>
            {heading && <h2>{heading}</h2>}
            <p>
              {list.length} product{list.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="btn ghost sm filter-trigger" onClick={() => setSheet(true)}>
              <SlidersHorizontal size={15} /> Filter{activeCount ? ` (${activeCount})` : ""}
            </button>
            <label className="sort">
              <span className="sr-only">Sort products</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
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
            {categoryActive && category && (
              <button type="button" onClick={() => (setCategory(null), setPage(1))}>
                {getCategory(category)?.name} <X size={13} />
              </button>
            )}
            {priceActive && (
              <button type="button" onClick={() => setPrice(0, PRICE_CAP)}>
                {moneyLabel(minPrice)} – {moneyLabel(maxPrice)} <X size={13} />
              </button>
            )}
            {inStockOnly && (
              <button type="button" onClick={() => (setInStockOnly(false), setPage(1))}>
                In stock only <X size={13} />
              </button>
            )}
            <button type="button" className="clear" onClick={reset}>
              Clear all
            </button>
          </div>
        )}

        {shown.length ? (
          <ProductGrid items={shown} cols={3} priorityCount={3} />
        ) : (
          <div className="empty-state">
            <h3>No products match these filters.</h3>
            <p>Try removing a filter to see more.</p>
            <button type="button" className="btn" onClick={reset}>
              Clear filters
            </button>
          </div>
        )}

        {pages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" className={page === i + 1 ? "current" : ""} onClick={() => setPage(i + 1)}>
                {i + 1}
              </button>
            ))}
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
            Show {list.length} products
          </button>
        </div>
      </div>
    </div>
  );
}
