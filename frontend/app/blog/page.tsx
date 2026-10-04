import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cmsSections } from "@/lib/cms-sections";
import { getCmsPageStrict } from "@/lib/cms-page";
import { metadataForPage } from "@/lib/page-metadata";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPage("blog", []);
}

export default async function BlogPage() {
  const page = await getCmsPageStrict("blog");
  const rawBlogHtml = String(page?.bodyHtml || "");
  const isLegacyPlaceholder =
    rawBlogHtml.includes("Useful ideas for everyday shopping") &&
    rawBlogHtml.includes("Shopping guides") &&
    rawBlogHtml.includes("Order and delivery updates");
  const sections = cmsSections(isLegacyPlaceholder ? "" : rawBlogHtml);
  const livePageTitle = isLegacyPlaceholder ? undefined : page?.title;
  const featured = sections[0];
  const remaining = sections.slice(1);

  return (
    <div className="professional-page professional-blog-page">
      <section className="professional-page-hero professional-blog-hero">
        <div className="site-shell professional-page-hero-grid">
          <div className="professional-page-hero-copy">
            <span className="premium-overline">ZELVOMART JOURNAL</span>
            <h1>Useful reads for smarter everyday shopping.</h1>
          </div>
          <div className="professional-page-hero-side">
            <p>Buying guidance, product stories and store updates published directly from the Zelvomart content system.</p>
            <Link href="/shop" className="professional-inline-link">Explore the store <span>→</span></Link>
          </div>
        </div>
      </section>

      <section className="site-shell professional-blog-showcase">
        <div className="professional-blog-media">
          <Image
            src="/images/hero/zelvomart-slider-02.webp"
            alt="Zelvomart curated everyday products"
            fill
            sizes="(max-width: 900px) 100vw, 52vw"
            className="professional-blog-image"
            priority
          />
          <div className="professional-blog-media-label">CURATED FOR EVERYDAY</div>
        </div>

        <div className="professional-blog-feature-card">
          <span className="premium-overline">{featured ? "FEATURED NOTE" : "THE JOURNAL"}</span>
          <h2>{featured?.title || livePageTitle || "Fresh stories are on the way."}</h2>
          {featured ? (
            <div className="professional-richtext professional-blog-feature-body" dangerouslySetInnerHTML={{ __html: featured.bodyHtml }} />
          ) : (
            <p className="professional-blog-empty-copy">Fresh journal stories are being prepared. In the meantime, explore the collection and discover practical everyday finds.</p>
          )}
          <Link href="/shop" className="professional-inline-link">Browse the collection <span>→</span></Link>
        </div>
      </section>

      <section className="professional-journal-section">
        <div className="site-shell">
          <div className="professional-section-head">
            <div>
              <span className="premium-overline">FROM THE JOURNAL</span>
              <h2>{remaining.length ? "More from Zelvomart." : "No filler. Only published content."}</h2>
            </div>
            <p>{remaining.length ? "Each card below is generated from the live Blog page content managed in Admin." : "New journal entries will appear here as they are published."}</p>
          </div>

          {remaining.length ? (
            <div className="professional-journal-grid professional-journal-grid-live">
              {remaining.map((section, index) => (
                <article className="professional-journal-card professional-journal-card-live" key={section.id}>
                  <div className="professional-journal-index">{String(index + 2).padStart(2, "0")}</div>
                  <span className="professional-journal-tag">Journal</span>
                  <h3>{section.title}</h3>
                  <div className="professional-richtext professional-journal-body" dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
                </article>
              ))}
            </div>
          ) : (
            <div className="professional-blog-empty-state">
              <div className="professional-blog-empty-mark">Z</div>
              <div>
                <span className="premium-overline">READY FOR REAL CONTENT</span>
                <h3>Fresh journal stories are coming soon.</h3>
                <p>Only published Zelvomart stories will appear in this space.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="site-shell professional-page-endcap">
        <div>
          <span className="premium-overline">READY TO BROWSE?</span>
          <h2>Turn useful ideas into useful finds.</h2>
        </div>
        <Link href="/shop" className="premium-button premium-button-dark">Shop the collection <span>→</span></Link>
      </section>
    </div>
  );
}
