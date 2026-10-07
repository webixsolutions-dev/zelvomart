"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function NewInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M3 12h18" />
      <path d="m5.6 5.6 12.8 12.8M18.4 5.6 5.6 18.4" opacity=".35" />
    </svg>
  );
}

function BestsellerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.4 2.8c.5 3-1 4.5-2.4 5.8-1.3 1.2-2.6 2.4-2.6 4.7a3.6 3.6 0 0 0 7.2 0c0-1.3-.4-2.4-1.2-3.5 2.7 1.3 4.2 3.6 4.2 6.2A6.6 6.6 0 0 1 12 22a6.6 6.6 0 0 1-6.6-6.6c0-4.4 2.8-7.2 8-12.6Z" />
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

const ANNOUNCEMENTS = [
  "Quality Checked Before Dispatch",
  "Order via WhatsApp or Website",
  "Cash on Delivery Across Pakistan",
  "Free Delivery on Orders Above Rs 8,000",
];

const toWhatsAppNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
};

export default function Header({
  categories,
  phone = "0300-2026711",
}: {
  categories: Category[];
  announcementItems?: string[];
  phone?: string;
}) {
  const router = useRouter();
  const { totalItems, setOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const whatsappHref = `https://wa.me/${toWhatsAppNumber(phone)}`;
  const whatsappDisplay = phone.startsWith("0")
    ? `+92 ${phone.slice(1).replace(/-/g, " ")}`
    : phone;

  const orderedCategories = useMemo(() => {
    const used = new Set<string>();

    return CATEGORY_ORDER.map((wanted) => {
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
  }, [categories]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const q = String(data.get("q") || "").trim();

    window.dispatchEvent(new Event("zelvo:route-start"));
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    setSearchOpen(false);
    setMobileOpen(false);
  };

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
        <div className="site-shell zm-header-main">
          <button
            className="zm-menu-button"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon size={22} />
          </button>

          <div className="zm-brand-wrap">
            <BrandLogo />
          </div>

          <div className="zm-header-spacer" />

          <div className="zm-header-actions">
            <Link href="/track-order" className="zm-action-link">
              <PackageIcon />
              <span>Track order</span>
            </Link>

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

            <button
              type="button"
              className={`zm-search-button ${searchOpen ? "is-active" : ""}`}
              onClick={() => setSearchOpen((value) => !value)}
              aria-label="Search products"
              aria-expanded={searchOpen}
            >
              {searchOpen ? <XIcon size={19} /> : <SearchIcon size={20} />}
            </button>
          </div>
        </div>

        {searchOpen ? (
          <div className="site-shell zm-search-panel">
            <form onSubmit={submitSearch}>
              <SearchIcon size={18} />
              <input
                autoFocus
                name="q"
                placeholder="Search products..."
                aria-label="Search products"
              />
              <button type="submit">Search</button>
            </form>
          </div>
        ) : null}

        <div className="site-shell zm-quick-row">
          <div className="zm-quick-stack">
            <nav aria-label="Quick shop links">
              <Link href="/new-in"><NewInIcon /><span>New in</span></Link>
              <Link href="/bestsellers"><BestsellerIcon /><span>Bestsellers</span></Link>
            </nav>
            <a
              className="zm-quick-whatsapp"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`Chat on WhatsApp ${phone}`}
            >
              <WhatsAppIcon size={21} />
              <span>{whatsappDisplay}</span>
            </a>
          </div>
        </div>

        <div className="zm-category-strip">
          <div className="site-shell">
            <nav className="zm-category-nav" aria-label="Product categories">
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
            <Link href="/new-in" onClick={() => setMobileOpen(false)}>New in</Link>
            <Link href="/bestsellers" onClick={() => setMobileOpen(false)}>Bestsellers</Link>
            <Link href="/track-order" onClick={() => setMobileOpen(false)}>Track order</Link>
            <Link href="/contact-us" onClick={() => setMobileOpen(false)}>Help & contact</Link>
          </nav>
        </aside>
      </div>

      <style jsx global>{`
        .zm-ticker {
          width: 100%;
          overflow: hidden;
          background: #0797c9;
          color: #fff;
          min-height: 34px;
          display: flex;
          align-items: center;
        }

        .zm-ticker-track {
          display: flex;
          width: max-content;
          min-width: 200%;
          animation: zmTickerMove 24s linear infinite;
          will-change: transform;
        }

        .zm-ticker:hover .zm-ticker-track {
          animation-play-state: paused;
        }

        .zm-ticker-group {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          gap: 44px;
          padding: 0 28px;
          white-space: nowrap;
          min-width: max-content;
        }

        .zm-ticker-item {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          line-height: 1;
        }

        @keyframes zmTickerMove {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        .zm-header {
          background: #fff;
          border-bottom: 1px solid #e7edf1;
        }

        .zm-header-main {
          min-height: 74px;
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .zm-brand-wrap {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
        }

        .zm-header-spacer { flex: 1; }

        .zm-menu-button {
          display: none;
          border: 0;
          background: transparent;
          color: #0c2b3a;
          padding: 7px;
          cursor: pointer;
        }

        .zm-header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 17px;
        }

        .zm-action-link,
        .zm-cart-button,
        .zm-search-button {
          color: #0b2938;
          text-decoration: none;
        }

        .zm-action-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 750;
          white-space: nowrap;
        }

        .zm-cart-button,
        .zm-search-button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          min-height: 32px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          cursor: pointer;
          transition: background .18s ease, color .18s ease;
        }

        .zm-search-button:hover,
        .zm-search-button.is-active,
        .zm-cart-button:hover {
          background: #edf8fc;
          color: #008fc5;
        }

        .zm-cart-button b {
          position: absolute;
          top: -4px;
          right: -5px;
          min-width: 17px;
          height: 17px;
          padding: 0 4px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: #0797c9;
          color: #fff;
          font-size: 10px;
          line-height: 1;
        }

        .zm-search-panel {
          padding-bottom: 10px;
          animation: zmSearchDrop .16s ease-out both;
        }

        .zm-search-panel form {
          width: min(680px, 100%);
          margin-left: auto;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 10px;
          min-height: 44px;
          padding-left: 14px;
          border: 1px solid #cfe0e8;
          border-radius: 10px;
          background: #f3f9fc;
          overflow: hidden;
        }

        .zm-search-panel input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #0b2938;
          font: inherit;
        }

        .zm-search-panel button {
          align-self: stretch;
          border: 0;
          background: #078dbd;
          color: #fff;
          padding: 0 22px;
          font-weight: 800;
          cursor: pointer;
        }

        @keyframes zmSearchDrop {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .zm-quick-row {
          min-height: 44px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding-right: 24px;
        }

        .zm-quick-stack {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          gap: 20px;
          padding: 5px 0 7px;
        }

        .zm-quick-row nav {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .zm-quick-whatsapp {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #0797c9;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
        }


        .zm-quick-row a {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #0d2d3c;
          text-decoration: none;
          font-size: 13px;
          font-weight: 800;
        }

        .zm-quick-row a svg {
          flex: 0 0 auto;
          color: #0d2d3c;
        }

        .zm-quick-row .zm-quick-whatsapp {
          color: #0797c9;
          font-size: 14px;
          font-weight: 700;
        }

        .zm-quick-row .zm-quick-whatsapp svg {
          color: #13c766;
        }

        .zm-quick-row .zm-quick-whatsapp:hover {
          color: #006f9e;
        }

        .zm-category-strip {
          border-top: 1px solid #e8eef2;
          border-bottom: 1px solid #e8eef2;
          background: #fff;
        }

        .zm-category-nav {
          display: flex;
          align-items: center;
          gap: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .zm-category-nav::-webkit-scrollbar { display: none; }

        .zm-category-nav a {
          flex: 0 0 auto;
          min-height: 47px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 13px;
          border-right: 1px solid #dce5ea;
          color: #008fca;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          transition: color .16s ease, background .16s ease;
        }

        .zm-category-nav a:first-child { border-left: 1px solid #dce5ea; }

        .zm-category-nav a svg {
          color: #141b20;
          flex: 0 0 auto;
        }

        .zm-category-nav a:hover {
          color: #005d84;
          background: #f7fbfd;
        }

        .zm-drawer-category-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #f1f8fb;
          color: #092c3d;
          flex: 0 0 auto;
        }

        @media (max-width: 900px) {
          .zm-header-main {
            position: relative;
            min-height: 68px;
            gap: 6px;
            padding-top: 4px;
            padding-bottom: 6px;
          }

          .zm-brand-wrap {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 1;
            max-width: 86px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .zm-brand-wrap img {
            width: auto !important;
            max-width: 86px !important;
            max-height: 48px !important;
            object-fit: contain;
          }

          .zm-menu-button {
            display: inline-flex;
            position: relative;
            z-index: 2;
          }

          .zm-header-spacer { flex: 1 1 auto; min-width: 74px; }

          .zm-header-actions {
            position: relative;
            z-index: 2;
            gap: 3px;
            flex: 0 0 auto;
          }

          .zm-action-link {
            min-width: 34px;
            min-height: 34px;
            justify-content: center;
            border-radius: 999px;
          }

          .zm-action-link span { display: none; }

          .zm-quick-row {
            justify-content: flex-end;
            min-height: 34px;
            padding-top: 3px;
            padding-bottom: 8px;
            overflow: visible;
          }

          .zm-quick-stack {
            width: 100%;
            min-width: 0;
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            align-items: center;
            column-gap: 10px;
            row-gap: 5px;
            padding: 2px 0 0;
          }

          .zm-quick-row nav {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 10px;
            padding-bottom: 0;
            min-width: 0;
          }

          .zm-quick-row nav a,
          .zm-quick-whatsapp {
            white-space: nowrap;
            max-width: 100%;
          }

          .zm-quick-whatsapp {
            font-size: 13px;
            gap: 6px;
          }

          /* Mobile: only the bottom category strip disappears. */
          .zm-category-strip { display: none; }

          .zm-search-panel form {
            width: 100%;
            margin: 0;
          }

          .zm-ticker-track { animation-duration: 18s; }
          .zm-ticker-group { gap: 28px; padding: 0 18px; }
          .zm-ticker-item { font-size: 12px; }
        }

        @media (max-width: 520px) {
          .zm-header-main {
            padding-left: 10px;
            padding-right: 10px;
            padding-bottom: 7px;
          }

          .zm-brand-wrap { max-width: 72px; }
          .zm-brand-wrap img { max-width: 72px !important; max-height: 44px !important; }

          .zm-header-actions { gap: 0; }
          .zm-action-link,
          .zm-cart-button,
          .zm-search-button {
            min-width: 27px;
            width: 27px;
            min-height: 30px;
            height: 30px;
            padding: 0;
          }

          .zm-header-actions svg {
            width: 17px !important;
            height: 17px !important;
          }

          .zm-menu-button {
            width: 30px;
            height: 30px;
            padding: 4px;
          }

          .zm-header-spacer { min-width: 58px; }

          .zm-quick-row {
            padding-left: 12px;
            padding-right: 12px;
            padding-bottom: 9px;
          }

          .zm-quick-stack {
            column-gap: 8px;
            row-gap: 4px;
          }

          .zm-quick-row nav { gap: 8px; }
          .zm-quick-row a { font-size: 11.5px; }
          .zm-quick-row .zm-quick-whatsapp { font-size: 12px; }

          .zm-search-panel { padding-left: 12px; padding-right: 12px; }
          .zm-search-panel button { padding: 0 15px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .zm-ticker-track { animation: none; }
          .zm-search-panel { animation: none; }
        }
      `}</style>
    </>
  );
}
