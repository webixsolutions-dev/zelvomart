import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { launchProducts } from "@/lib/launch/server";
import { homeFaqs } from "@/lib/launch/content";
import { site } from "@/lib/launch/site";
import { HeroSlider } from "@/components/launch/home/HeroSlider";
import { Hero } from "@/components/launch/home/Hero";
import { CategoryGrid, CollectionCards, ProcessSteps, TrustStrip, WhatsAppBand } from "@/components/launch/home/Blocks";
import { SectionHead } from "@/components/launch/ui/SectionHead";
import { ProductTabs } from "@/components/launch/home/ProductTabs";
import { WatchDiscover } from "@/components/launch/home/WatchDiscover";
import { BrandPromise } from "@/components/launch/home/BrandPromise";
import { FaqAccordion, FaqJsonLd } from "@/components/launch/ui/FaqAccordion";

export const metadata: Metadata = {
  title: { absolute: "Zelvomart | Online Shopping in Pakistan, Cash on Delivery" },
  description:
    "Zelvomart is an online store in Pakistan for home, decor, beauty, tech, fashion, fitness and kids’ products. Order online or on WhatsApp, pay on delivery.",
  alternates: { canonical: "/" },
};

/** WebSite + Organization data so search engines learn the brand name "Zelvomart" (read from the home page). */
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  alternateName: ["Zelvo Mart", "Zelvomart Pakistan"],
  url: `${site.url}/`,
};

export const revalidate=30;
export default async function HomePage() {
  const responses=await Promise.allSettled([launchProducts('sort=popular&tag=best-selling&limit=8'),launchProducts('sort=newest&limit=8'),launchProducts('tag=discount&limit=8')]);
  const [best,fresh,deals]=responses.map(r=>r.status==='fulfilled'?r.value.items:[]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <HeroSlider />
      {responses.some(r=>r.status==='rejected')&&<div className="container" role="status"><p>Some products are temporarily unavailable. Please refresh or contact us for help.</p></div>}
      <section className="trust-section home-trust" aria-label="Why shop with Zelvomart">
        <div className="container">
          <TrustStrip />
        </div>
      </section>

      <section className="section home-categories" id="categories">
        <div className="container">
          <SectionHead eyebrow="Seven ways to shop" title="Shop by Category" sub="Seven Zelvomart categories, from home and decor to beauty, tech, fashion, fitness and kids." href="/shop-all-products/" linkLabel="All products" />
          <CategoryGrid />
        </div>
      </section>

      <section className="section home-trending">
        <div className="container">
          <ProductTabs
            tabs={[
              { key: "best", label: "Bestsellers", href: "/bestsellers/", items: best },
              { key: "new", label: "New In", href: "/new-arrivals/", items: fresh.slice(0, 8) },
              { key: "deals", label: "On Sale", href: "/deals-and-offers/", items: deals },
            ]}
          />
        </div>
      </section>

      <div className="home-deals">
        <Hero
          as="h2"
          size="band"
          desktop="/launch/homemobile/deals-desktop.webp"
          mobile="/launch/homemobile/deals-mobile.webp"
          alt="Zelvomart deals on bags, toys, beauty and home products in Pakistan"
          eyebrow="Deals & Offers"
          title={
            <>
              Deals in Pakistan
              <br />
              <em>you’ll actually want.</em>
            </>
          }
          sub="Discount offers across all seven Zelvomart categories, with the regular price shown beside every sale price, so you know exactly what you save."
          buttons={[{ label: "Shop all deals", href: "/deals-and-offers/" }]}
        />
      </div>

      <section className="section home-collections">
        <div className="container">
          <SectionHead eyebrow="Curated edits" title="Shop by Collection" sub="Handpicked edits to make browsing easy." />
          <CollectionCards />
        </div>
      </section>

      <section className="section home-shorts">
        <div className="container">
          <WatchDiscover />
        </div>
      </section>

      <section className="section home-journey">
        <div className="container">
          <SectionHead eyebrow="How it works" title="How Ordering From Zelvomart Works" sub="Choose online, confirm on a call or WhatsApp, pay cash when your parcel arrives." />
          <ProcessSteps />
        </div>
      </section>

      <section className="section home-promise">
        <div className="container">
          <BrandPromise />
        </div>
      </section>

      <section className="section pt-0 home-whatsapp">
        <div className="container">
          <WhatsAppBand />
        </div>
      </section>

      <section className="section section-soft home-faq">
        <div className="container">
          <div className="faq-stage">
            <div className="split faq-split">
              <div className="faq-copy">
                <SectionHead eyebrow="Good to know" title="Questions About Zelvomart, Answered" sub="Everything you need to know before you order." />
                <FaqAccordion items={homeFaqs} />
                <FaqJsonLd items={homeFaqs} />
              </div>
              <div className="support-card">
                <span className="support-glow" aria-hidden="true" />
                <div className="eyebrow">Customer support</div>
                <h2>Need to know something before ordering?</h2>
                <p>Ask about sizes, colours, delivery to your city or anything else — we&apos;ll reply with real information, not a script.</p>
                <div className="support-actions">
                  <Link href="/contact-us/" className="btn secondary">
                    Contact our team <ArrowRight size={16} />
                  </Link>
                  <Link href="/faqs/" className="btn ghost">
                    All FAQs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
