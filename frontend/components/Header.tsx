"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { CartIcon, MenuIcon, SearchIcon, XIcon } from "@/components/Icons";
import { useCart } from "@/components/CartProvider";
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
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.8-4.2 3-6.3 6.5-6.3s5.7 2.1 6.5 6.3" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

type HeaderProps = {
  categories: Category[];
  announcementItems?: string[];
  phone?: string;
};

const DEFAULT_ANNOUNCEMENTS = [
  "✅ Quality Checked Before Dispatch",
  "💬 Order Via WhatsApp or Website",
  "🚚 Cash on Delivery Across Pakistan",
  "📦 Free Delivery on Orders Above Rs 8,000",
];

export default function Header({ categories, announcementItems = [], phone = "+92 300 2026711" }: HeaderProps) {
  const router = useRouter();
  const { totalItems, setOpen } = useCart();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const tickerItems = announcementItems.length ? announcementItems : DEFAULT_ANNOUNCEMENTS;
  const phoneHref = phone.replace(/[^\d+]/g, "");

  const orderedCategories = useMemo(() => {
    const used = new Set<string>();
    const result: { name: string; slug: string }[] = [];

    CATEGORY_ORDER.forEach((wanted) => {
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

      if (match) {
        used.add(String(match.id || match.slug));
        result.push({
          name: match.name,
          slug: match.slug,
        });
      } else {
        result.push({
          name: wanted,
          slug: slugify(wanted),
        });
      }
    });

    categories.forEach((category) => {
      const id = String(category.id || category.slug);
      if (!used.has(id)) {
        result.push({
          name: category.name,
          slug: category.slug,
        });
      }
    });

    return result;
  }, [categories]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const q = String(data.get("q") || "").trim();

    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    setMobileSearch(false);
    setMobileOpen(false);
  };

  return (
    <>
      <div className="zm-topbar">
        <div className="zm-ticker" aria-label="Store benefits">
          <div className="zm-ticker-track">
            <div className="zm-ticker-group">
              {tickerItems.map((item, index) => <span key={`primary-${index}`}>{item}</span>)}
            </div>

            <div className="zm-ticker-group" aria-hidden="true">
              {tickerItems.map((item, index) => <span key={`repeat-${index}`}>{item}</span>)}
            </div>
          </div>
        </div>
      </div>

      <header className="zm-header">
        <div className="zm-shell zm-main-row">
          <button
            type="button"
            className="zm-icon-button zm-mobile-only"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>

          <div className="zm-logo-slot">
            <BrandLogo />
          </div>

          <nav className="zm-main-nav">
            <Link href="/shop">Shop</Link>

            <Link href="/blog">Blog</Link>

            <Link href="/about-us">About</Link>
            <Link href="/contact-us">Contact</Link>
          </nav>

          <div className="zm-actions">
            <a className="zm-phone" href={`tel:${phoneHref}`}>
              {phone}
            </a>

            <Link
              href="/track-order"
              className="zm-user"
              aria-label="Track order"
            >
              <UserIcon />
            </Link>

            <button
              type="button"
              className="zm-cart"
              onClick={() => setOpen(true)}
              aria-label="Open cart"
            >
              <CartIcon />
              <b>{totalItems}</b>
            </button>

            <button
              type="button"
              className="zm-icon-button zm-mobile-only"
              onClick={() => setMobileSearch((value) => !value)}
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </div>
        </div>

        {mobileSearch && (
          <div className="zm-shell zm-mobile-search">
            <form className="zm-search" onSubmit={submitSearch}>
              <input
                name="q"
                autoFocus
                placeholder="Search products..."
                aria-label="Search products"
              />
              <button type="submit" aria-label="Search">
                <SearchIcon size={18} />
              </button>
            </form>
          </div>
        )}

        <div className="zm-search-row">
          <div className="zm-shell zm-search-row-inner">
            <div className="zm-compact-categories">
              {orderedCategories.slice(0, 7).map((category) => (
                <Link
                  key={category.slug}
                  href={`/category/${category.slug}`}
                  className="zm-compact-category"
                >
                  {category.name}
                </Link>
              ))}
            </div>

            <form className="zm-search zm-desktop-search" onSubmit={submitSearch}>
              <input
                name="q"
                placeholder="Search..."
                aria-label="Search products"
              />
              <button type="submit" aria-label="Search">
                <SearchIcon size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className={`zm-drawer ${mobileOpen ? "open" : ""}`}>
        <button
          type="button"
          className="zm-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />

        <aside className="zm-drawer-panel">
          <div className="zm-drawer-head">
            <BrandLogo compact />

            <button
              type="button"
              className="zm-icon-button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <XIcon />
            </button>
          </div>

          <Link
            className="zm-shop-all"
            href="/shop"
            onClick={() => setMobileOpen(false)}
          >
            Shop All Products
          </Link>

          <div className="zm-mobile-section-title">Categories</div>

          <div className="zm-drawer-links">
            {orderedCategories.map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                onClick={() => setMobileOpen(false)}
              >
                {category.name}
              </Link>
            ))}
          </div>

          <div className="zm-drawer-links zm-secondary-links">
            <Link href="/blog" onClick={() => setMobileOpen(false)}>
              Blog
            </Link>
            <Link href="/about-us" onClick={() => setMobileOpen(false)}>
              About Us
            </Link>
            <Link href="/contact-us" onClick={() => setMobileOpen(false)}>
              Contact Us
            </Link>
            <Link href="/track-order" onClick={() => setMobileOpen(false)}>
              Track Order
            </Link>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        .zm-header,
        .zm-topbar,
        .zm-drawer {
          font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
            "Segoe UI", Arial, Helvetica, sans-serif;
        }

        .zm-shell {
          width: calc(100% - 48px);
          max-width: 1130px;
          margin: 0 auto;
        }

        .zm-topbar {
          height: 34px;
          overflow: hidden;
          background: #08a4dc;
          color: #fff;
          font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
            "Segoe UI", Arial, Helvetica, sans-serif;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .zm-ticker {
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .zm-ticker-track {
          width: max-content;
          height: 100%;
          display: flex;
          align-items: center;
          animation: zmTicker 24s linear infinite;
          will-change: transform;
        }

        .zm-ticker:hover .zm-ticker-track {
          animation-play-state: paused;
        }

        .zm-ticker-group {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .zm-ticker-group span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 34px;
          line-height: 34px;
        }

        @keyframes zmTicker {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .zm-ticker-track {
            animation: none;
          }
        }

        .zm-header {
          position: relative;
          z-index: 50;
          background: #fff;
          border-bottom: 1px solid #e7ecef;
        }

        .zm-main-row {
          height: 66px;
          padding-left: 22px;
          padding-right: 6px;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 250px minmax(360px, 1fr) 250px;
          align-items: center;
          gap: 18px;
        }

        .zm-logo-slot {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          min-width: 0;
        }

        .zm-main-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 26px;
          min-width: 0;
          white-space: nowrap;
        }

        .zm-main-nav > a,
        .zm-mega-trigger {
          color: #173044;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
          text-decoration: none;
        }

        .zm-main-nav > a:hover,
        .zm-mega-trigger:hover {
          color: #08758a;
        }

        .zm-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 17px;
          min-width: 0;
          white-space: nowrap;
        }

        .zm-phone {
          color: #173044;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }

        .zm-user {
          width: 24px;
          height: 24px;
          color: #173044;
          display: grid;
          place-items: center;
        }

        .zm-user svg,
        .zm-cart svg,
        .zm-icon-button svg {
          width: 19px;
          height: 19px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
        }

        .zm-cart {
          position: relative;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #173044;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .zm-cart b {
          position: absolute;
          top: -7px;
          right: -3px;
          min-width: 17px;
          height: 17px;
          padding: 0 4px;
          border-radius: 999px;
          background: #c8912d;
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 800;
        }

        .zm-search-row {
          border-top: 1px solid #edf1f3;
          background: #fff;
        }

        .zm-search-row-inner {
          height: 42px;
          padding-left: 22px;
          padding-right: 6px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .zm-compact-categories {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .zm-compact-categories::-webkit-scrollbar {
          display: none;
        }

        .zm-compact-category {
          flex: 0 0 auto;
          padding: 5px 9px;
          border-right: 1px solid #e5eaed;
          color: #173044;
          font-size: 10.5px;
          font-weight: 700;
          line-height: 1;
          text-decoration: none;
          white-space: nowrap;
        }

        .zm-compact-category:first-child {
          padding-left: 0;
        }

        .zm-compact-category:last-child {
          border-right: 0;
        }

        .zm-compact-category:hover {
          color: #08758a;
        }

        .zm-search {
          width: 285px;
          height: 36px;
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid #08758a;
          border-radius: 999px;
          background: #fff;
        }

        .zm-search input {
          flex: 1;
          min-width: 0;
          height: 100%;
          padding: 0 14px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #173247;
          font-family: inherit;
          font-size: 13px;
        }

        .zm-search button {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: #0b7186;
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .zm-search button svg {
          fill: none;
          stroke: currentColor;
        }

        .zm-icon-button {
          width: 38px;
          height: 38px;
          padding: 0;
          border: 1px solid #dfe7eb;
          border-radius: 10px;
          background: #fff;
          color: #173044;
          place-items: center;
          cursor: pointer;
        }

        .zm-mobile-only,
        .zm-mobile-search {
          display: none !important;
        }

        .zm-drawer {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 100;
        }

        .zm-drawer.open {
          display: block;
        }

        .zm-drawer-backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(5, 24, 35, 0.48);
        }

        .zm-drawer-panel {
          position: absolute;
          inset: 0 auto 0 0;
          width: min(86vw, 360px);
          padding: 18px;
          overflow-y: auto;
          background: #fff;
        }

        .zm-drawer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .zm-shop-all {
          display: block;
          margin-bottom: 18px;
          padding: 13px 14px;
          border-radius: 9px;
          background: #0f2d3d;
          color: #fff;
          font-weight: 800;
          text-decoration: none;
        }

        .zm-mobile-section-title {
          margin-bottom: 5px;
          color: #0c7184;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .zm-drawer-links {
          display: grid;
          margin-bottom: 18px;
        }

        .zm-drawer-links a {
          padding: 12px 4px;
          border-bottom: 1px solid #edf1f3;
          color: #173247;
          font-size: 14px;
          font-weight: 650;
          text-decoration: none;
        }

        .zm-secondary-links a {
          color: #5d6f7c;
        }

        @media (max-width: 1100px) and (min-width: 981px) {
          .zm-shell {
            width: calc(100% - 32px);
            max-width: 1130px;
          }

          .zm-main-row {
            grid-template-columns: 220px minmax(330px, 1fr) 220px;
          }

          .zm-main-nav {
            gap: 18px;
          }

          .zm-phone {
            font-size: 12px;
          }
        }

        @media (max-width: 980px) {
          .zm-shell {
            width: calc(100% - 32px);
            max-width: 1130px;
          }

          .zm-topbar {
            height: 32px;
            font-size: 11px;
          }

          .zm-ticker-group span {
            padding: 0 24px;
            line-height: 32px;
          }

          .zm-main-nav,
          .zm-phone,
          .zm-user,
          .zm-desktop-search {
            display: none !important;
          }

          .zm-main-row {
            height: 64px;
            grid-template-columns: 42px 1fr auto;
            gap: 12px;
          }

          .zm-logo-slot {
            justify-content: center;
          }

          .zm-actions {
            gap: 7px;
          }

          .zm-mobile-only {
            display: grid !important;
          }

          .zm-mobile-search {
            display: block !important;
            padding-bottom: 12px;
          }

          .zm-mobile-search .zm-search {
            width: 100%;
          }

          .zm-search-row-inner {
            height: 40px;
          }

          .zm-compact-categories {
            width: 100%;
          }

          .zm-compact-category {
            font-size: 10px;
            padding: 5px 8px;
          }
        }

        @media (max-width: 640px) {
          .zm-shell {
            width: calc(100% - 24px);
            max-width: 1130px;
          }

        }
      `}</style>
    </>
  );
}
