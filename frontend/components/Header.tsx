"use client";

import "./Header.css";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import {
  BeautyCategoryIcon,
  CartIcon,
  DecorCategoryIcon,
  FashionCategoryIcon,
  HomeCategoryIcon,
  KidsCategoryIcon,
  MenuIcon,
  SearchIcon,
  SportsCategoryIcon,
  TechCategoryIcon,
  UserIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/Icons";
import { DEFAULT_WHATSAPP_NUMBER, trackWhatsAppTap, whatsappHelpHref } from "@/components/FloatingWhatsApp";
import { useCart } from "@/components/CartProvider";
import type { MenuProduct } from "@/lib/store";
import type { Category } from "@/types/product";

const CATEGORY_ORDER = [
  "Home & Living",
  "Home Decor",
  "Beauty & Personal Care",
  "Tech & Gadgets",
  "Fashion Accessories",
  "Sports & Fitness",
  "Kids & Toys",
];

const normalize = (value: string) =>
  value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

const slugify = (value: string) =>
  value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function PackageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 1 1 3.8 1.9c-.9.6-1.6 1-1.6 2.1M12 17h.01" />
    </svg>
  );
}

function CategoryIcon({ slug, size = 21 }: { slug: string; size?: number }) {
  switch (slug) {
    case "home-living":
      return <HomeCategoryIcon size={size} />;
    case "home-decor":
      return <DecorCategoryIcon size={size} />;
    case "beauty-personal-care":
      return <BeautyCategoryIcon size={size} />;
    case "tech-gadgets":
      return <TechCategoryIcon size={size} />;
    case "fashion-accessories":
      return <FashionCategoryIcon size={size} />;
    case "sports-fitness":
      return <SportsCategoryIcon size={size} />;
    case "kids-toys":
      return <KidsCategoryIcon size={size} />;
    default:
      return <HomeCategoryIcon size={size} />;
  }
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CategoryMenu({
  categories,
  products,
  activeCategory,
  onNavigate,
}: {
  categories: { id: string; name: string; slug: string }[];
  products: MenuProduct[];
  activeCategory: string;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState("all");
  const rootRef = useRef<HTMLDivElement>(null);
  const openedByHover = useRef(false);
  const activeName = categories.find((category) => category.slug === activeCategory)?.name || "Categories";
  const hoveredName = hovered === "all"
    ? "All Products"
    : categories.find((category) => category.slug === hovered)?.name || "Products";
  const visibleProducts = hovered === "all"
    ? products
    : products.filter((product) => product.categorySlugs.includes(hovered));

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate();
  };

  return (
    <div
      className={`zm-cat-menu${open ? " is-open" : ""}`}
      ref={rootRef}
      onMouseEnter={() => {
        openedByHover.current = true;
        setHovered("all");
        setOpen(true);
      }}
      onMouseLeave={() => {
        openedByHover.current = false;
        setOpen(false);
      }}
    >
      <button
        type="button"
        className="zm-cat-menu-button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Browse categories"
        onClick={() => {
          if (openedByHover.current) {
            openedByHover.current = false;
            return;
          }
          setHovered("all");
          setOpen((value) => !value);
        }}
      >
        <span>{activeName}</span>
        <ChevronIcon />
      </button>

      <div className="zm-cat-dropdown" role="region" aria-label="Category and product menu">
        <div className="zm-cat-dropdown-list" role="menu">
          <Link
            href="/shop"
            role="menuitem"
            className={hovered === "all" ? "is-active" : ""}
            onMouseEnter={() => setHovered("all")}
            onFocus={() => setHovered("all")}
            onClick={close}
          >
            All Products
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${encodeURIComponent(category.slug)}`}
              role="menuitem"
              className={hovered === category.slug ? "is-active" : ""}
              onMouseEnter={() => setHovered(category.slug)}
              onFocus={() => setHovered(category.slug)}
              onClick={close}
            >
              {category.name}
            </Link>
          ))}
        </div>

        <div className="zm-cat-dropdown-products">
          <b>{hoveredName}</b>
          {visibleProducts.length ? (
            visibleProducts.map((product) => (
              <Link key={product.slug} href={`/product/${product.slug}/`} onClick={close}>
                {product.name}
              </Link>
            ))
          ) : (
            <p>No products in this category yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const ANNOUNCEMENTS = [
  "Quality Checked Before Dispatch",
  "Order via WhatsApp or Website",
  "Cash on Delivery Across Pakistan",
  "Free Delivery on Orders Above Rs 8,000",
];

export default function Header({
  categories,
  products = [],
  whatsapp = DEFAULT_WHATSAPP_NUMBER,
}: {
  categories: Category[];
  products?: MenuProduct[];
  announcementItems?: string[];
  phone?: string;
  whatsapp?: string;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const whatsappHref = whatsappHelpHref(whatsapp, pathname);
  const { totalItems, setOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const activeCategory = searchParams.get("category")
    || pathname.match(/^\/product-category\/([^/]+)/)?.[1]
    || "";

  const orderedCategories = useMemo(() => {
    const used = new Set<string>();

    const preferred = CATEGORY_ORDER.map((wanted) => {
      const wantedKey = normalize(wanted);
      const match = categories.find((category) => {
        const id = String(category.id || category.slug);
        if (used.has(id)) return false;

        const nameKey = normalize(category.name || "");
        const slugKey = normalize(category.slug || "");

        return (
          nameKey === wantedKey ||
          slugKey === wantedKey ||
          nameKey.includes(wantedKey) ||
          wantedKey.includes(nameKey)
        );
      });

      if (match) used.add(String(match.id || match.slug));

      return {
        id: match?.id || slugify(wanted),
        name: match?.name || wanted,
        slug: match?.slug || slugify(wanted),
      };
    });

    const extras = categories
      .filter((category) => !used.has(String(category.id || category.slug)))
      .map((category) => ({
        id: category.id || category.slug,
        name: category.name,
        slug: category.slug,
      }));

    return [...preferred, ...extras];
  }, [categories]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const q = String(data.get("q") || "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (activeCategory) params.set("category", activeCategory);
    const query = params.toString();

    window.dispatchEvent(new Event("zelvo:route-start"));
    router.push(query ? `/shop?${query}` : "/shop");
    setMobileOpen(false);
  };

  useEffect(() => {
    const brand = brandRef.current;
    const search = searchRef.current;
    const nav = navRef.current;
    if (!brand || !search || !nav) return;

    const sync = () => {
      if (window.innerWidth < 901) {
        search.style.width = "";
        search.style.maxWidth = "";
        search.style.flex = "";
        return;
      }

      const main = brand.parentElement;
      const shell = main?.closest<HTMLElement>(".site-shell");
      const gap = main ? Number.parseFloat(getComputedStyle(main).columnGap || "0") || 0 : 0;
      const actions = main?.querySelector<HTMLElement>(".zm-header-actions");
      const brandWidth = brand.getBoundingClientRect().width;
      const actionsWidth = actions?.getBoundingClientRect().width ?? 0;
      const shellWidth = shell?.getBoundingClientRect().width ?? 0;
      const available = shellWidth - brandWidth - actionsWidth - gap * 3 - 20;
      const next = Math.min(500, Math.max(220, Math.round(available)));

      search.style.flex = "0 0 auto";
      if (search.style.width !== `${next}px`) {
        search.style.width = `${next}px`;
        search.style.maxWidth = `${next}px`;
      }
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(nav);
    observer.observe(brand);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [orderedCategories]);

  const announcementGroup = ANNOUNCEMENTS.map((text, index) => (
    <span className="zm-ticker-item" key={`${text}-${index}`}>
      {index === 0 ? "✓" : index === 1 ? "💬" : index === 2 ? "🚚" : "📦"}
      <b>{text}</b>
    </span>
  ));

  return (
    <>
      <div className="zm-ticker" aria-label="Store announcements">
        <div className="zm-ticker-track">
          <div className="zm-ticker-group">{announcementGroup}</div>
          <div className="zm-ticker-group" aria-hidden="true">{announcementGroup}</div>
        </div>
      </div>

      <header className="mock-header zm-header">
        <div className="site-shell">
        <div className="zm-header-frame">
        <div className="zm-header-main">
          <button
            className="zm-menu-button"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon size={22} />
          </button>

          <div className="zm-brand-wrap" ref={brandRef}>
            <BrandLogo />
          </div>

          <form className="zm-header-search" ref={searchRef} onSubmit={submitSearch}>
            <CategoryMenu
              categories={orderedCategories}
              products={products}
              activeCategory={activeCategory}
              onNavigate={() => setMobileOpen(false)}
            />
            <SearchIcon size={18} />
            <input
              name="q"
              placeholder="Search tumblers, jewellery sets, gadgets..."
              aria-label="Search products"
            />
            <button type="submit">Search</button>
          </form>

          <div className="zm-header-spacer" />

          <div className="zm-header-actions">
            <Link href="/track-order" className="zm-action-link">
              <PackageIcon />
              <span>Track order</span>
            </Link>

            <a
              className="zm-action-link zm-action-whatsapp"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              aria-label="Chat on WhatsApp"
              onClick={() => trackWhatsAppTap(pathname)}
            >
              <WhatsAppIcon size={18} />
              <span>WhatsApp</span>
            </a>

            <Link href="/contact-us" className="zm-action-link">
              <HelpIcon />
              <span>Help</span>
            </Link>

            <Link href="/account" className="zm-action-link" aria-label="Account">
              <UserIcon size={19} />
              <span>Account</span>
            </Link>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="zm-cart-button"
              aria-label="Open cart"
            >
              <CartIcon size={20} />
              {totalItems > 0 ? <b>{totalItems}</b> : null}
            </button>
          </div>
        </div>

        <div className="zm-mobile-search-row">
          <form onSubmit={submitSearch}>
            <CategoryMenu
              categories={orderedCategories}
              products={products}
              activeCategory={activeCategory}
              onNavigate={() => setMobileOpen(false)}
            />
            <SearchIcon size={17} />
            <input name="q" placeholder="Search products..." aria-label="Search products" />
            <button type="submit">Search</button>
          </form>
        </div>
        </div>
        </div>
        <div className="zm-category-strip">
          <div className="site-shell">
            <nav className="zm-category-nav" ref={navRef} aria-label="Product categories">
              {orderedCategories.map((category) => (
                <Link key={category.id} href={`/product-category/${category.slug}/`}>
                  <CategoryIcon slug={category.slug} size={21} />
                  <span>{category.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className={`mock-mobile-drawer ${mobileOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="mock-mobile-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />

        <aside>
          <div className="mock-mobile-drawer-head">
            <BrandLogo />
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <XIcon />
            </button>
          </div>

          <form className="mock-drawer-search" onSubmit={submitSearch}>
            <CategoryMenu
              categories={orderedCategories}
              products={products}
              activeCategory={activeCategory}
              onNavigate={() => setMobileOpen(false)}
            />
            <SearchIcon size={18} />
            <input name="q" placeholder="Search products..." />
            <button type="submit">→</button>
          </form>

          <b className="mock-drawer-label">Shop by category</b>
          <nav className="mock-drawer-categories zm-drawer-categories">
            {orderedCategories.map((category) => (
              <Link
                key={category.id}
                href={`/product-category/${category.slug}/`}
                onClick={() => setMobileOpen(false)}
              >
                <span className="zm-drawer-category-icon" aria-hidden="true">
                  <CategoryIcon slug={category.slug} size={22} />
                </span>
                <span>{category.name}</span>
                <i>→</i>
              </Link>
            ))}
          </nav>

          <nav className="mock-drawer-links">
            <Link href="/account" onClick={() => setMobileOpen(false)}>My Account</Link>
            <Link href="/track-order" onClick={() => setMobileOpen(false)}>Track order</Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                trackWhatsAppTap(pathname);
                setMobileOpen(false);
              }}
            >
              WhatsApp
            </a>
            <Link href="/contact-us" onClick={() => setMobileOpen(false)}>Help & contact</Link>
          </nav>
        </aside>
      </div>
    </>
  );
}