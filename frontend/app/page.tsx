import type { Metadata } from "next";
import SafeImage from "@/components/SafeImage";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import Faq from "@/components/Faq";
import HomeBannerCarousel from "@/components/HomeBannerCarousel";
import HomeEditorialGrid from "@/components/HomeEditorialGrid";
import HomeFaqReveal from "@/components/HomeFaqReveal";
import HomeHowItWorks from "@/components/HomeHowItWorks";
import { getProductBySlug, getProducts, getStoreBootstrap } from "@/lib/store";
import { categoryImageFallback, categoryImageSrc, storeImages } from "@/lib/store-images";
import type { Category, Product } from "@/types/product";

export const revalidate = 120;

export const metadata: Metadata = {
  openGraph: {
    images: [
      {
        url: storeImages.dealsArtwork.href,
        alt: "Deals you'll actually want at Zelvomart",
      },
    ],
  },
};

const categoryFallbacks: Record<string, string> = categoryImageSrc;

const categoryCardBlurbs: Record<string, string> = {
  "home-living": "Smart tools for everyday",
  "beauty-personal-care": "Look good, feel confident",
  "tech-gadgets": "Everyday tech, made easy",
  "kids-toys": "Fun that keeps them busy",
  "home-decor": "Decorate your happy place",
  "fashion-accessories": "Bags, jewellery & more",
  "sports-fitness": "Gear up, stay active",
};

function uniqueProducts(groups: Product[][], limit = 12) {
  const seen = new Set<string>();
  const items: Product[] = [];
  for (const group of groups) {
    for (const product of group) {
      if (!product?.id || seen.has(product.id)) continue;
      seen.add(product.id);
      items.push(product);
      if (items.length >= limit) return items;
    }
  }
  return items;
}

function chooseEditorialCategories(categories: Category[]) {
  return ["fashion-accessories", "tech-gadgets", "home-living"]
    .map((slug) => categories.find((item) => item.slug === slug))
    .filter((item): item is Category => Boolean(item));
}

export default async function HomePage() {
  const [bootstrap, featured, latest] = await Promise.all([
    getStoreBootstrap(),
    getProducts({ featured: true, limit: 10 }),
    getProducts({ limit: 14, sort: "newest" }),
  ]);

  const categories = bootstrap.categories;
  const products = uniqueProducts([featured.items, latest.items], 12);
  const cards = categories.slice(0, 7);
  const editorialCategories = chooseEditorialCategories(categories);

  const storeInfo = (bootstrap.settings["store.info"] || {}) as { whatsapp?: string };
  const whatsapp = String(storeInfo.whatsapp || "923002026711").replace(/[^0-9]/g, "");

  const youtubeShorts = [
    "1Ucas-8A7Jc",
    "2GUG6Osv0Qg",
    "k5f9jnUUqRg",
    "nLqUowhaqdE",
    "DOw3BuB0wi0",
  ];

  const unboxingYoutubeId = "RkFifzRoieE";

  return (
    <div className="mock-home">
      <HomeBannerCarousel whatsapp={whatsapp} />

      <section className="site-shell mock-home-section zm-home-category-section">
        <div className="mock-section-head">
          <div>
            <span className="mock-eyebrow">SHOP BY CATEGORY</span>
            <h2>Find what you came for.</h2>
          </div>
          <Link href="/shop" className="zm-all-categories-link">All categories →</Link>
        </div>
        <div className="mock-category-responsive-grid zm-category-prominent" aria-label="Shop by category">
          {cards.map((category, index) => (
            <Link
              key={category.id}
              href={`/product-category/${category.slug}/`}
              className={[
                "mock-category-responsive-card",
                index === 0 ? "is-featured" : "",
                index === cards.length - 1 ? "is-last" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <SafeImage
                src={categoryFallbacks[category.slug] || category.image}
                fallbackSrc={categoryImageFallback}
                alt={category.name}
                fill
                className={`zm-category-image ${category.slug === "kids-toys" ? "is-kids" : ""}`}
                sizes={index === 0 ? "(max-width: 620px) 50vw, 32vw" : "(max-width: 620px) 50vw, 22vw"}
              />
              <span className="mock-category-responsive-overlay" aria-hidden="true" />
              <span className="mock-category-responsive-copy">
                <b>{category.name}</b>
                <span className="zm-category-card-description">
                  {categoryCardBlurbs[category.slug] || category.description || "Explore everyday favourites"}
                </span>
                <span className="zm-category-card-shop">Shop Now</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="site-shell mock-home-section mock-products-section zm-home-products-four">
        <div className="mock-section-head">
          <div>
            <span className="mock-eyebrow">BESTSELLERS</span>
            <h2>Our most-ordered right now.</h2>
          </div>
          <Link href="/shop" className="zm-all-products-link">All products →</Link>
        </div>

        <ProductGrid products={products.slice(0, 4)} variant="storefront" />

        <style>{`
          .zm-view-all-products {
            display: flex;
            justify-content: center;
            margin-top: 24px;
          }

          .zm-view-all-products a {
            min-width: 210px;
            min-height: 46px;
            padding: 0 22px;
            border-radius: 10px;
            background: #0aaae8;
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            font-size: 14px;
            font-weight: 900;
            transition: background .18s ease, transform .18s ease;
          }

          .zm-view-all-products a:hover {
            background: #088fc4;
            transform: translateY(-1px);
          }

          @media (max-width: 620px) {
            .zm-deals-actions {
              grid-template-columns: 1fr !important;
              max-width: 260px !important;
            }

            .zm-standard-offer-badge {
              min-height: 44px;
              padding: 0 17px;
              font-size: 12px;
            }

            .zm-view-all-products {
              margin-top: 18px;
            }

            .zm-view-all-products a {
              min-width: 190px;
              min-height: 42px;
              font-size: 13px;
            }
          }
        `}</style>
      </section>

      <section className="mock-standard-section zm-standard-section zm-deals-banner">
        <div className="zm-deals-banner-scrim" aria-hidden="true" />
        <div className="zm-deals-banner-glow" aria-hidden="true" />
        <div className="site-shell zm-standard-content-wrap">
          <div className="zm-standard-content zm-deals-panel">
            <span className="zm-deals-eyebrow mock-eyebrow">LIMITED-TIME DEALS</span>
            <h2>
              Deals You&apos;ll
              <span className="zm-deals-headline-accent">Actually Want</span>
            </h2>
            <p>Limited-time prices on selected Zelvomart favorites.</p>

            <div className="zm-standard-actions zm-deals-actions">
              <span className="zm-standard-offer-badge zm-deals-offer-badge">UP TO 30% OFF</span>
              <Link href="/shop" className="zm-standard-btn blue zm-deals-cta">View All Offers →</Link>
            </div>
          </div>
        </div>

        <style>{`
          .zm-deals-banner {
            position: relative;
            isolation: isolate;
          }

          .zm-standard-section.zm-deals-banner {
            width: 100% !important;
            max-width: none !important;
            margin: 52px 0 !important;
            padding: 0 !important;
            overflow: hidden;
            border-radius: 0;
            background-image: url("${storeImages.deal.href}") !important;
            background-position: center center !important;
            background-size: cover !important;
            background-repeat: no-repeat !important;
            background-color: #f3ebe3 !important;
          }

          .zm-deals-banner-scrim {
            position: absolute;
            inset: 0;
            z-index: 0;
            background:
              linear-gradient(
                102deg,
                rgba(255, 247, 238, 0.94) 0%,
                rgba(255, 250, 244, 0.82) 34%,
                rgba(255, 252, 248, 0.42) 52%,
                rgba(255, 255, 255, 0.08) 68%,
                transparent 82%
              ),
              linear-gradient(180deg, transparent 55%, rgba(16, 40, 51, 0.06) 100%);
            pointer-events: none;
          }

          .zm-deals-banner-glow {
            display: none;
          }

          .zm-standard-content-wrap {
            position: relative;
            z-index: 1;
            min-height: clamp(400px, 44vw, 540px);
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding-top: clamp(44px, 6vw, 80px);
            padding-bottom: clamp(44px, 6vw, 80px);
          }

          .zm-deals-panel {
            position: relative;
            width: min(100%, 560px);
            max-width: 560px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 0;
            padding: 0 0 0 clamp(8px, 1.2vw, 18px);
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
          }

          .zm-deals-panel::before {
            content: "";
            position: absolute;
            left: 0;
            top: 8%;
            bottom: 12%;
            width: 3px;
            border-radius: 99px;
            background: #123246;
          }

          .zm-deals-eyebrow {
            display: inline-flex !important;
            align-items: center;
            width: fit-content;
            padding: 6px 12px !important;
            margin-bottom: 4px;
            border-radius: 999px;
            color: #123246 !important;
            font-weight: 800 !important;
            letter-spacing: 0.14em !important;
            background: rgba(255, 255, 255, 0.72);
            border: 1px solid rgba(18, 50, 70, 0.16);
            box-shadow: none;
          }

          .zm-deals-panel h2 {
            margin: 14px 0 16px !important;
            color: #0f2835 !important;
            font-size: clamp(42px, 4.6vw, 68px) !important;
            line-height: 0.95 !important;
            letter-spacing: -2px !important;
            font-weight: 900 !important;
            text-shadow: 0 2px 18px rgba(255, 255, 255, 0.65);
          }

          .zm-deals-headline-accent {
            display: block;
            margin-top: 2px;
            color: #123246;
            -webkit-text-fill-color: #123246;
          }

          .zm-deals-panel > p {
            max-width: 480px;
            margin: 0 !important;
            color: #3d5563 !important;
            font-size: 17px !important;
            line-height: 1.6 !important;
            font-weight: 550;
            text-shadow: 0 1px 12px rgba(255, 255, 255, 0.75);
          }

          .zm-deals-offer-badge {
            min-height: 52px;
            border-radius: 12px;
            padding: 0 18px;
            background: #ffffff !important;
            color: #123246 !important;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.04em;
            white-space: nowrap;
            box-shadow: none;
            border: 1px solid rgba(18, 50, 70, 0.16);
          }

          .zm-deals-cta {
            border-radius: 12px !important;
            background: #123246 !important;
            box-shadow: none;
            border: 1px solid #123246;
            transition: background 0.2s ease, transform 0.2s ease;
          }

          .zm-deals-cta:hover {
            background: #0c2230 !important;
            transform: translateY(-1px);
          }

          .zm-deals-actions {
            grid-template-columns: auto minmax(190px, 1fr) !important;
            max-width: 490px !important;
          }

          .zm-standard-actions {
            margin-top: 30px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            max-width: 430px;
          }

          .zm-standard-btn {
            min-height: 52px;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 18px;
            font-size: 14px;
            font-weight: 900;
            text-decoration: none;
          }

          .zm-standard-btn.light {
            background: #fff;
            color: #0d202a;
            border: 1px solid rgba(13,32,42,.12);
          }

          .zm-standard-btn.blue {
            background: #0aaae8;
            color: #fff;
          }

          @media (max-width: 760px) {
            .zm-standard-section.zm-deals-banner {
              margin: 36px 0 !important;
              background-image: url("${storeImages.dealMobile.href}") !important;
            }

            .zm-deals-banner-scrim {
              background:
                linear-gradient(
                  180deg,
                  rgba(255, 250, 244, 0.15) 0%,
                  rgba(255, 248, 240, 0.88) 58%,
                  rgba(255, 246, 236, 0.96) 100%
                );
            }

            .zm-deals-banner-glow {
              display: none;
            }

            .zm-standard-content-wrap {
              min-height: 420px;
              padding: 28px 16px 32px;
              align-items: flex-end;
            }

            .zm-deals-panel {
              width: 100%;
              max-width: none;
              padding-left: 14px;
            }

            .zm-deals-panel h2 {
              font-size: 38px !important;
              letter-spacing: -1.2px !important;
            }

            .zm-deals-panel > p {
              font-size: 15px !important;
            }

            .zm-standard-actions {
              max-width: none;
              grid-template-columns: 1fr;
              gap: 10px;
            }

            .zm-deals-actions {
              max-width: none !important;
            }
          }
        `}</style>
      </section>

      {editorialCategories.length ? (
        <HomeEditorialGrid categories={editorialCategories} imageBySlug={categoryFallbacks} />
      ) : null}

      <section className="site-shell zm-youtube-shorts">
        <div className="mock-section-head zm-youtube-shorts-head">
          <div>
            <span className="mock-eyebrow">WATCH &amp; DISCOVER</span>
            <h2>See Zelvomart products in action</h2>
          </div>
        </div>

        <div className="zm-youtube-shorts-grid">
          {youtubeShorts.map((videoId, index) => (
            <article className="zm-youtube-short-card" key={videoId}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0&modestbranding=1&playsinline=1`}
                title={`Zelvomart YouTube Short ${index + 1}`}
                loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </article>
          ))}
        </div>

        <style>{`
          .zm-youtube-shorts {
            width: 100%;
            max-width: 100%;
            padding-top: 56px;
            padding-bottom: 56px;
            overflow: hidden !important;
            box-sizing: border-box;
          }

          .zm-youtube-shorts-head {
            margin-bottom: 22px;
          }

          .zm-youtube-shorts-grid {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px;
            align-items: stretch;
            overflow: hidden !important;
          }

          .zm-youtube-short-card {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            aspect-ratio: 9 / 16;
            overflow: hidden !important;
            border-radius: 14px;
            background: #0b1115;
            border: 1px solid #dce5ea;
            box-sizing: border-box;
          }

          .zm-youtube-short-card iframe {
            display: block;
            width: 100%;
            max-width: 100%;
            height: 100%;
            border: 0;
            overflow: hidden !important;
          }

          @media (max-width: 1000px) {
            .zm-youtube-shorts-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }

          @media (max-width: 620px) {
            .zm-youtube-shorts {
              padding-top: 38px;
              padding-bottom: 38px;
            }

            .zm-youtube-shorts-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 9px;
            }

            .zm-youtube-short-card {
              border-radius: 10px;
            }

            .zm-youtube-short-card:nth-child(5) {
              display: none;
            }
          }
        `}</style>
      </section>

      <HomeHowItWorks />

      <section className="site-shell zm-unboxing-section">
        <div className="zm-unboxing-video-wrap">
          <iframe
            className="zm-unboxing-video"
            src={`https://www.youtube.com/embed/${unboxingYoutubeId}?autoplay=1&mute=1&loop=1&playlist=${unboxingYoutubeId}&controls=0&rel=0&modestbranding=1&playsinline=1`}
            title="Zelvomart unboxing video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="zm-unboxing-copy">
          <span className="mock-eyebrow">THE UNBOXING</span>
          <h2>Arrives like a gift.<br />Every single time.</h2>
          <p>
            Each order is checked, sealed in Zelvomart packaging and sent with care
            so it feels as good to open as it does to use.
          </p>
          <ul>
            <li>Checked by hand before it&apos;s sealed</li>
            <li>Zelvomart seal on every parcel</li>
            <li>A thank-you card in every order</li>
          </ul>
        </div>

        <style>{`
          .zm-unboxing-section {
            display: grid;
            grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
            gap: clamp(28px, 5vw, 72px);
            align-items: center;
            padding-top: 56px;
            padding-bottom: 56px;
          }

          .zm-unboxing-video-wrap {
            border-radius: 20px;
            overflow: hidden;
            background: #eaf7fd;
            min-height: 340px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .zm-unboxing-video {
            display: block;
            width: 100%;
            height: 100%;
            min-height: 340px;
            border: 0;
            background: #0b1115;
          }

          .zm-unboxing-copy h2 {
            margin: 8px 0 14px;
            font-size: clamp(32px, 3.3vw, 50px);
            line-height: 1.02;
            color: #102733;
          }

          .zm-unboxing-copy > p {
            color: #5f707b;
            font-size: 15px;
            line-height: 1.65;
            max-width: 560px;
          }

          .zm-unboxing-copy ul {
            list-style: none;
            padding: 0;
            margin: 22px 0 0;
            display: grid;
            gap: 10px;
          }

          .zm-unboxing-copy li {
            position: relative;
            padding-left: 22px;
            color: #102733;
            font-size: 14px;
            font-weight: 750;
          }

          .zm-unboxing-copy li::before {
            content: "●";
            position: absolute;
            left: 0;
            top: 0;
            color: #0aaae8;
          }

          @media (max-width: 760px) {
            .zm-unboxing-section {
              grid-template-columns: 1fr;
              gap: 22px;
              padding: 34px 12px;
            }

            .zm-unboxing-video-wrap,
            .zm-unboxing-video {
              min-height: 230px;
            }

            .zm-unboxing-copy h2 {
              font-size: 32px;
            }

            .zm-unboxing-copy > p {
              font-size: 14px;
            }
          }
        `}</style>
      </section>

      <section className="zm-whatsapp-banner">
        <div className="zm-whatsapp-banner-inner">
          <div className="zm-wa-icon" aria-hidden="true">☎</div>

          <div className="zm-wa-copy">
            <span>HAVE A QUESTION?</span>
            <h2>Chat with us on WhatsApp</h2>
            <p>Get product help, order updates or recommendations — we&apos;re here to help!</p>
          </div>

          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
            Chat on WhatsApp <b>→</b>
          </a>

          <div className="zm-wa-phone" aria-hidden="true">
            <div className="zm-wa-phone-screen">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>

        <style>{`
          .zm-whatsapp-banner {
            width: calc(100% - 48px) !important;
            max-width: 1180px !important;
            margin: 48px auto !important;
            padding: 0 !important;
            background: linear-gradient(90deg, #f5fbff 0%, #eaf7ff 58%, #f6fbff 100%);
            border: 1px solid #d8ebf5;
            border-radius: 16px;
            overflow: hidden;
            box-sizing: border-box;
          }

          .zm-whatsapp-banner-inner {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 118px;
            padding: 14px 24px;
            display: grid;
            grid-template-columns: auto minmax(0,1fr) auto 130px;
            align-items: center;
            gap: 24px;
            box-sizing: border-box;
          }

          .zm-wa-icon {
            width: 76px;
            height: 76px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            background: #25d366;
            color: #fff;
            font-size: 32px;
            font-weight: 900;
            box-shadow: 0 8px 24px rgba(37,211,102,.22);
          }

          .zm-wa-copy span {
            color: #159ad1;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .11em;
          }

          .zm-wa-copy h2 {
            margin: 4px 0 4px;
            color: #102d3e;
            font-size: 28px !important;
            line-height: 1.08 !important;
          }

          .zm-wa-copy p {
            margin: 0;
            color: #657985;
            font-size: 13px !important;
            line-height: 1.45 !important;
          }

          .zm-whatsapp-banner-inner > a {
            min-height: 48px;
            padding: 0 22px;
            border: 2px solid #80c8ef;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            justify-content: center;
            background: #fff;
            color: #168bc0;
            text-decoration: none;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
          }

          .zm-wa-phone {
            position: relative;
            align-self: end;
            width: 110px;
            height: 108px;
            margin-left: auto;
            transform: rotate(-7deg) translateY(18px);
            border: 7px solid #162d3b;
            border-bottom: 0;
            border-radius: 20px 20px 0 0;
            background: #fff;
            overflow: hidden;
          }

          .zm-wa-phone-screen {
            display: grid;
            gap: 8px;
            padding: 25px 10px;
          }

          .zm-wa-phone-screen i {
            height: 12px;
            border-radius: 999px;
            background: #dff7e7;
          }

          .zm-wa-phone-screen i:nth-child(2) {
            width: 78%;
            margin-left: auto;
            background: #bff0cd;
          }

          @media (max-width: 760px) {
            .zm-whatsapp-banner {
              width: calc(100% - 24px) !important;
              max-width: none !important;
              margin: 32px auto !important;
              padding: 0 !important;
              border-radius: 13px;
            }

            .zm-whatsapp-banner-inner {
              min-height: 0;
              padding: 18px 14px;
              grid-template-columns: 54px minmax(0,1fr);
              gap: 12px;
            }

            .zm-wa-icon {
              width: 54px;
              height: 54px;
              font-size: 22px;
            }

            .zm-wa-copy h2 {
              font-size: 21px !important;
            }

            .zm-wa-copy p {
              font-size: 11px !important;
            }

            .zm-whatsapp-banner-inner > a {
              grid-column: 1 / -1;
              width: 100%;
            }

            .zm-wa-phone {
              display: none;
            }
          }
        `}</style>
      </section>

      <HomeFaqReveal
        intro={
          <div className="mock-faq-intro">
            <span className="mock-eyebrow">FAQ</span>
            <h2>Questions,<br />answered.</h2>
            <p>Everything people ask before they place an order.</p>
            <div className="mock-faq-contact-card">
              <a className="mock-faq-contact-item" href="tel:+923002026711"><i>☎</i><b>0300-2026711</b></a>
              <a className="mock-faq-contact-item whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><i>◉</i><b>Chat on WhatsApp</b></a>
              <a className="mock-faq-contact-item" href="mailto:zelvomart@gmail.com"><i>✉</i><b>zelvomart@gmail.com</b></a>
            </div>
          </div>
        }
      >
        <Faq />
      </HomeFaqReveal>

      <style>{`
        .mock-home {
          width: 100%;
          max-width: 100%;
          overflow-x: clip !important;
        }

        .mock-home *,
        .mock-home *::before,
        .mock-home *::after {
          box-sizing: border-box;
        }

        .mock-home .site-shell {
          max-width: 100%;
        }

        html,
        body {
          max-width: 100vw !important;
          overflow-x: hidden !important;
        }

        .zm-home-category-section {
          padding-top: 58px !important;
          padding-bottom: 48px !important;
        }

        .zm-home-category-section .zm-all-categories-link {
          color: #123246;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.01em;
          text-decoration: none !important;
          text-underline-offset: 0;
          border-bottom: 0 !important;
          background-image: none !important;
          box-shadow: none !important;
        }

        .zm-home-category-section .zm-all-categories-link:hover {
          color: #0798d0;
        }

        .zm-home-products-four .zm-all-products-link {
          color: #123246;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.01em;
          text-decoration: none !important;
          border-bottom: 0 !important;
          background-image: none !important;
          box-shadow: none !important;
          transition: color 0.18s ease;
        }

        .zm-home-products-four .zm-all-products-link:hover {
          color: #0798d0;
        }

        .zm-home-products-four .mock-section-head {
          margin-bottom: 16px !important;
        }

        .zm-home-products-four .grid {
          gap: 14px !important;
        }

        .zm-home-category-section .mock-category-responsive-card {
          border: 1px solid rgba(255, 255, 255, 0.55);
          box-shadow: 0 10px 28px rgba(12, 36, 52, 0.1);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }

        .zm-home-category-section .mock-category-responsive-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 36px rgba(12, 36, 52, 0.16);
        }

        .zm-home-category-section .mock-category-responsive-card img {
          transition: transform 0.45s ease;
        }

        .zm-home-category-section .mock-category-responsive-card:hover img {
          transform: scale(1.045);
        }

        .zm-home-category-section .mock-category-responsive-card {
          --zm-wash-soft: rgba(255, 214, 196, 0.16);
          --zm-wash-mid: rgba(255, 228, 214, 0.38);
          --zm-wash-deep: rgba(255, 244, 236, 0.58);
        }

        .zm-home-category-section .mock-category-responsive-card:nth-child(1) {
          --zm-wash-soft: rgba(255, 146, 168, 0.18);
          --zm-wash-mid: rgba(255, 186, 146, 0.4);
          --zm-wash-deep: rgba(255, 242, 230, 0.58);
        }

        .zm-home-category-section .mock-category-responsive-card:nth-child(2) {
          --zm-wash-soft: rgba(126, 196, 132, 0.18);
          --zm-wash-mid: rgba(214, 196, 120, 0.4);
          --zm-wash-deep: rgba(244, 248, 232, 0.58);
        }

        .zm-home-category-section .mock-category-responsive-card:nth-child(3) {
          --zm-wash-soft: rgba(255, 146, 186, 0.18);
          --zm-wash-mid: rgba(214, 168, 236, 0.4);
          --zm-wash-deep: rgba(255, 236, 244, 0.58);
        }

        .zm-home-category-section .mock-category-responsive-card:nth-child(4) {
          --zm-wash-soft: rgba(110, 186, 255, 0.2);
          --zm-wash-mid: rgba(168, 176, 255, 0.4);
          --zm-wash-deep: rgba(232, 244, 255, 0.58);
        }

        .zm-home-category-section .mock-category-responsive-card:nth-child(5) {
          --zm-wash-soft: rgba(255, 186, 72, 0.2);
          --zm-wash-mid: rgba(255, 150, 122, 0.42);
          --zm-wash-deep: rgba(255, 244, 220, 0.58);
        }

        .zm-home-category-section .mock-category-responsive-card:nth-child(6) {
          --zm-wash-soft: rgba(214, 140, 196, 0.2);
          --zm-wash-mid: rgba(236, 176, 150, 0.4);
          --zm-wash-deep: rgba(255, 236, 240, 0.58);
        }

        .zm-home-category-section .mock-category-responsive-card:nth-child(7) {
          --zm-wash-soft: rgba(72, 196, 188, 0.2);
          --zm-wash-mid: rgba(126, 186, 236, 0.4);
          --zm-wash-deep: rgba(228, 248, 244, 0.58);
        }

        .zm-home-category-section .mock-category-responsive-overlay,
        .zm-home-category-section .mock-category-responsive-card.is-featured .mock-category-responsive-overlay {
          inset: 0 !important;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0) 52%,
            var(--zm-wash-soft) 68%,
            var(--zm-wash-mid) 84%,
            var(--zm-wash-deep) 100%
          ) !important;
        }

        .zm-home-category-section .mock-category-responsive-copy b {
          background: #ffffff !important;
          color: #102433 !important;
          border-radius: 10px !important;
          padding: 8px 12px !important;
          font-size: 13px !important;
          line-height: 1.15 !important;
          font-weight: 800 !important;
          letter-spacing: -0.02em;
          box-shadow: 0 8px 18px rgba(8, 24, 36, 0.18);
        }

        .zm-home-category-section .mock-category-responsive-card.is-featured .mock-category-responsive-copy b {
          max-width: 200px;
          padding: 10px 14px !important;
          border-radius: 12px !important;
          font-size: 26px !important;
          line-height: 1.02 !important;
          letter-spacing: -0.04em;
        }

        .zm-home-category-section .zm-category-card-description,
        .zm-home-category-section .zm-category-card-shop {
          color: #102433 !important;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 12px rgba(255, 255, 255, 0.75) !important;
        }

        .zm-home-category-section .zm-category-card-description {
          font-size: 13px;
          line-height: 1.25;
          font-weight: 750;
        }

        .zm-home-category-section .mock-category-responsive-card:not(.is-featured) .zm-category-card-description {
          max-width: 158px;
        }

        .zm-home-category-section .zm-category-card-shop {
          font-size: 15px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .zm-home-category-section .mock-category-responsive-card.is-featured .zm-category-card-description {
          max-width: 240px;
          font-size: 16px;
          line-height: 1.3;
          font-weight: 750;
        }

        .zm-home-category-section .mock-category-responsive-card.is-featured .zm-category-card-shop {
          font-size: 18px;
          font-weight: 800;
        }

        .mock-products-section {
          padding-top: 48px !important;
          padding-bottom: 48px !important;
        }

        .mock-editorial-grid {
          margin-top: 0 !important;
          padding-top: 56px !important;
          padding-bottom: 56px !important;
          column-gap: 8px !important;
        }

        .zm-how-it-works {
          margin-top: 38px !important;
          margin-bottom: 38px !important;
        }

        .zm-unboxing-section {
          margin-top: 40px !important;
          margin-bottom: 40px !important;
        }

        .zm-whatsapp-banner {
          margin-top: 48px !important;
          margin-bottom: 48px !important;
          width: calc(100% - 48px) !important;
          max-width: 1180px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        @media (max-width: 760px) {
          .zm-whatsapp-banner {
            width: calc(100% - 24px) !important;
            max-width: none !important;
          }
        }

        .mock-faq-section {
          padding-top: 72px !important;
          padding-bottom: 110px !important;
          margin-top: 0 !important;
          align-items: start !important;
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
        }

        .mock-faq-section > *,
        .mock-faq-section details,
        .mock-faq-section [class*="faq"] {
          max-height: none !important;
          overflow: visible !important;
        }

        .mock-faq-intro {
          padding-top: 4px;
        }

        .zm-home-products-four .product-grid {
          align-items: stretch;
        }

        .zm-home-products-four .mock-product-card {
          height: 100%;
        }

        .zm-home-products-four .mock-product-media {
          aspect-ratio: 1 / 1 !important;
          min-height: 0 !important;
          overflow: hidden;
          background: #f5f7f8;
        }

        .zm-home-products-four .mock-product-media img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          object-position: center !important;
        }

        .mock-editorial-grid {
          margin-top: 42px !important;
          gap: 14px !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .mock-editorial-grid .mock-editorial {
          min-width: 0;
          width: 100%;
          min-height: 260px !important;
          overflow: hidden;
          border-radius: 14px !important;
          background: #ffffff !important;
        }

        .mock-editorial-grid .mock-editorial-img {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }

        .mock-editorial-grid .mock-editorial-img img {
          width: 100% !important;
          height: 100% !important;
          object-fit: fill !important;
          object-position: center center !important;
          transform: none !important;
          background: transparent !important;
        }

        .mock-editorial-grid .mock-editorial::before,
        .mock-editorial-grid .mock-editorial::after,
        .mock-editorial-grid .mock-editorial-img::before,
        .mock-editorial-grid .mock-editorial-img::after {
          display: none !important;
          content: none !important;
          background: none !important;
          opacity: 0 !important;
        }

        .mock-editorial-grid .mock-editorial > span,
        .mock-editorial-grid .mock-editorial > h3,
        .mock-editorial-grid .mock-editorial > b {
          position: relative;
          z-index: 2;
          color: #0f2633 !important;
          text-shadow: none !important;
        }

        .mock-editorial-grid .mock-editorial > span {
          font-weight: 800 !important;
        }

        .mock-editorial-grid .mock-editorial > h3 {
          color: #0f2633 !important;
          font-size: 22px !important;
          line-height: 1.05 !important;
          text-shadow: none !important;
        }

        .mock-editorial-grid .mock-editorial > b {
          display: inline-flex !important;
          width: fit-content;
          min-height: 34px;
          align-items: center;
          padding: 0 13px;
          border-radius: 9px;
          background: #fff !important;
          color: #102d3e !important;
          font-size: 11px !important;
          font-weight: 700 !important;
        }

        .zm-standard-section {
          width: 100% !important;
          max-width: none !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        @media (max-width: 900px) {
          .zm-home-category-section {
            padding-top: 38px !important;
            padding-bottom: 28px !important;
          }

          .mock-products-section,
          .mock-editorial-grid {
            padding-top: 38px !important;
            padding-bottom: 38px !important;
          }

          .mock-faq-section {
            padding-top: 48px !important;
            padding-bottom: 64px !important;
          }
        }

        @media (max-width: 620px) {
          .zm-home-category-section {
            padding-top: 30px !important;
            padding-bottom: 24px !important;
          }

          .zm-home-category-section .mock-category-responsive-copy b,
          .zm-home-category-section .mock-category-responsive-card.is-featured .mock-category-responsive-copy b {
            max-width: none;
            padding: 6px 8px !important;
            border-radius: 8px !important;
            font-size: 12px !important;
            line-height: 1.1 !important;
            letter-spacing: 0 !important;
          }

          .zm-home-category-section .zm-category-card-description,
          .zm-home-category-section .mock-category-responsive-card.is-featured .zm-category-card-description {
            max-width: none;
            font-size: 11px;
            line-height: 1.2;
          }

          .zm-home-category-section .zm-category-card-shop,
          .zm-home-category-section .mock-category-responsive-card.is-featured .zm-category-card-shop {
            font-size: 12px;
          }

          .zm-home-category-section .mock-category-responsive-overlay,
          .zm-home-category-section .mock-category-responsive-card.is-featured .mock-category-responsive-overlay {
            background:
              linear-gradient(
                180deg,
                rgba(255, 255, 255, 0) 0%,
                rgba(255, 255, 255, 0) 48%,
                var(--zm-wash-soft) 66%,
                var(--zm-wash-mid) 84%,
                var(--zm-wash-deep) 100%
              ) !important;
          }

          .mock-faq-section {
            margin-top: 28px !important;
            padding-top: 48px !important;
            padding-bottom: 96px !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .mock-editorial-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .mock-editorial-grid .mock-editorial {
            min-height: 190px !important;
          }
        }

        /* Middle sections alignment */
        .zm-home-category-section,
        .mock-products-section,
        .mock-editorial-grid {
          width: calc(100% - 48px) !important;
          max-width: 1180px !important;
          margin-left: auto !important;
          margin-right: auto !important;
          box-sizing: border-box;
        }

        @media (max-width: 620px) {
          .zm-home-category-section,
          .mock-products-section,
          .mock-editorial-grid {
            width: calc(100% - 24px) !important;
            max-width: none !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }
      `}</style>
    </div>
  );
}