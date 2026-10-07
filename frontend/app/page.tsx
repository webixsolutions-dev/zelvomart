import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import Faq from "@/components/Faq";
import HomeBannerCarousel from "@/components/HomeBannerCarousel";
import { getProductBySlug, getProducts, getStoreBootstrap } from "@/lib/store";
import { getProductFallbackImage } from "@/lib/product-media";
import type { Category, Product } from "@/types/product";

export const revalidate = 120;

const categoryFallbacks: Record<string, string> = {
  "fashion-accessories": "/images/home/Fashion Accessories Zelvomart.png",
  "home-living": "/images/home/home and living zelvomart.png",
  "home-decor": "/images/home/Home Decor Zelvomart.png",
  "beauty-personal-care": "/images/home/Beauty & Personal Care Zelvomart.png",
  "tech-gadgets": "/images/home/Tech & Gadgets Zelvomart.png",
  "sports-fitness": "/images/home/Sports & Fitness Zelvomart.png",
  "kids-toys": "/images/home/Kids & Toys Zelvomart.png",
};

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
  const reviewCandidates = products.slice(0, 5);
  const detailedReviewProducts = await Promise.all(
    reviewCandidates.map(async (product) => (await getProductBySlug(product.slug)) || product),
  );

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
          <div><span className="mock-eyebrow">SHOP BY CATEGORY</span><h2>Find what you came for.</h2></div>
          <Link href="/shop">All categories →</Link>
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
              ].filter(Boolean).join(" ")}
            >
              <Image
                src={categoryFallbacks[category.slug] || category.image || "/images/hero/zelvomart-hero.webp"}
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


      <style>{`
        .zm-category-prominent {
          grid-auto-rows: 220px !important;
          gap: 14px !important;
        }
        .zm-category-prominent .mock-category-responsive-card {
          border-radius: 16px !important;
        }
        .zm-category-prominent .mock-category-responsive-card img.zm-category-image {
          object-fit: fill !important;
          object-position: center center !important;
        }
        .zm-category-prominent .mock-category-responsive-card img.zm-category-image.is-kids {
          object-fit: fill !important;
          object-position: center center !important;
          background: transparent !important;
        }
        .zm-category-prominent .mock-category-responsive-overlay {
          inset: 30% 0 0 !important;
          background: linear-gradient(transparent, rgba(4, 19, 28, .76)) !important;
        }
        .zm-category-prominent .mock-category-responsive-copy,
        .zm-category-prominent .mock-category-responsive-card.is-featured .mock-category-responsive-copy {
          left: 16px !important;
          right: 16px !important;
          bottom: 16px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 5px !important;
          color: #fff !important;
        }
        .zm-category-prominent .mock-category-responsive-copy small {
          padding: 0 !important;
          background: transparent !important;
          color: #ff6e8b !important;
          font-size: 10px !important;
          font-weight: 900 !important;
          letter-spacing: .12em !important;
        }
        .zm-category-prominent .mock-category-responsive-copy b,
        .zm-category-prominent .mock-category-responsive-card.is-featured .mock-category-responsive-copy b {
          width: auto !important;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
          color: #fff !important;
          font-size: 20px !important;
          line-height: 1.05 !important;
          font-weight: 900 !important;
          letter-spacing: -.45px !important;
          text-shadow: 0 2px 8px rgba(0,0,0,.45) !important;
        }
        .zm-category-prominent .mock-category-responsive-card.is-featured .mock-category-responsive-copy b {
          font-size: 25px !important;
        }
        .zm-category-card-description {
          display: block;
          color: rgba(255,255,255,.9);
          font-size: 12px;
          line-height: 1.3;
          font-weight: 650;
          text-shadow: 0 2px 6px rgba(0,0,0,.42);
        }
        .zm-category-card-shop {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          margin-top: 9px;
          padding: 0 18px;
          border-radius: 999px;
          background: #08a8e8;
          color: #fff;
          font-size: 12px;
          line-height: 1;
          font-weight: 900;
          box-shadow: 0 6px 16px rgba(0,141,202,.2);
        }
        @media (max-width: 620px) {
          .zm-category-prominent {
            grid-auto-rows: auto !important;
            gap: 10px !important;
          }
          .zm-category-prominent .mock-category-responsive-card,
          .zm-category-prominent .mock-category-responsive-card.is-featured {
            min-height: 175px !important;
          }
          .zm-category-prominent .mock-category-responsive-card.is-last {
            min-height: 205px !important;
          }
          .zm-category-prominent .mock-category-responsive-card img.zm-category-image {
            object-position: center center !important;
          }
          .zm-category-prominent .mock-category-responsive-card img.zm-category-image.is-kids {
            object-fit: fill !important;
          }
          .zm-category-prominent .mock-category-responsive-copy,
          .zm-category-prominent .mock-category-responsive-card.is-featured .mock-category-responsive-copy {
            left: 9px !important;
            right: 9px !important;
            bottom: 9px !important;
            gap: 3px !important;
          }
          .zm-category-prominent .mock-category-responsive-copy small { display: none !important; }
          .zm-category-prominent .mock-category-responsive-copy b,
          .zm-category-prominent .mock-category-responsive-card.is-featured .mock-category-responsive-copy b {
            font-size: 14px !important;
            line-height: 1.08 !important;
          }
          .zm-category-card-description {
            font-size: 9px;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .zm-category-card-shop {
            min-height: 29px;
            margin-top: 5px;
            padding: 0 12px;
            font-size: 10px;
          }
        }
      `}</style>

      <section className="site-shell mock-home-section mock-products-section zm-home-products-four">
        <div className="mock-section-head">
          <div><span className="mock-eyebrow">BESTSELLERS</span><h2>Our most-ordered right now.</h2></div>
          <Link href="/shop">All products →</Link>
        </div>

        <ProductGrid products={products.slice(0, 4)} />

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

      <section className="mock-standard-section zm-standard-section">
        <div className="site-shell zm-standard-content-wrap">
          <div className="zm-standard-content">
            <span className="mock-eyebrow">LIMITED-TIME DEALS</span>
            <h2>Deals You&apos;ll<br /><em>Actually Want</em></h2>
            <p>Limited-time prices on selected Zelvomart favorites.</p>

            <div className="zm-standard-actions zm-deals-actions">
              <span className="zm-standard-offer-badge">🏷 UP TO 30% OFF</span>
              <Link href="/shop" className="zm-standard-btn blue">View All Offers →</Link>
            </div>
          </div>
        </div>

        <style>{`
          .zm-standard-section {
            width: 100vw !important;
            max-width: 100vw !important;
            margin-left: calc(50% - 50vw) !important;
            margin-right: calc(50% - 50vw) !important;
            padding: 0 !important;
            overflow: hidden;
            background-image: url("/images/home/best-selling-zelvomart.png") !important;
            background-position: center center !important;
            background-size: cover !important;
            background-repeat: no-repeat !important;
            background-color: transparent !important;
          }

          .zm-standard-content-wrap {
            min-height: 430px;
            display: flex;
            align-items: center;
            padding-top: 48px;
            padding-bottom: 48px;
          }

          .zm-standard-content {
            width: 100%;
            max-width: 760px;
          }

          .zm-standard-content .mock-eyebrow {
            color: #008fc7 !important;
          }

          .zm-standard-content h2 {
            color: #102833 !important;
            text-shadow: 0 1px 2px rgba(255,255,255,.75);
            font-size: clamp(40px, 4.3vw, 62px) !important;
            line-height: .98 !important;
            margin: 12px 0 18px !important;
            letter-spacing: -1.5px;
          }

          .zm-standard-content h2 em {
            color: #102833 !important;
            font-style: normal;
          }

          .zm-standard-offer-badge {
            min-height: 50px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 22px;
            background: #ff6840;
            color: #fff;
            font-size: 14px;
            font-weight: 800;
            letter-spacing: .02em;
            white-space: nowrap;
          }

          .zm-deals-actions {
            grid-template-columns: auto minmax(190px, 1fr) !important;
            max-width: 470px !important;
          }

          .zm-standard-content > p {
            max-width: 620px;
            color: #253d47 !important;
            text-shadow: 0 1px 2px rgba(255,255,255,.75);
            font-size: 16px !important;
            line-height: 1.65 !important;
          }

          .zm-standard-actions {
            margin-top: 28px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            max-width: 430px;
          }

          .zm-standard-btn {
            min-height: 50px;
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
            .zm-standard-section {
              background-image: url("/images/home/best-selling-zelvomart.png") !important;
              background-position: center center !important;
              background-size: cover !important;
              background-repeat: no-repeat !important;
              background-color: transparent !important;
            }
            .zm-standard-content-wrap {
              min-height: 360px;
              padding: 34px 16px;
            }

            .zm-standard-content h2 {
              font-size: 36px !important;
            }

            .zm-standard-content > p {
              font-size: 14px !important;
            }

            .zm-standard-actions {
              max-width: none;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
          }
        `}</style>
      </section>

      {editorialCategories.length ? (
        <section className="site-shell mock-editorial-grid">
          {editorialCategories.map((category, index) => (
            <Link
              key={category.id}
              href={`/product-category/${category.slug}/`}
              className={`mock-editorial ${index === 0 ? "pink" : index === 1 ? "blue" : "cream"}`}
            >
              <div className="mock-editorial-img">
                <Image src={categoryFallbacks[category.slug] || category.image || "/images/hero/zelvomart-hero.webp"} alt={category.name} fill sizes="(max-width:900px) 100vw, 33vw" />
              </div>
              <span>{index === 0 ? "THE STYLE EDIT" : index === 1 ? "THE TECH EDIT" : "EVERYDAY PICKS"}</span>
              <h3>{category.name}</h3>
              <b>Shop {category.name} →</b>
            </Link>
          ))}
        </section>
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
                loading="eager"
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


      <section className="zm-how-it-works">
        <div className="site-shell">
          <div className="zm-how-heading">
            <h2>How It Works</h2>
            <p>Shopping on Zelvomart is simple and secure.</p>
          </div>

          <div className="zm-how-grid">
            <article>
              <span className="zm-how-icon">
                <Image src="/images/order-steps/01-choose.svg" alt="" width={54} height={54} />
              </span>
              <div><b>1. Choose</b><p>Browse and add your favourite products</p></div>
            </article>

            <i aria-hidden="true">→</i>

            <article>
              <span className="zm-how-icon">
                <Image src="/images/order-steps/02-confirm.svg" alt="" width={54} height={54} />
              </span>
              <div><b>2. Confirm</b><p>Share your details and confirm order</p></div>
            </article>

            <i aria-hidden="true">→</i>

            <article>
              <span className="zm-how-icon">
                <Image src="/images/order-steps/03-checked-packed.svg" alt="" width={54} height={54} />
              </span>
              <div><b>3. Delivered</b><p>We pack and ship to your doorstep</p></div>
            </article>

            <i aria-hidden="true">→</i>

            <article>
              <span className="zm-how-icon">
                <Image src="/images/order-steps/04-delivered-pay-cash.svg" alt="" width={54} height={54} />
              </span>
              <div><b>4. Pay Cash</b><p>Pay when you receive your order</p></div>
            </article>
          </div>
        </div>

        <style>{`
          .zm-how-it-works {
            width: 100%;
            padding: 34px 0 38px;
            background: #fff;
            border-top: 1px solid #edf1f3;
            border-bottom: 1px solid #edf1f3;
          }

          .zm-how-heading h2 {
            margin: 0;
            color: #102d3e;
            font-size: 28px !important;
            line-height: 1.08;
          }

          .zm-how-heading p {
            margin: 5px 0 0;
            color: #667b87;
            font-size: 14px !important;
          }

          .zm-how-grid {
            margin-top: 24px;
            display: grid;
            grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr);
            align-items: center;
            gap: 18px;
          }

          .zm-how-grid article {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .zm-how-grid > i {
            color: #bcc9cf;
            font-size: 25px;
            font-style: normal;
          }

          .zm-how-icon {
            width: 62px;
            height: 62px;
            flex: 0 0 62px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            background: #eaf7fd;
          }

          .zm-how-icon img {
            width: 48px !important;
            height: 48px !important;
            object-fit: contain !important;
          }

          .zm-how-grid b {
            display: block;
            color: #102d3e;
            font-size: 16px;
            line-height: 1.2;
            font-weight: 800;
          }

          .zm-how-grid p {
            margin: 5px 0 0;
            color: #657984;
            font-size: 12px !important;
            line-height: 1.4 !important;
          }

          @media (max-width: 760px) {
            .zm-how-it-works {
              padding: 28px 0;
            }

            .zm-how-heading h2 {
              font-size: 24px !important;
            }

            .zm-how-grid {
              grid-template-columns: repeat(2, minmax(0,1fr));
              gap: 12px;
            }

            .zm-how-grid > i {
              display: none;
            }

            .zm-how-grid article {
              align-items: flex-start;
              padding: 12px;
              border: 1px solid #e0e8ec;
              border-radius: 12px;
              background: #fff;
            }

            .zm-how-icon {
              width: 42px;
              height: 42px;
              flex-basis: 42px;
            }

            .zm-how-icon img {
              width: 34px !important;
              height: 34px !important;
            }

            .zm-how-grid b {
              font-size: 12px;
            }

            .zm-how-grid p {
              font-size: 9.5px !important;
            }
          }
        `}</style>
      </section>

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
        <div className="site-shell zm-whatsapp-banner-inner">
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
            width: 100%;
            margin: 44px 0 0;
            padding: 14px 0;
            background: linear-gradient(90deg, #f5fbff 0%, #eaf7ff 58%, #f6fbff 100%);
            border-top: 1px solid #d8ebf5;
            border-bottom: 1px solid #d8ebf5;
          }

          .zm-whatsapp-banner-inner {
            min-height: 118px;
            display: grid;
            grid-template-columns: auto minmax(0,1fr) auto 150px;
            align-items: center;
            gap: 24px;
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
              margin-top: 30px;
              padding: 18px 0;
            }

            .zm-whatsapp-banner-inner {
              min-height: 0;
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

      <section className="site-shell mock-faq-section">
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
        <Faq />
      </section>

      <style>{`
        .mock-home {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden !important;
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

        html,
        body {
          max-width: 100%;
          overflow-x: hidden !important;
        }

        .zm-home-category-section {
          padding-top: 58px !important;
          padding-bottom: 48px !important;
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
        }


        .mock-editorial-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }

        .mock-editorial-grid .mock-editorial {
          min-width: 0;
          width: 100%;
        }

        .mock-editorial-grid .mock-editorial {
          min-height: 260px !important;
          overflow: hidden;
          border-radius: 14px !important;
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

        .mock-editorial-grid .mock-editorial {
          background: #ffffff !important;
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
          max-width: 100% !important;
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
      `}</style>


      <style>{`
        html,
        body {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden !important;
        }

        body {
          position: relative;
        }

        .mock-home {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
          position: relative;
        }

        .mock-home > * {
          max-width: 100%;
        }

        .mock-home .site-shell {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .mock-home iframe,
        .mock-home video,
        .mock-home img {
          max-width: 100%;
        }

        .zm-youtube-shorts,
        .zm-youtube-shorts-grid,
        .zm-unboxing-section,
        .zm-whatsapp-banner,
        .mock-faq-section,
        .mock-editorial-grid,
        .zm-how-it-works,
        .mock-products-section,
        .zm-home-category-section {
          max-width: 100% !important;
          overflow-x: hidden !important;
        }

        .zm-standard-section {
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          overflow-x: hidden !important;
        }

        .zm-youtube-short-card,
        .zm-youtube-short-card iframe,
        .zm-unboxing-video-wrap,
        .zm-unboxing-video {
          min-width: 0 !important;
          max-width: 100% !important;
        }

        @media (max-width: 620px) {
          .mock-home,
          .mock-home > *,
          .mock-home .site-shell {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>


      <style>{`
        /* Keep scrolling enabled, but never show scrollbar tracks on homepage. */
        html,
        body,
        .mock-home,
        .mock-home * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }

        html::-webkit-scrollbar,
        body::-webkit-scrollbar,
        .mock-home::-webkit-scrollbar,
        .mock-home *::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
          background: transparent !important;
        }

        .mock-home,
        .mock-home * {
          scrollbar-color: transparent transparent !important;
        }
      `}</style>

    </div>
  );
}
