import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  WhatsAppIcon,
  XSocialIcon,
  YouTubeIcon,
} from "@/components/Icons";
import type { Category } from "@/types/product";

const SOCIALS = [
  { label: "Facebook", href: "https://www.facebook.com/zelvomart/", icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/zelvomart", icon: InstagramIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/zelvomart", icon: LinkedInIcon },
  { label: "X", href: "https://x.com/zelvomart", icon: XSocialIcon },
  { label: "YouTube", href: "https://www.youtube.com/@ZelvoMart", icon: YouTubeIcon },
];

export default function Footer({ categories, phone = "0300-2026711", email = "zelvomart@gmail.com" }: { categories: Category[]; phone?: string; email?: string }) {
  const whatsapp = phone.replace(/\D/g, "").replace(/^0/, "92");
  return (
    <footer className="mock-footer">
      <div className="site-shell mock-footer-grid">
        <div className="mock-footer-brand">
          <BrandLogo />
          <p>Everyday things, chosen better — checked by hand and delivered across Pakistan with Cash on Delivery.</p>
          <div className="mock-socials">
            {SOCIALS.map(({ label, href, icon: Icon }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>
        <div className="mock-footer-col"><h4>SHOP</h4>{categories.slice(0,7).map((category)=><Link key={category.id} href={`/product-category/${category.slug}/`}>{category.name}</Link>)}</div>
        <div className="mock-footer-col"><h4>HELP</h4><Link href="/track-order">Track order</Link><Link href="/shipping-delivery">Shipping & delivery</Link><Link href="/returns-exchange">Returns & exchange</Link><Link href="/faq">FAQs</Link><Link href="/contact-us">Contact us</Link></div>
        <div className="mock-footer-col"><h4>COMPANY</h4><Link href="/about-us">About Zelvomart</Link><Link href="/blog">Blog</Link><Link href="/privacy-policy">Privacy policy</Link><Link href="/terms">Terms & conditions</Link></div>
        <div className="mock-footer-col mock-footer-contact"><h4>TALK TO US</h4><a href={`tel:${phone.replace(/\D/g, "")}`}>⌕&nbsp; {phone}</a><a href={`mailto:${email}`}>✉&nbsp; {email}</a><span>⌖&nbsp; Lahore, Pakistan</span><a className="mock-footer-wa" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={15}/> Join WhatsApp Channel</a></div>
      </div>
      <div className="site-shell mock-footer-bottom zm-footer-bottom-bar">
        <span>© {new Date().getFullYear()} Zelvomart. All rights reserved. · Trusted by Our Customers</span>
        <span className="zm-footer-credit">Developed by Webix</span>
      </div>
    </footer>
  );
}
