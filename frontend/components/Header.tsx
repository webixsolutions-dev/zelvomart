"use client";

import "./Header.css";
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

export default function Header({
  categories,
}: {
  categories: Category[];
  announcementItems?: string[];
  phone?: string;
}) {
  const router = useRouter();
  const { totalItems, setOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

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

          <form className="zm-header-search" onSubmit={submitSearch}>
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

        <div className="site-shell zm-mobile-search-row">
          <form onSubmit={submitSearch}>
            <SearchIcon size={17} />
            <input name="q" placeholder="Search products..." aria-label="Search products" />
            <button type="submit">Search</button>
          </form>
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
            <Link href="/track-order" onClick={() => setMobileOpen(false)}>Track order</Link>
            <Link href="/contact-us" onClick={() => setMobileOpen(false)}>Help & contact</Link>
          </nav>
        </aside>
      </div>
    </>
  );
}