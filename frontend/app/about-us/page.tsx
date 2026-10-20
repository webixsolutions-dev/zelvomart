import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Boxes, ClipboardCheck, Headphones, Home, Heart, Dumbbell, Sparkles, PackageCheck, Truck, ShieldCheck, Eye, HeartHandshake } from "lucide-react";
import { WhatsAppBand, CategoryGrid } from "@/components/launch/home/Blocks";
import { SectionHead } from "@/components/launch/ui/SectionHead";
import { Breadcrumbs } from "@/components/launch/ui/Breadcrumbs";
import { FaqAccordion } from "@/components/launch/ui/FaqAccordion";
import { faqs } from "@/lib/launch/content";
import { WhatsAppIcon } from "@/components/launch/ui/BrandIcons";
import { site } from "@/lib/launch/site";

export const metadata: Metadata = {
  title: { absolute: "About Zelvomart: Online Store in Lahore, Pakistan" },
  description:
    "Zelvomart is a Lahore-based online store selling everyday products in seven categories. Every order is checked before dispatch and sent across Pakistan.",
  alternates: { canonical: "/about-us/" },
};

/** "Zelvomart at a glance": short, quotable facts, all from the store settings. */
const glance: [string, string][] = [
  ["Name", site.name],
  ["Based in", site.city],
  [
    "What we sell",
    "Everyday products in seven categories: home and living, home decor, beauty and personal care, tech and gadgets, fashion accessories, sports and fitness, kids and toys",
  ],
  ["How to order", `zelvomart.com, WhatsApp ${site.phoneDisplay}, Facebook Messenger or Instagram`],
  ["Payment", "Cash on Delivery"],
  ["Delivery", `Across Pakistan, usually ${site.shipping.estimate} depending on the city`],
  ["Support", `WhatsApp and email, ${site.supportHours}`],
  ["Started", "July 2026"],
  ["Co-founder", site.founder],
];

const categories = [
  { icon: Home, label: "Home & Living" },
  { icon: Sparkles, label: "Beauty & Personal Care" },
  { icon: Boxes, label: "Tech & Gadgets" },
  { icon: Heart, label: "Fashion Accessories" },
  { icon: Home, label: "Home Décor" },
  { icon: Dumbbell, label: "Fitness & Lifestyle" },
  { icon: HeartHandshake, label: "Kids & Family" },
];

const steps = [
  { icon: Eye, title: "Find your everyday.", sub: "Browse clean listings with honest photos, clear specs and straightforward pricing." },
  { icon: ClipboardCheck, title: "Let us pack it.", sub: "Every order is inspected and carefully packed before it leaves our Lahore fulfilment centre." },
  { icon: PackageCheck, title: "Arriving, no rush.", sub: "Track your order. We deliver nationwide and confirm by WhatsApp before dispatch." },
  { icon: ShieldCheck, title: "Always supported.", sub: "Real people on WhatsApp before and after you buy. Not a chatbot — a real conversation." },
];

const confidenceChecks = [
  "Clear what you're ordering",
  "Clear what you'll pay",
  "Clear about return policy",
];

export default function Page() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="hero hero-short about-hero">
        <picture className="hero-art">
          <img
            src="/launch/images/about-hero.webp"
            alt="Curated everyday essentials by Zelvomart"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="container hero-inner">
          <div className="hero-content">
            <Breadcrumbs items={[{ label: "About Us" }]} inHero />
            <div className="eyebrow">About us</div>
            <h1>About Zelvomart.<br /><em>Everyday things, chosen better.</em></h1>
            <p>
              Zelvomart is a curated online store — we stock what matters for everyday life in
              Pakistan, describe it clearly, pack it carefully and deliver it to your doorstep with
              Cash on Delivery nationwide.
            </p>
            <div className="hero-buttons">
              <Link className="btn" href="/shop-all-products/">
                Shop the collection <ArrowRight size={16} />
              </Link>
              <Link className="btn secondary" href="/contact-us/">
                Speak to us <ArrowRight size={16} />
              </Link>
            </div>
            <p className="about-hero-note">
              <WhatsAppIcon size={15} /> Real support on WhatsApp. Always a person.
            </p>
          </div>
        </div>
      </section>

      {/* ── A more considered way to shop ── */}
      <section className="section about-considered">
        <div className="container about-considered-grid">
          <div className="about-considered-copy">
            <h2>A more considered<br />way to shop.</h2>
          </div>
          <div className="about-considered-detail">
            <div className="eyebrow">Built in practice. Clear in words.</div>
            <h3>How a Zelvomart order actually works, and why it matters.</h3>
            <p>
              Every product on Zelvomart is selected, listed and packed by our own team. We don&apos;t
              drop-ship from random warehouses. You get real photos, measured specs and a support
              team on WhatsApp that actually replies.
            </p>
            <p>
              We started small — a handful of items we could stand behind — and we&apos;re growing based
              on what customers in Pakistan actually need. Not trending, not random. Useful.
            </p>
          </div>
        </div>
      </section>

      {/* ── For the many sides of your everyday ── */}
      <section className="section section-soft about-sides">
        <div className="container about-sides-grid">
          <div className="about-sides-media">
            <Image
              src="/about us and contact us/careful-packing.webp"
              alt="Careful hands, thoughtful packing"
              fill
              sizes="(max-width:760px) 100vw, 580px"
              className="about-sides-photo"
            />
          </div>
          <div className="about-sides-copy">
            <div className="eyebrow">Seven categories, one standard.</div>
            <h2>For the many sides<br />of your everyday.</h2>
            <ul className="about-category-list">
              {categories.map((c) => (
                <li key={c.label}>
                  <span className="about-cat-ico"><c.icon size={18} /></span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── From our stock to your doorstep ── */}
      <section className="section about-process">
        <div className="container">
          <div className="about-process-head">
            <h2>From our stock<br /><em>to your doorstep.</em></h2>
          </div>
          <div className="about-process-grid">
            {steps.map((s, i) => (
              <article className="about-process-card" key={s.title}>
                <span className="about-process-ico"><s.icon size={22} /></span>
                <small>Step {String(i + 1).padStart(2, "0")}</small>
                <h3>{s.title}</h3>
                <p>{s.sub}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Confidence is in the details ── */}
      <section className="section about-confidence">
        <div className="container about-confidence-grid">
          <div className="about-confidence-copy">
            <div className="eyebrow light">Shopping with confidence</div>
            <h2>Confidence is<br />in the details.</h2>
            <p>Every listing is written to answer your questions before you need to ask.</p>
            <Link className="btn secondary" href="/shop-all-products/">
              Browse the store <ArrowRight size={16} />
            </Link>
          </div>
          <div className="about-confidence-checks">
            {confidenceChecks.map((c) => (
              <div className="about-conf-item" key={c}>
                <span className="about-conf-check"><Check size={16} /></span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Get to know Zelvomart / FAQ ── */}
      <section className="section about-know">
        <div className="container about-know-grid">
          <div className="about-know-copy">
            <div className="eyebrow">Building trust</div>
            <h2>Get to know<br />Zelvomart.</h2>
            <p>The questions most people ask before their first order.</p>
            <div className="glance">
              <h3>Zelvomart at a glance</h3>
              <dl>
                {glance.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Link className="pill" href="/faqs/">
              See all FAQs <ArrowRight size={14} />
            </Link>
          </div>
          <div className="about-know-faq">
            <FaqAccordion items={faqs.slice(0, 5)} />
          </div>
        </div>
      </section>
    </>
  );
}
