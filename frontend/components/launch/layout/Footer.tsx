"use client";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Mail, MapPin } from "lucide-react";
import { categoryPath } from "@/lib/launch/catalog";
import {useCatalog,useSite} from "@/lib/launch/store";
import { waLink } from "@/lib/launch/format";
import { FacebookIcon, InstagramIcon, LinkedinIcon, PinterestIcon, TiktokIcon, WhatsAppIcon, XIcon, YoutubeIcon } from "@/components/launch/ui/BrandIcons";
import styles from "./Footer.module.css";

const customerServiceLinks = [
  { label: "About Us", href: "/about-us/" },
  { label: "Contact Us", href: "/contact-us/" },
  { label: "Track Order", href: "/track-your-order/" },
  { label: "Privacy Policy", href: "/privacy-policy/" },
  { label: "Terms & Conditions", href: "/terms-and-conditions/" },
  { label: "Shipping Policy", href: "/shipping-policy/" },
  { label: "Returns & Refunds", href: "/refund-and-return-policy/" },
  { label: "FAQs", href: "/faqs/" },
] as const;

function FooterNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.navLink}>
      <ChevronRight size={15} strokeWidth={3} aria-hidden="true" focusable="false" />
      <span>{children}</span>
    </Link>
  );
}

export function Footer() {
  const {categories}=useCatalog();const site=useSite();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link href="/" className={styles.logo} aria-label="Zelvomart — home">
              <Image src="/launch/brand/zelvomart-logo-white.png" alt="Zelvomart" width={320} height={211} />
            </Link>
            <p>
              Everyday things, chosen better. Zelvomart is a Pakistani lifestyle store — we stock every product ourselves, check it
              by hand and ship it from {site.fulfilment.warehouse} with Cash on Delivery nationwide.
            </p>
            <div className="socials">
              {(
                [
                  [site.social.facebook, "Facebook", FacebookIcon],
                  [site.social.instagram, "Instagram", InstagramIcon],
                  [site.social.pinterest, "Pinterest", PinterestIcon],
                  [site.social.linkedin, "LinkedIn", LinkedinIcon],
                  [site.social.x, "X", XIcon],
                  [site.social.tiktok, "TikTok", TiktokIcon],
                  [site.social.youtube, "YouTube", YoutubeIcon],
                ] as const
              ).map(([href, label, Icon]) => (
                <a key={label} href={href} aria-label={`Zelvomart on ${label}`} target="_blank" rel="noopener noreferrer">
                  <Icon />
                </a>
              ))}
            </div>
          </div>
          <div className={styles.linkGroup}>
            <h4>Shop</h4>
            <nav aria-label="Shop">
              {categories.map((c) => (
                <FooterNavLink key={c.id} href={`/category/${c.slug}/`}>{c.name}</FooterNavLink>
              ))}
            </nav>
          </div>
          <div className={styles.linkGroup}>
            <h4>Explore</h4>
            <nav aria-label="Explore">
              <FooterNavLink href="/shop-all-products/">All Products</FooterNavLink>
              <FooterNavLink href="/new-arrivals/">New Arrivals</FooterNavLink>
              <FooterNavLink href="/bestsellers/">Bestsellers</FooterNavLink>
              <FooterNavLink href="/deals-and-offers/">Deals & Offers</FooterNavLink>
              <FooterNavLink href="/about-us/">Our Story</FooterNavLink>
            </nav>
          </div>
          <div className={styles.linkGroup}>
            <h4>Customer Service</h4>
            <nav aria-label="Customer Service">
              {customerServiceLinks.map((item) => (
                <FooterNavLink key={item.href} href={item.href}>{item.label}</FooterNavLink>
              ))}
            </nav>
          </div>
          <div className={styles.contacts}>
            <h4>Talk to Us</h4>
            <a href={waLink(site.whatsappNumber)} target="_blank" rel="noopener noreferrer" className="with-ico">
              <WhatsAppIcon size={15} /> {site.phoneDisplay}
            </a>
            <a href={`mailto:${site.email}`} className="with-ico">
              <Mail size={15} /> {site.email}
            </a>
            <span className="with-ico">
              <MapPin size={15} /> {site.city}
            </span>
            <p className="footer-note">Delivering across Pakistan. International shipping will be announced when available.</p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Zelvomart. All rights reserved. · Trusted by Our Customers
          </span>
          <span>
            Designed &amp; developed by{" "}
            <a href="https://webixsolutions.com" target="_blank" rel="noopener" className={styles.credit}>
              Webix Solutions
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

