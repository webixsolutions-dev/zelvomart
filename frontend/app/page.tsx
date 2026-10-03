import Image from "next/image";
import Link from "next/link";
import Hero from "@/components/Hero";
import TrustStrip from "@/components/TrustStrip";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import PopularCollections from "@/components/PopularCollections";
import Faq from "@/components/Faq";
import FlashDealBanner from "@/components/FlashDealBanner";
import PromoCta from "@/components/PromoCta";
import { getProducts, getStoreBootstrap } from "@/lib/store";

export const revalidate = 120;

export default async function HomePage() {
  const [bootstrap, featured, latest] = await Promise.all([
    getStoreBootstrap(),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ limit: 12 }),
  ]);

  const categories = bootstrap.categories;
  const homeConfig = (bootstrap.settings["homepage.config"] || {}) as any;
  const heroProducts = featured.items.length ? featured.items : latest.items;
  const best = featured.items.length ? featured.items : latest.items.slice(0, 8);

  return (
    <div className="premium-home">
      <Hero products={heroProducts} config={homeConfig} />

      <section className="premium-benefits" aria-label="Store benefits">
        <TrustStrip />
      </section>

      <section className="premium-intro-section">
        <div className="site-shell premium-intro-grid">
          <div>
            <span className="premium-overline">THIS IS ZELVOMART</span>
            <h2>Everyday shopping, with a little more thought.</h2>
          </div>
          <div className="premium-intro-copy">
            <p>We collect practical products people actually use, present them clearly, and keep ordering simple with Cash on Delivery and real WhatsApp support.</p>
            <Link href="/about-us">Our approach <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="section premium-trending-section">
        <div className="site-shell">
          <div className="premium-section-heading">
            <div>
              <span className="premium-overline">TRENDING NOW</span>
              <h2>Find your everyday.</h2>
            </div>
            <Link href="/shop" className="premium-link-pill">Shop everything <span aria-hidden="true">→</span></Link>
          </div>
          <CategoryGrid categories={categories.slice(0, 6)} />
        </div>
      </section>

      <section className="section premium-products-section">
        <div className="site-shell">
          <div className="premium-section-heading">
            <div>
              <span className="premium-overline">CUSTOMER FAVOURITES</span>
              <h2>Popular for good reason.</h2>
              <p>Useful products, clear pricing and no unnecessary guesswork.</p>
            </div>
            <Link href="/shop" className="premium-link-pill">View all products <span aria-hidden="true">→</span></Link>
          </div>
          <ProductGrid products={best} />
        </div>
      </section>

      <section className="section premium-editorial-section">
        <div className="site-shell premium-editorial-grid">
          <Link href="/product-category/fashion-accessories/" className="premium-editorial-card premium-editorial-card-large">
            <div className="premium-editorial-media">
              <Image src="/images/categories/fashion-accessories.webp" alt="Fashion accessories collection" fill sizes="(max-width: 800px) 100vw, 60vw" unoptimized />
            </div>
            <div className="premium-editorial-copy">
              <span>STYLE EDIT</span>
              <h3>Small details. Better everyday style.</h3>
              <b>Shop fashion accessories →</b>
            </div>
          </Link>

          <Link href="/product-category/tech-gadgets/" className="premium-editorial-card premium-editorial-card-small">
            <div className="premium-editorial-media">
              <Image src="/images/categories/tech-gadgets.webp" alt="Tech and gadgets collection" fill sizes="(max-width: 800px) 100vw, 40vw" unoptimized />
            </div>
            <div className="premium-editorial-copy premium-editorial-copy-dark">
              <span>TECH EDIT</span>
              <h3>Upgrade the little things.</h3>
              <b>Shop tech & gadgets →</b>
            </div>
          </Link>
        </div>
      </section>

      <FlashDealBanner />

      <section className="section premium-journey-section" aria-labelledby="zelvo-journey-title">
        <div className="site-shell premium-journey-grid">
          <div className="premium-journey-media">
            <Image
              src="/images/hero/zelvomart-slider-01.webp"
              alt="Everyday products selected by Zelvomart"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              unoptimized
            />
          </div>
          <div className="premium-journey-copy">
            <span className="premium-overline">FROM CLICK TO DOORSTEP</span>
            <h2 id="zelvo-journey-title">Shopping that stays straightforward.</h2>
            <p className="premium-journey-lead">Pick what works for you, confirm the details, then pay when your order arrives.</p>

            <div className="premium-journey-steps">
              <article>
                <span>01</span>
                <div><h3>Choose your find</h3><p>Browse clear collections and product details without unnecessary clutter.</p></div>
              </article>
              <article>
                <span>02</span>
                <div><h3>Confirm with confidence</h3><p>Need a quick check? WhatsApp support is there before you place the order.</p></div>
              </article>
              <article>
                <span>03</span>
                <div><h3>Pay on delivery</h3><p>Your checkout stays familiar with Cash on Delivery across Pakistan.</p></div>
              </article>
            </div>

            <Link href="/shop" className="premium-journey-link">Browse the shop <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <PromoCta
        title="Questions before you order?"
        body="Message Zelvomart on WhatsApp for stock checks, product guidance and delivery information before placing your order."
        buttonText="Chat on WhatsApp"
        buttonHref="https://wa.me/923002026711"
        secondaryText="Contact Us"
        secondaryHref="/contact-us"
      />

      <PopularCollections videos={homeConfig.popularCollectionsVideos || []} />
      <Faq />
    </div>
  );
}
