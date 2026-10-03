"use client";

import Image from "next/image";
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
];

const CATEGORY_IMAGES: Record<string, string> = {
  "home-living": "/images/categories/thumbs/home-living.webp",
  "home-decor": "/images/categories/thumbs/home-decor.webp",
  "beauty-personal-care": "/images/categories/thumbs/beauty-personal-care.webp",
  "tech-gadgets": "/images/categories/thumbs/tech-gadgets.webp",
  "fashion-accessories": "/images/categories/thumbs/fashion-accessories.webp",
  "sports-fitness": "/images/categories/thumbs/sports-fitness.webp",
};

const normalize = (value: string) =>
  value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

const slugify = (value: string) =>
  value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.8-4.2 3-6.3 6.5-6.3s5.7 2.1 6.5 6.3" />
    </svg>
  );
}

type HeaderProps = {
  categories: Category[];
  announcementItems?: string[];
  phone?: string;
};

const DEFAULT_ANNOUNCEMENTS = [
  "Quality checked before dispatch",
  "Cash on Delivery across Pakistan",
  "Real WhatsApp support",
  "Free delivery on selected orders",
];

export default function Header({ categories, announcementItems = [], phone = "+92 300 2026711" }: HeaderProps) {
  const router = useRouter();
  const { totalItems, setOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const tickerItems = announcementItems.length ? announcementItems : DEFAULT_ANNOUNCEMENTS;
  const phoneHref = phone.replace(/[^\d+]/g, "");

  const orderedCategories = useMemo(() => {
    const used = new Set<string>();
    const result: { name: string; slug: string; image: string }[] = [];

    CATEGORY_ORDER.forEach((wanted) => {
      const wantedKey = normalize(wanted);
      const match = categories.find((category) => {
        const id = String(category.id || category.slug);
        if (used.has(id)) return false;
        const nameKey = normalize(category.name || "");
        const slugKey = normalize(category.slug || "");
        return nameKey === wantedKey || slugKey === wantedKey || nameKey.includes(wantedKey) || wantedKey.includes(nameKey);
      });

      if (match) {
        used.add(String(match.id || match.slug));
        const canonicalSlug = slugify(wanted);
        const nonSvgImage = match.image && !/\.svg(?:\?|$)/i.test(match.image) ? match.image : null;
        result.push({
          name: match.name,
          slug: match.slug,
          image: CATEGORY_IMAGES[canonicalSlug] || nonSvgImage || CATEGORY_IMAGES[match.slug] || "/images/hero/zelvomart-hero.webp",
        });
      } else {
        const slug = slugify(wanted);
        result.push({ name: wanted, slug, image: CATEGORY_IMAGES[slug] || "/images/hero/zelvomart-hero.webp" });
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
      <div className="zm-topbar brand-topbar">
        <div className="zm-ticker" aria-label="Store benefits">
          <div className="zm-ticker-track">
            {[0, 1].map((copy) => (
              <div className="zm-ticker-group" key={copy} aria-hidden={copy === 1 ? "true" : undefined}>
                {tickerItems.map((item, index) => <span key={`${copy}-${index}`}><i />{item}</span>)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <header className="zm-header brand-header brand-header-clean">
        <div className="zm-shell zm-main-row brand-main-row-clean">
          <button type="button" className="zm-icon-button zm-mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>

          <div className="zm-logo-slot"><BrandLogo /></div>

          <nav className="zm-main-nav" aria-label="Main navigation">
            <Link href="/shop">Shop</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/about-us">About Us</Link>
            <Link href="/contact-us">Contact</Link>
          </nav>

          <div className="zm-actions">
            <div className="zm-actions-stack">
              <div className="zm-actions-top">
                <a className="zm-phone" href={`tel:${phoneHref}`}><small>Need help?</small><strong>{phone}</strong></a>
                <Link href="/track-order" className="zm-user" aria-label="Track order"><UserIcon /></Link>
                <button type="button" className="zm-cart" onClick={() => setOpen(true)} aria-label="Open cart"><CartIcon /><b>{totalItems}</b></button>
                <button type="button" className="zm-icon-button zm-mobile-only" onClick={() => setMobileSearch((value) => !value)} aria-label="Search"><SearchIcon /></button>
              </div>
              <form className="zm-search zm-desktop-search brand-header-search-under-phone" onSubmit={submitSearch}>
                <input name="q" placeholder="Search products, categories and more" aria-label="Search products" />
                <button type="submit" aria-label="Search"><SearchIcon size={18} /></button>
              </form>
            </div>
          </div>
        </div>

        {mobileSearch && (
          <div className="zm-shell zm-mobile-search">
            <form className="zm-search" onSubmit={submitSearch}>
              <input name="q" autoFocus placeholder="Search Zelvomart..." aria-label="Search products" />
              <button type="submit" aria-label="Search"><SearchIcon size={18} /></button>
            </form>
          </div>
        )}

        <div className="brand-category-strip brand-category-strip-with-images">
          <div className="zm-shell brand-category-search-row">
            <nav className="zm-compact-categories" aria-label="Product categories">
              {orderedCategories.map((category) => (
                <Link key={category.slug} href={`/product-category/${category.slug}/`} className="zm-compact-category brand-category-chip">
                  <span className="brand-category-thumb">
                    <Image
                      src={category.image}
                      alt=""
                      fill
                      sizes="34px"
                      loading="eager"
                      fetchPriority="high"
                      unoptimized
                    />
                  </span>
                  <span>{category.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className={`zm-drawer ${mobileOpen ? "open" : ""}`}>
        <button type="button" className="zm-drawer-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
        <aside className="zm-drawer-panel">
          <div className="zm-drawer-head"><BrandLogo compact /><button type="button" className="zm-icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><XIcon /></button></div>
          <div className="zm-mobile-section-title">Collections</div>
          <div className="zm-drawer-links zm-drawer-category-links">
            {orderedCategories.map((category) => (
              <Link key={category.slug} href={`/product-category/${category.slug}/`} onClick={() => setMobileOpen(false)}>
                <span className="brand-category-thumb"><Image src={category.image} alt="" fill sizes="34px" loading="eager" unoptimized /></span>
                <span>{category.name}</span>
              </Link>
            ))}
          </div>
          <div className="zm-mobile-section-title">Menu</div>
          <div className="zm-drawer-links zm-secondary-links">
            <Link href="/shop" onClick={() => setMobileOpen(false)}>Shop</Link>
            <Link href="/blog" onClick={() => setMobileOpen(false)}>Blog</Link>
            <Link href="/about-us" onClick={() => setMobileOpen(false)}>About Us</Link>
            <Link href="/contact-us" onClick={() => setMobileOpen(false)}>Contact</Link>
            <Link href="/track-order" onClick={() => setMobileOpen(false)}>Track Order</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
