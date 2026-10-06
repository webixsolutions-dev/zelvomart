"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentType, FormEvent } from "react";
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
  TechCategoryIcon,
  WhatsAppIcon,
  XIcon,
  SportsCategoryIcon,
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

const CATEGORY_IMAGES: Record<string, string> = {
  "home-living": "/images/categories/home-living.webp",
  "home-decor": "/images/categories/home-decor.webp",
  "beauty-personal-care": "/images/categories/beauty-personal-care.webp",
  "tech-gadgets": "/images/categories/tech-gadgets.webp",
  "kids-toys": "/images/categories/kids-toys.webp",
  "fashion-accessories": "/images/categories/fashion-accessories.webp",
  "sports-fitness": "/images/categories/sports-fitness.webp",
};

const SHORT_LABELS: Record<string, string> = {
  "Beauty & Personal Care": "Beauty & Personal Care",
  "Fashion Accessories": "Fashion Accessories",
};

const normalize = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function PackageIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>;
}
function HelpIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.8 1.9c-.9.6-1.6 1-1.6 2.1M12 17h.01"/></svg>;
}

const categoryIcons: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  "home-living": HomeCategoryIcon,
  "home-decor": DecorCategoryIcon,
  "beauty-personal-care": BeautyCategoryIcon,
  "tech-gadgets": TechCategoryIcon,
  "fashion-accessories": FashionCategoryIcon,
  "sports-fitness": SportsCategoryIcon,
  "kids-toys": KidsCategoryIcon,
};

export default function Header({ categories, phone = "0300-2026711" }: { categories: Category[]; announcementItems?: string[]; phone?: string }) {
  const router = useRouter();
  const { totalItems, setOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const orderedCategories = useMemo(() => {
    const used = new Set<string>();
    return CATEGORY_ORDER.map((wanted) => {
      const wantedKey = normalize(wanted);
      const match = categories.find((category) => {
        const id = String(category.id || category.slug);
        if (used.has(id)) return false;
        const nameKey = normalize(category.name || "");
        const slugKey = normalize(category.slug || "");
        return nameKey === wantedKey || slugKey === wantedKey || nameKey.includes(wantedKey) || wantedKey.includes(nameKey);
      });
      if (match) used.add(String(match.id || match.slug));
      const slug = match?.slug || slugify(wanted);
      return {
        id: match?.id || slug,
        name: match?.name || wanted,
        displayName: SHORT_LABELS[match?.name || wanted] || match?.name || wanted,
        slug,
        image: CATEGORY_IMAGES[slug] || (match?.image && !/\.svg(?:\?|$)/i.test(match.image) ? match.image : "/images/hero/zelvomart-hero.webp"),
      };
    });
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
      <div className="mock-topbar">
        <div className="site-shell mock-topbar-inner">
          <span>▱&nbsp; Free delivery across Pakistan</span>
          <span>▣&nbsp; Cash on Delivery — pay when it arrives</span>
          <span>↻&nbsp; Easy exchange</span>
          <a href={`tel:${phone.replace(/\D/g, "")}`}><WhatsAppIcon size={14} /> {phone}</a>
        </div>
      </div>

      <header className="mock-header">
        <div className="site-shell mock-header-main">
          <button className="mock-mobile-icon" type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><MenuIcon size={22}/></button>
          <BrandLogo />

          <form className="mock-header-search" onSubmit={submitSearch}>
            <SearchIcon size={18}/>
            <input name="q" placeholder="Search tumblers, jewellery sets, gadgets..." aria-label="Search products" />
            <button type="submit">Search</button>
          </form>

          <div className="mock-header-actions">
            <Link href="/track-order"><PackageIcon/><span>Track order</span></Link>
            <Link href="/contact-us"><HelpIcon/><span>Help</span></Link>
            <button type="button" onClick={() => setOpen(true)} className="mock-cart-button" aria-label="Open cart"><CartIcon size={20}/><b>{totalItems}</b></button>
            <button type="button" className="mock-mobile-icon mock-search-toggle" onClick={() => setMobileSearch((v) => !v)} aria-label="Search"><SearchIcon size={20}/></button>
          </div>
        </div>

        {mobileSearch ? <div className="site-shell mock-mobile-search"><form onSubmit={submitSearch}><SearchIcon size={18}/><input autoFocus name="q" placeholder="Search products..."/><button type="submit">→</button></form></div> : null}

        <div className="mock-header-nav-wrap">
          <div className="site-shell mock-header-nav">
            <nav className="mock-desktop-category-nav" aria-label="Product categories">
              {orderedCategories.map((category) => {
                const Icon = categoryIcons[category.slug] || HomeCategoryIcon;
                return (
                  <Link key={category.id} href={`/product-category/${category.slug}/`}>
                    <Icon size={17} />
                    <span>{category.displayName}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="mock-mobile-category-strip" aria-label="Browse categories">
          {orderedCategories.slice(0, 6).map((category) => (
            <Link key={category.id} href={`/product-category/${category.slug}/`}>
              <span className="mock-mobile-cat-image"><Image src={category.image} alt="" fill sizes="58px" unoptimized={category.image.startsWith("/images/")} /></span>
              <small>{category.displayName}</small>
            </Link>
          ))}
        </div>
      </header>

      <div className={`mock-mobile-drawer ${mobileOpen ? "is-open" : ""}`}>
        <button type="button" className="mock-mobile-drawer-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
        <aside>
          <div className="mock-mobile-drawer-head"><BrandLogo/><button type="button" onClick={() => setMobileOpen(false)}><XIcon/></button></div>
          <form className="mock-drawer-search" onSubmit={submitSearch}><SearchIcon size={18}/><input name="q" placeholder="Search products..."/><button>→</button></form>
          <b className="mock-drawer-label">Shop by category</b>
          <nav className="mock-drawer-categories">
            {orderedCategories.map((category) => <Link key={category.id} href={`/product-category/${category.slug}/`} onClick={() => setMobileOpen(false)}><span className="mock-mobile-cat-image"><Image src={category.image} alt="" fill sizes="46px" unoptimized={category.image.startsWith("/images/")} /></span><span>{category.displayName}</span><i>→</i></Link>)}
          </nav>
          <nav className="mock-drawer-links"><Link href="/new-in" onClick={() => setMobileOpen(false)}>New in</Link><Link href="/bestsellers" onClick={() => setMobileOpen(false)}>Bestsellers</Link><Link href="/track-order" onClick={() => setMobileOpen(false)}>Track order</Link><Link href="/contact-us" onClick={() => setMobileOpen(false)}>Help & contact</Link></nav>
        </aside>
      </div>
    </>
  );
}
