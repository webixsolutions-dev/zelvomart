import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import type { Category } from "@/types/product";

export default function Footer({ categories, phone = "+92 300 2026711", email = "zelvomart@gmail.com" }: { categories: Category[]; phone?: string; email?: string }) {
  const digits = phone.replace(/\D/g, "");
  return (
    <footer className="site-footer brand-footer">
      <div className="site-shell footer-grid">
        <div className="footer-brand">
          <BrandLogo />
          <p>A modern Pakistani marketplace for useful everyday products, straightforward shopping and Cash on Delivery.</p>
          <div className="footer-brand-pills"><span>COD</span><span>Quality Checked</span><span>Pakistan-wide</span></div>
        </div>
        <div><h4>Shop</h4>{categories.slice(0, 6).map((category) => <Link key={category.id} href={`/product-category/${category.slug}/`}>{category.name}</Link>)}</div>
        <div><h4>Help & Company</h4><Link href="/about-us">About Zelvomart</Link><Link href="/contact-us">Contact Us</Link><Link href="/track-order">Track Order</Link><Link href="/shipping-delivery">Shipping & Delivery</Link><Link href="/returns-exchange">Returns & Exchange</Link><Link href="/faq">FAQs</Link></div>
        <div><h4>Contact</h4><a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a><a href={`mailto:${email}`}>{email}</a><a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">WhatsApp</a><span>Serving customers across Pakistan</span><div className="footer-legal-links"><Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link></div></div>
      </div>
      <div className="site-shell footer-bottom"><span>© {new Date().getFullYear()} Zelvomart. All rights reserved.</span><span>Useful finds • Real support • Cash on Delivery</span></div>
    </footer>
  );
}
