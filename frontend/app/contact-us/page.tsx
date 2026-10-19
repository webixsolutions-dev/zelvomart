import {getSetting} from "@/lib/settings";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, PackageSearch, ArrowUpRight, RefreshCw, HelpCircle } from "lucide-react";
import { site } from "@/lib/launch/site";
import { faqs } from "@/lib/launch/content";
import { waLink } from "@/lib/launch/format";
import { SectionHead } from "@/components/launch/ui/SectionHead";
import { Breadcrumbs } from "@/components/launch/ui/Breadcrumbs";
import { FaqAccordion } from "@/components/launch/ui/FaqAccordion";
import { WhatsAppIcon } from "@/components/launch/ui/BrandIcons";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: { absolute: "Contact Zelvomart: WhatsApp, Phone & Email" },
  description: `Contact Zelvomart on WhatsApp at ${site.phoneDisplay} or by email. Ask about products, orders or delivery; our Lahore team replies Monday to Saturday.`,
  alternates: { canonical: "/contact-us/" },
};

const socialLinks: [string, string][] = [
  ["Facebook", site.social.facebook],
  ["Instagram", site.social.instagram],
  ["Pinterest", site.social.pinterest],
  ["LinkedIn", site.social.linkedin],
  ["X", site.social.x],
  ["TikTok", site.social.tiktok],
  ["YouTube", site.social.youtube],
];

const quickLinks = [
  {
    icon: PackageSearch,
    eyebrow: "My order update",
    title: "Track my order",
    sub: "Check the status of your delivery. All you need is your order number and the phone number you used.",
    href: "/track-your-order/",
  },
  {
    icon: RefreshCw,
    eyebrow: "Returns & Exchange",
    title: "Returns & exchange",
    sub: "Something not quite right? Start a return or exchange request. We'll guide you through the process.",
    href: "/refund-and-return-policy/",
  },
  {
    icon: HelpCircle,
    eyebrow: "Explore our products",
    title: "Ask about a product",
    sub: "Need more detail about a specific item — size, colour, materials? We're happy to help before you buy.",
    href: "/shop-all-products/",
  },
];

export default async function Page() {
  const info=await getSetting<{phone?:string;email?:string;whatsapp?:string}>('store.info',{});
  const store={...site,phoneDisplay:info.phone||site.phoneDisplay,email:info.email||site.email,whatsappNumber:String(info.whatsapp||site.whatsappNumber).replace(/\D/g,'')};
  return (
    <>
      {/* ── Hero ── */}
      <section className="hero hero-short contact-hero">
        <picture className="hero-art">
          <img
            src="/launch/extra/contact-desktop.webp"
            alt="Warm and responsive customer concierge support at Zelvomart"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="container hero-inner">
          <div className="hero-content">
            <Breadcrumbs items={[{ label: "Contact Us" }]} inHero />
            <div className="eyebrow">Contact us</div>
            <h1>Contact Zelvomart.<br /><em>Real people, real answers.</em></h1>
            <p>
              Got a question about a product, your order or delivery with Zelvomart? We're here for that —
              real help, nothing scripted, one message at a time.
            </p>
            <div className="hero-buttons">
              <a className="btn wa" href={waLink(store.whatsappNumber, "Hi Zelvomart! I have a question.")} target="_blank" rel="noopener noreferrer">
                Chat on WhatsApp <ArrowRight size={16} />
              </a>
            </div>
            <p className="contact-hero-note">
              <WhatsAppIcon size={14} /> Typical reply time: a few hours during support hours.
            </p>
          </div>
        </div>
      </section>

      {/* ── Contact cards ── */}
      <section className="section contact-reach">
        <div className="container">
          <div className="contact-cards-row">
            {/* WhatsApp card */}
            <a className="contact-card contact-card-wa" href={waLink(store.whatsappNumber)} target="_blank" rel="noopener noreferrer">
              <span className="contact-card-ico wa-ico">
                <WhatsAppIcon size={24} />
              </span>
              <h3>WhatsApp</h3>
              <p className="contact-card-number">{store.phoneDisplay}</p>
              <p className="contact-card-desc">
                Message us directly — we reply with real answers, not a script. Usually within a few hours during support hours.
              </p>
              <span className="link-cta">
                Start a conversation <ArrowUpRight size={14} />
              </span>
            </a>

            {/* Email card */}
            <a className="contact-card" href={`mailto:${store.email}`}>
              <span className="contact-card-ico">
                <Mail size={24} />
              </span>
              <h3>Email us</h3>
              <p className="contact-card-number">{store.email}</p>
              <p className="contact-card-desc">
                For longer questions or if you prefer email, write to us and we&apos;ll get back to you within 24 hours.
              </p>
              <span className="link-cta">
                Write an email <ArrowUpRight size={14} />
              </span>
            </a>

            {/* Support hours card */}
            <div className="contact-card">
              <span className="contact-card-ico">
                <Clock size={24} />
              </span>
              <h3>Support hours</h3>
              <p className="contact-card-number">{site.supportHours}</p>
              <p className="contact-card-desc">
                We respond to messages received during these hours. Messages sent outside hours are picked up the next working day.
              </p>
              <span className="link-cta">
                View our hours <ArrowUpRight size={14} />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact details as plain text (readable and quotable by search engines and AI tools) ── */}
      <section className="section pt-0 contact-details">
        <div className="container">
          <address className="contact-facts">
            <h2>Zelvomart contact details</h2>
            <dl>
              <div>
                <dt>WhatsApp &amp; phone</dt>
                <dd>
                  <a href={waLink(store.whatsappNumber)} target="_blank" rel="noopener noreferrer">{store.phoneDisplay}</a>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${store.email}`}>{store.email}</a>
                </dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{site.city}</dd>
              </div>
              <div>
                <dt>Support hours</dt>
                <dd>{site.supportHours}</dd>
              </div>
            </dl>
            <p className="contact-social-label">Follow Zelvomart</p>
            <ul className="contact-social">
              {socialLinks.map(([label, href]) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
                </li>
              ))}
            </ul>
          </address>
        </div>
      </section>

      {/* ── Quick links ── */}
      <section className="section section-soft contact-quick">
        <div className="container">
          <div className="contact-quick-head">
            <div className="eyebrow">Explore by topic</div>
            <h2>Let&apos;s get you to the right place.</h2>
          </div>
          <div className="contact-quick-grid">
            {quickLinks.map((l) => (
              <Link className="contact-quick-card" href={l.href} key={l.title}>
                <span className="contact-quick-ico"><l.icon size={22} /></span>
                <small>{l.eyebrow}</small>
                <h3>{l.title} <ArrowUpRight size={15} /></h3>
                <p>{l.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact form + FAQ ── */}
      <section className="section contact-desk-section">
        <div className="container contact-desk">
          <div className="contact-form-panel">
            <div className="contact-form-head">
              <div>
                <div className="eyebrow">Please fill this form</div>
                <h2>Start with<br />a few details.</h2>
                <p>
                  Just let us know what you&apos;re looking for. A product query, order update, return request or
                  something else — we&apos;ll get back to you.
                </p>
              </div>
              <span className="contact-reply-pill">
                <MessageCircle size={14} /> Typical reply: a few hours
              </span>
            </div>

            {/* Info box within form */}
            <div className="contact-dispatch-box">
              <div className="contact-dispatch-inner">
                <strong>Based in Lahore, Pakistan.</strong>
                <p>
                  All orders are packed and dispatched by Zelvomart directly. No dropshipping,
                  no middlemen — just real people and real answers.
                </p>
              </div>
            </div>

            <div className="launch-legacy"><ContactForm whatsapp={store.whatsappNumber}/></div>

            <p className="fine-print">
              This form opens WhatsApp with your enquiry. For privacy, never share PINs or OTPs.{" "}
              <Link href="/privacy-policy/">Privacy policy</Link>.
            </p>
          </div>

          <aside className="contact-faq-panel">
            <div className="contact-faq-head">
              <div className="eyebrow">Getting started</div>
              <h2>A little clarity,<br />right here.</h2>
              <p>
                Answers to the most common questions about ordering, delivery
                and getting in touch.
              </p>
              <Link className="pill" href="/faqs/">
                Read more FAQs <ArrowRight size={14} />
              </Link>
            </div>
            <FaqAccordion items={faqs.slice(0, 6)} />
          </aside>
        </div>
      </section>
    </>
  );
}
