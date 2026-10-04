import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { metadataForPage } from "@/lib/page-metadata";
import { getStoreBootstrap } from "@/lib/store";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage("contact-us", []);
}

export default async function ContactPage() {
  const bootstrap = await getStoreBootstrap();
  const info = (bootstrap.settings["store.info"] || {}) as { phone?: string; email?: string; whatsapp?: string };
  const phone = String(info.phone || "0300-2026711");
  const email = String(info.email || "zelvomart@gmail.com");
  const whatsapp = String(info.whatsapp || "923002026711");
  const cleanWhatsapp = whatsapp.replace(/\D/g, "") || "923002026711";

  return (
    <div className="professional-page professional-contact-page">
      <section className="professional-page-hero professional-contact-hero">
        <div className="site-shell professional-page-hero-grid">
          <div className="professional-page-hero-copy">
            <span className="premium-overline">CONTACT ZELVOMART</span>
            <h1>Real help, when you need it.</h1>
          </div>
          <div className="professional-page-hero-side">
            <p>Questions about a product, an order or delivery? Send us the details and our support team will point you in the right direction.</p>
            <a href={`https://wa.me/${cleanWhatsapp}`} target="_blank" rel="noreferrer" className="professional-inline-link">Chat on WhatsApp <span>→</span></a>
          </div>
        </div>
      </section>

      <section className="site-shell professional-contact-layout">
        <div className="professional-contact-details">
          <span className="premium-overline">DIRECT SUPPORT</span>
          <h2>Choose the easiest way to reach us.</h2>
          <div className="professional-contact-cards">
            <a href={`https://wa.me/${cleanWhatsapp}`} target="_blank" rel="noreferrer">
              <span>01</span><div><b>WhatsApp</b><p>Fast help with products, stock checks and orders.</p><strong>{phone}</strong></div>
            </a>
            <a href={`tel:${phone.replace(/\s/g, "")}`}>
              <span>02</span><div><b>Phone</b><p>Speak directly with the support team.</p><strong>{phone}</strong></div>
            </a>
            <a href={`mailto:${email}`}>
              <span>03</span><div><b>Email</b><p>Best for detailed questions and written follow-up.</p><strong>{email}</strong></div>
            </a>
          </div>
          <div className="professional-contact-note">
            <span>SUPPORT NOTE</span>
            <p>If your message is about an existing order, include your order number and the same phone number used at checkout.</p>
          </div>
        </div>

        <ContactForm whatsapp={whatsapp} />
      </section>

      <section className="site-shell professional-page-endcap professional-contact-endcap">
        <div>
          <span className="premium-overline">ORDER ALREADY PLACED?</span>
          <h2>Track it before you contact support.</h2>
        </div>
        <Link href="/track-order" className="premium-button premium-button-dark">Track order <span>→</span></Link>
      </section>
    </div>
  );
}
