import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import type { Category } from "@/types/product";

export default function Footer({ categories, phone = "+92 300 2026711", email = "zelvomart@gmail.com" }: { categories: Category[]; phone?: string; email?: string }) {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-grid">
        <div className="footer-brand">
          <BrandLogo />
          <p>Quality-checked products across every category, delivered with Cash on Delivery across Pakistan.</p>
        </div>
        <div><h4>Categories</h4>{categories.slice(0, 7).map((category) => <Link key={category.id} href={`/product-category/${category.slug}/`}>{category.name}</Link>)}</div>
        <div><h4>Customer Service</h4><Link href="/about-us">About Us</Link><Link href="/contact-us">Contact Us</Link><Link href="/track-order">Track Order</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms">Terms & Conditions</Link><Link href="/shipping-delivery">Shipping & Delivery</Link><Link href="/returns-exchange">Returns & Exchange</Link></div>
        <div><h4>Contact</h4><a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a><a href={`mailto:${email}`}>{email}</a><a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a><span>Pakistan</span></div>
      </div>
      <div className="site-shell footer-bottom"><span>© {new Date().getFullYear()} Zelvomart. All rights reserved.</span><span>Cash on Delivery • Quality Checked</span></div>
    </footer>
  );
}
