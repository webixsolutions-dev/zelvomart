import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Bell, Clock, Heart, History, Mail, Truck, Wallet, Zap } from "lucide-react";
import { site } from "@/lib/site";
import { faqs } from "@/lib/content";
import { waLink } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { AccountAuth, AccountDashboard, AccountSnapshot } from "@/components/pages/AccountView";

export const metadata: Metadata = { title: "My Account", robots: { index: false } };

const trust = [
  { icon: Wallet, label: "Cash on Delivery nationwide" },
  { icon: Truck, label: site.fulfilment.dispatch },
  { icon: BadgeCheck, label: `${site.returns.windowDays}-day easy returns` },
];

const perks = [
  { icon: Zap, title: "Faster checkout", sub: "Your name, phone and address saved — checkout in a couple of taps." },
  { icon: History, title: "Full order history", sub: "Every order, its items and totals in one place, on any device." },
  { icon: Heart, title: "Wishlist that follows you", sub: "Save on your phone, buy later on your laptop. Nothing gets lost." },
  { icon: Bell, title: "First to know", sub: "Early word on new arrivals, restocks and member-only deals." },
];

const accountFaqs = faqs.filter((f) => f.group === "Orders" || f.group === "Returns");

export default function Page() {
  return (
    <div className="account-page">
      {/* ── Hero ── */}
      <section className="acc-hero">
        <div className="container acc-hero-inner">
          <div className="acc-hero-copy">
            <Breadcrumbs items={[{ label: "My Account" }]} inHero />
            <div className="eyebrow">Customer account</div>
            <h1>
              Your orders &amp; saved picks.
              <br />
              <em>All in one place.</em>
            </h1>
            <p>
              Track parcels, revisit what you&apos;ve ordered and pick up right where you left off — with real people on WhatsApp whenever
              you need a hand.
            </p>
            <ul className="acc-trust">
              {trust.map((t) => (
                <li key={t.label}>
                  <t.icon size={15} /> {t.label}
                </li>
              ))}
            </ul>
          </div>
          <AccountSnapshot />
        </div>
      </section>

      {/* ── Sign in + dashboard ── */}
      <section className="section acc-main">
        <div className="container acc-grid">
          <AccountAuth />
          <AccountDashboard />
        </div>
      </section>

      {/* ── Account perks ── */}
      <section className="section acc-perks-section">
        <div className="container">
          <div className="acc-section-head">
            <div>
              <div className="eyebrow">Why create an account</div>
              <h2>What your account unlocks.</h2>
              <p>Accounts are launching soon. Until then, guest checkout works exactly the same — no sign-up needed.</p>
            </div>
            <span className="acc-soon-pill">
              <Clock size={14} /> Launching soon
            </span>
          </div>
          <div className="acc-perks">
            {perks.map((p, i) => (
              <div className="acc-perk" key={p.title}>
                <span className="acc-perk-no">0{i + 1}</span>
                <span className="acc-perk-ico">
                  <p.icon size={22} />
                </span>
                <h3>{p.title}</h3>
                <p>{p.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Help + FAQ ── */}
      <section className="section acc-help-section">
        <div className="container acc-help">
          <div className="acc-help-card">
            <div className="eyebrow light">Need a hand?</div>
            <h2>Talk to a real person.</h2>
            <p>
              Questions about an order, a delivery or a return? Message us — we reply with real answers, usually within a few hours during
              support hours.
            </p>
            <div className="acc-help-actions">
              <a className="btn wa" href={waLink(site.whatsappNumber, "Hi Zelvomart! I have a question about my order.")} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={17} /> Chat on WhatsApp
              </a>
              <a className="btn acc-btn-glass" href={`mailto:${site.email}`}>
                <Mail size={16} /> Email us
              </a>
            </div>
            <ul className="acc-help-meta">
              <li>
                <WhatsAppIcon size={14} /> {site.phoneDisplay}
              </li>
              <li>
                <Mail size={14} /> {site.email}
              </li>
              <li>
                <Clock size={14} /> {site.supportHours}
              </li>
            </ul>
          </div>

          <div className="acc-faq">
            <div className="acc-faq-head">
              <div className="eyebrow">Orders &amp; returns</div>
              <h2>Quick answers.</h2>
              <Link className="pill" href="/faqs/">
                All FAQs <ArrowRight size={14} />
              </Link>
            </div>
            <FaqAccordion items={accountFaqs} />
          </div>
        </div>
      </section>
    </div>
  );
}
