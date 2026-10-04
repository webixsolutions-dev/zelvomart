import type { Metadata } from "next";
import Link from "next/link";
import { cmsSections } from "@/lib/cms-sections";
import { getCmsPage } from "@/lib/cms-page";
import { metadataForPage } from "@/lib/page-metadata";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage("about-us", []);
}

export default async function AboutPage() {
  const page = await getCmsPage("about-us");
  const sections = cmsSections(page?.bodyHtml);

  return (
    <div className="professional-page professional-about-page">
      <section className="professional-page-hero professional-about-hero">
        <div className="site-shell professional-page-hero-grid">
          <div className="professional-page-hero-copy">
            <span className="premium-overline">THIS IS ZELVOMART</span>
            <h1>Everyday shopping, with a little more thought.</h1>
          </div>
          <div className="professional-page-hero-side">
            <p>We collect practical products people actually use, present them clearly, and keep ordering simple with Cash on Delivery and real WhatsApp support.</p>
            <Link href="/shop" className="professional-inline-link">Explore the collection <span>→</span></Link>
          </div>
        </div>
      </section>

      <section className="site-shell professional-about-story">
        <div className="professional-about-statement">
          <span className="premium-overline">OUR APPROACH</span>
          <h2>Useful products. Clear choices. Human support.</h2>
          <p>A clearer look at what we stand for, how we shop and the experience we want every customer to have.</p>
        </div>

        <div className="professional-about-card-grid">
          {sections.length ? sections.map((section, index) => (
            <article className={`professional-about-content-card ${index === 0 ? "is-featured" : ""}`} key={section.id}>
              <div className="professional-about-card-index">{String(index + 1).padStart(2, "0")}</div>
              {section.title ? <h3>{section.title}</h3> : null}
              <div className="professional-richtext professional-card-richtext" dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
            </article>
          )) : (
            <article className="professional-about-content-card is-featured">
              <div className="professional-about-card-index">01</div>
              <h3>About Zelvomart</h3>
              <p>About-page content can be managed from the admin panel.</p>
            </article>
          )}
        </div>
      </section>

      <section className="professional-values-section">
        <div className="site-shell professional-values-grid">
          <article><span>01</span><h3>Curated, not crowded</h3><p>We focus on practical categories and products instead of filling the store with unnecessary noise.</p></article>
          <article><span>02</span><h3>Clear before checkout</h3><p>Product information, prices and ordering steps are presented so customers know what to expect.</p></article>
          <article><span>03</span><h3>Support that feels real</h3><p>Questions before or after an order can be handled by a real person through WhatsApp or phone.</p></article>
          <article><span>04</span><h3>Made for Pakistan</h3><p>Cash on Delivery and straightforward local support keep the experience familiar and convenient.</p></article>
        </div>
      </section>

      <section className="site-shell professional-page-endcap">
        <div>
          <span className="premium-overline">SHOP ZELVOMART</span>
          <h2>Find something useful for the everyday.</h2>
        </div>
        <Link href="/shop" className="premium-button premium-button-dark">Start shopping <span>→</span></Link>
      </section>
    </div>
  );
}
