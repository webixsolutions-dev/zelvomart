"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BadgePercent, Heart, Menu, ShoppingBag, Sparkle, User, X } from "lucide-react";
import { categoryPath } from "@/lib/launch/catalog";
import {useCatalog,useSite} from "@/lib/launch/store";
import { waLink } from "@/lib/launch/format";
import { useShop } from "@/lib/launch/store";
import { Logo } from "@/components/launch/ui/Logo";
import { CategoryIcon } from "@/components/launch/ui/CategoryIcon";
import { WhatsAppIcon } from "@/components/launch/ui/BrandIcons";
import { SearchBox } from "./SearchBox";

export function Header() {
  const {categories}=useCatalog();const site=useSite();
  const pathname = usePathname();
  const { cartCount, wishlist, ready, setCartOpen } = useShop();
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("no-scroll", drawer);
    return ()=>document.body.classList.remove("no-scroll");
  }, [drawer]);

  const active = (href: string) => pathname === href || pathname === href.replace(/\/$/, "");

  return (
    <>
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container header-main">
          <Logo className="header-logo" />
          <div className="header-left only-mobile">
            <button className="icon-btn" type="button" aria-label="Open menu" onClick={() => setDrawer(true)}>
              <Menu size={23} />
            </button>
          </div>
          <div className="header-search only-desktop">
            <SearchBox withCategories />
          </div>
          <nav className="head-actions" aria-label="Account and cart">
            <a
              href={waLink(site.whatsappNumber, "Hi Zelvomart! I have a question.")}
              className="head-action head-wa"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with us on WhatsApp"
              title="Chat with us on WhatsApp"
            >
              <WhatsAppIcon size={21} />
            </a>
            <Link prefetch={false} href="/my-account/" className="head-action only-desktop">
              <User size={21} />
              <span>Account</span>
            </Link>
            <Link prefetch={false} href="/wishlist/" className="head-action" aria-label="Wishlist">
              <span className="badge-wrap">
                <Heart size={21} />
                {ready && wishlist.length > 0 && <b className="count">{wishlist.length}</b>}
              </span>
              <span className="only-desktop">Wishlist</span>
            </Link>
            <button className="head-action cart-btn" type="button" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cartCount} items`}>
              <span className="badge-wrap">
                <ShoppingBag size={21} />
                {ready && cartCount > 0 && <b className="count">{cartCount}</b>}
              </span>
              <span className="only-desktop">Cart</span>
            </button>
          </nav>
        </div>
        <nav className="nav-row only-desktop" aria-label="Categories">
          <div className="container nav-row-inner">
            {categories.map((c) => (
              <Link prefetch={false} key={c.id} href={`/category/${c.slug}/`} className={active(`/category/${c.slug}/`) ? "active" : ""}>
                <CategoryIcon id={c.id} size={17} />
                {c.name}
              </Link>
            ))}
            <Link prefetch={false} href="/new-arrivals/" className={`nav-new ${active("/new-arrivals/") ? "active" : ""}`}>
              <Sparkle size={16} />
              New Arrivals
            </Link>
            <Link prefetch={false} href="/deals-and-offers/" className="deal-link">
              <BadgePercent size={17} />
              Deals & Offers
            </Link>
          </div>
        </nav>
      </header>

      <div className={`drawer-backdrop ${drawer ? "show" : ""}`} onClick={() => setDrawer(false)} aria-hidden="true" />
      <aside className={`side-drawer left ${drawer ? "open" : ""}`} aria-label="Menu" aria-hidden={!drawer}>
        <div className="drawer-head">
          <Logo className="drawer-logo" />
          <button className="icon-btn" type="button" aria-label="Close menu" onClick={() => setDrawer(false)}>
            <X size={22} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="drawer-search">
            <SearchBox onDone={() => setDrawer(false)} />
          </div>
          <p className="drawer-label">Shop by category</p>
          <ul className="drawer-cats">
            {categories.map((c) => (
              <li key={c.id}>
                <Link prefetch={false} href={`/category/${c.slug}/`}>
                  <span className="drawer-cat-ico">
                    <CategoryIcon id={c.id} />
                  </span>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="drawer-label">Explore</p>
          <ul className="drawer-links">
            <li><Link prefetch={false} href="/shop-all-products/">All Products</Link></li>
            <li><Link prefetch={false} href="/new-arrivals/">New Arrivals</Link></li>
            <li><Link prefetch={false} href="/bestsellers/">Bestsellers</Link></li>
            <li><Link prefetch={false} href="/deals-and-offers/" className="deal-link">Deals & Offers</Link></li>
          </ul>
          <p className="drawer-label">Help</p>
          <ul className="drawer-links">
            <li><Link prefetch={false} href="/my-account/">My Account</Link></li>
            <li><Link prefetch={false} href="/track-your-order/">Track Order</Link></li>
            <li><Link prefetch={false} href="/faqs/">FAQs</Link></li>
            <li><Link prefetch={false} href="/about-us/">About Zelvomart</Link></li>
            <li><Link prefetch={false} href="/contact-us/">Contact</Link></li>
          </ul>
          <a className="btn wa block" href={waLink(site.whatsappNumber)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon /> Chat on WhatsApp
          </a>
        </div>
      </aside>
    </>
  );
}
