import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cmsSections } from "@/lib/cms-sections";
import { getCmsPage } from "@/lib/cms-page";
import { metadataForPage } from "@/lib/page-metadata";
import { getProductBySlug, getProducts, getStoreBootstrap } from "@/lib/store";
import { getProductFallbackImage } from "@/lib/product-media";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage("about-us", []);
}

export default async function AboutPage() {
  const [page, bootstrap, latest] = await Promise.all([
    getCmsPage("about-us"),
    getStoreBootstrap(),
    getProducts({ sort: "newest", limit: 6 }),
  ]);
  const sections = cmsSections(page?.bodyHtml);
  const lead = latest.items[0];
  const detailedProducts = await Promise.all(
    latest.items.slice(0, 6).map(async (product) => (await getProductBySlug(product.slug)) || product),
  );
  const liveReviews = detailedProducts.flatMap((product) =>
    (product.reviews || []).map((review) => ({ ...review, productName: product.name })),
  ).slice(0, 3);

  return (
    <div className="mock-about-page">
      <section className="site-shell mock-about-hero">
        <div>
          <span className="mock-eyebrow">ABOUT ZELVOMART</span>
          <h1>Small things.<br /><em>Better chosen.</em></h1>
          <p>Zelvomart is built around a simple idea: everyday shopping should feel clearer, more useful and more human.</p>
          <Link href="/shop" className="mock-btn-dark">Shop Zelvomart →</Link>
        </div>
        <div>
          {lead ? (
            <Image src={lead.image || getProductFallbackImage(lead)} alt={lead.name} fill priority sizes="(max-width: 900px) 100vw, 50vw" />
          ) : (
            <Image src="/images/hero/zelvomart-hero.webp" alt="Zelvomart products" fill priority sizes="(max-width: 900px) 100vw, 50vw" />
          )}
        </div>
      </section>

      <section className="site-shell mock-about-stats">
        <article><b>{bootstrap.categories.length || 7}</b><span>live categories</span></article>
        <article><b>{latest.total || latest.items.length}</b><span>products in catalog</span></article>
        <article><b>COD</b><span>across Pakistan</span></article>
        <article><b>100%</b><span>human support</span></article>
      </section>

      <section className="site-shell mock-about-story">
        <div><span className="mock-eyebrow">OUR STORY</span><h2>We started with one question: why is online shopping so noisy?</h2></div>
        <div>
          {sections.length ? (
            <div className="mock-about-cms">
              {sections.slice(0, 3).map((section) => (
                <article key={section.id}>{section.title ? <h3>{section.title}</h3> : null}<div dangerouslySetInnerHTML={{ __html: section.bodyHtml }} /></article>
              ))}
            </div>
          ) : (
            <><p>Too many stores make simple purchases harder than they need to be. We wanted a place where useful products are easy to understand, easy to order and backed by a real person when you need help.</p><p>That means clear product information, Cash on Delivery and a final check before dispatch.</p></>
          )}
        </div>
      </section>

      <section className="mock-about-how">
        <div className="site-shell">
          <span className="mock-eyebrow">HOW WE WORK</span><h2>From useful find to your doorstep.</h2>
          <div className="mock-step-grid">
            <article><b>01</b><h3>We find</h3><p>Practical products people actually use.</p></article>
            <article><b>02</b><h3>We check</h3><p>Details, condition and presentation before dispatch.</p></article>
            <article><b>03</b><h3>You order</h3><p>A simple checkout with Cash on Delivery.</p></article>
            <article className="dark"><b>04</b><h3>We stay around</h3><p>Real WhatsApp support before and after your order.</p></article>
          </div>
        </div>
      </section>

      <section className="mock-about-promise">
        <div className="site-shell">
          <div><span className="mock-eyebrow">THE ZELVO PROMISE</span><h2>What we refuse to compromise on.</h2></div>
          <div className="mock-about-promise-grid">
            <article><span>✓</span><h3>Clear descriptions</h3><p>No unnecessary confusion before you buy.</p></article>
            <article><span>✓</span><h3>Checked orders</h3><p>Eligible products are checked before dispatch.</p></article>
            <article><span>✓</span><h3>Real support</h3><p>Talk to a person, not just a bot.</p></article>
            <article><span>✓</span><h3>Simple payment</h3><p>Pay cash when your parcel arrives.</p></article>
          </div>
        </div>
      </section>

      {liveReviews.length ? (
        <section className="site-shell mock-about-testimonials">
          <span className="mock-eyebrow">CUSTOMER WORDS</span><h2>Real reviews from the catalog.</h2>
          <div>
            {liveReviews.map((review) => (
              <article key={review.id}><p>“{review.body}”</p><b>— {review.name} · {review.productName}</b></article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="site-shell mock-about-cta">
        <div><span className="mock-eyebrow">READY TO BROWSE?</span><h2>Find something worth keeping.</h2><p>Useful everyday products, picked with more care.</p></div>
        <Link href="/shop">Shop all products →</Link>
      </section>
    </div>
  );
}
