import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import Faq from "@/components/Faq";
import HomeVideoShowcase from "@/components/HomeVideoShowcase";
import HomeBannerCarousel from "@/components/HomeBannerCarousel";
import { getProductBySlug, getProducts, getStoreBootstrap } from "@/lib/store";
import { getProductFallbackImage } from "@/lib/product-media";
import type { Category, Product } from "@/types/product";

export const revalidate = 120;

const categoryFallbacks: Record<string, string> = {
  "fashion-accessories": "/images/categories/fashion-accessories.webp",
  "home-living": "/images/categories/home-living.webp",
  "home-decor": "/images/categories/home-decor.webp",
  "beauty-personal-care": "/images/categories/beauty-personal-care.webp",
  "tech-gadgets": "/images/categories/tech-gadgets.webp",
  "sports-fitness": "/images/categories/sports-fitness.webp",
  "kids-toys": "/images/categories/kids-toys.png",
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
  const preferred = ["fashion-accessories", "tech-gadgets", "home-living"];
  const chosen: Category[] = [];
  for (const slug of preferred) {
    const category = categories.find((item) => item.slug === slug);
    if (category && !chosen.some((item) => item.id === category.id)) chosen.push(category);
  }
  for (const category of categories) {
    if (chosen.length >= 3) break;
    if (!chosen.some((item) => item.id === category.id)) chosen.push(category);
  }
  return chosen.slice(0, 3);
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

  const shortVideos = detailedReviewProducts.slice(0, 5).map((product) => ({
    title: product.name,
    subtitle: product.shortDescription || product.categories?.[0]?.name || "Zelvomart video preview",
    poster: product.image || getProductFallbackImage(product),
    url: product.videoUrl || "",
  }));


  return (
    <div className="mock-home">
      <HomeBannerCarousel whatsapp={whatsapp} />

      

      <section className="site-shell mock-home-section">
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
                {index === 0 ? <small>FEATURED COLLECTION</small> : null}
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
          object-fit: cover !important;
          object-position: center center !important;
        }
        .zm-category-prominent .mock-category-responsive-card img.zm-category-image.is-kids {
          object-fit: contain !important;
          object-position: center center !important;
          background: #f6ead2 !important;
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
            object-fit: contain !important;
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
        </div>

        <ProductGrid products={products.slice(0, 4)} />

        <div className="zm-view-all-products">
          <Link href="/shop">View All Products →</Link>
        </div>

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
            <span className="mock-eyebrow">THE ZELVO STANDARD</span>
            <h2>We don&apos;t sell everything.<br /><em>Only what&apos;s worth it.</em></h2>
            <p>Useful, clear and easy to order. That&apos;s the standard behind every Zelvomart pick.</p>

            <div className="zm-standard-actions">
              <Link href="/about-us" className="zm-standard-btn light">Our story →</Link>
              <Link href="/shop" className="zm-standard-btn blue">Shop now →</Link>
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
            color: #08a8e5 !important;
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
              <h3>{category.description || category.name}</h3>
              <b>Shop {category.name} →</b>
            </Link>
          ))}
        </section>
      ) : null}

      <HomeVideoShowcase videos={shortVideos} />


      <section className="mock-order-steps zm-order-steps">
        <div className="site-shell">
          <span className="mock-eyebrow">HOW IT WORKS</span>
          <h2>Order in a minute. Pay when it arrives.</h2>

          <div className="mock-step-grid zm-step-grid">
            <article className="zm-step-card">
              <b>01</b>
              <div className="zm-step-row">
                <span className="mock-step-icon">
                  <Image src="/images/order-steps/01-choose.svg" alt="Choose a product" width={46} height={46} />
                </span>
                <div>
                  <h3>Choose</h3>
                  <p>Pick the product that works for you.</p>
                </div>
              </div>
            </article>

            <article className="zm-step-card">
              <b>02</b>
              <div className="zm-step-row">
                <span className="mock-step-icon">
                  <Image src="/images/order-steps/02-confirm.svg" alt="Confirm your order" width={46} height={46} />
                </span>
                <div>
                  <h3>Confirm</h3>
                  <p>Enter delivery details and place your order.</p>
                </div>
              </div>
            </article>

            <article className="zm-step-card">
              <b>03</b>
              <div className="zm-step-row">
                <span className="mock-step-icon">
                  <Image src="/images/order-steps/03-checked-packed.svg" alt="Order checked and packed" width={46} height={46} />
                </span>
                <div>
                  <h3>Checked &amp; packed</h3>
                  <p>We check and pack your order carefully before dispatch.</p>
                </div>
              </div>
            </article>

            <article className="zm-step-card">
              <b>04</b>
              <div className="zm-step-row">
                <span className="mock-step-icon">
                  <Image src="/images/order-steps/04-delivered-pay-cash.svg" alt="Delivered and paid with cash" width={46} height={46} />
                </span>
                <div>
                  <h3>Delivered &amp; pay cash</h3>
                  <p>Receive your parcel and pay Cash on Delivery.</p>
                </div>
              </div>
            </article>
          </div>
        </div>

        <style>{`
          .zm-order-steps {
            background: #eef5f8 !important;
          }

          .zm-step-grid .zm-step-card {
            background: #fff !important;
            color: #102733 !important;
            border: 1px solid #dbe5ea !important;
            border-radius: 14px !important;
            box-shadow: none !important;
            padding: 16px !important;
          }

          .zm-step-grid .zm-step-card > b {
            color: #c7d2d8 !important;
            font-size: 22px !important;
            line-height: 1;
            display: block;
            text-align: right;
            margin-bottom: 4px;
          }

          .zm-step-row {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-top: 8px;
          }

          .zm-step-row .mock-step-icon {
            flex: 0 0 auto;
            width: 54px !important;
            margin-top: 4px;
            height: 54px !important;
            border-radius: 12px !important;
            background: #e8f7fd !important;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
          }

          .zm-step-row h3 {
            margin: 0 0 4px !important;
            color: #102733 !important;
            font-size: 16px !important;
            line-height: 1.15 !important;
          }

          .zm-step-row p {
            margin: 0 !important;
            color: #637480 !important;
            font-size: 12px !important;
            line-height: 1.45 !important;
          }

          @media (max-width: 760px) {
            .zm-step-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px !important;
            }

            .zm-step-grid .zm-step-card {
              min-width: 0;
              padding: 11px !important;
            }

            .zm-step-grid .zm-step-card > b {
              font-size: 18px !important;
              margin-bottom: 2px;
            }

            .zm-step-row {
              align-items: flex-start;
              gap: 8px;
              margin-top: 5px;
            }

            .zm-step-row .mock-step-icon {
              width: 40px !important;
              height: 40px !important;
              margin-top: 2px;
            }

            .zm-step-row .mock-step-icon img {
              width: 34px !important;
              height: 34px !important;
            }

            .zm-step-row h3 {
              font-size: 12.5px !important;
              line-height: 1.18 !important;
            }

            .zm-step-row p {
              font-size: 9.5px !important;
              line-height: 1.35 !important;
            }
          }
        `}</style>
      </section>

      <section className="site-shell zm-unboxing-section">
        <div className="zm-unboxing-video-wrap">
          <video
            className="zm-unboxing-video"
            controls
            playsInline
            preload="metadata"
          >
            <source src="/videos/zelvomart-unboxing.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
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
            object-fit: cover;
            background: #dff3fb;
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

      <section className="mock-whatsapp-strip zm-whatsapp-wide">
        <div><span>◉</span><p><b>Questions before you order? Ask a real person.</b><small>We&apos;re here for product, stock and delivery questions.</small></p></div>
        <a className="zm-whatsapp-main-btn" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
        <Link className="zm-whatsapp-help-btn" href="/contact-us">Browse help &amp; contact</Link>
      </section>

      <style>{`
        .zm-whatsapp-wide {
          width: 100% !important;
          max-width: none !important;
          margin: 18px 0 60px !important;
          padding: 20px clamp(20px, 3.2vw, 54px) !important;
          border-radius: 0 !important;
          background: linear-gradient(90deg, #dcf8e7 0%, #e9fbf0 48%, #dcf8e7 100%) !important;
          border-top: 1px solid #c5efd4;
          border-bottom: 1px solid #c5efd4;
          box-shadow: none !important;
          box-sizing: border-box;
        }
        .zm-whatsapp-wide > div > span {
          width: 46px !important;
          height: 46px !important;
          border-radius: 13px !important;
          background: #25d366 !important;
          font-size: 18px !important;
        }
        .zm-whatsapp-wide p b {
          font-size: 14px !important;
        }
        .zm-whatsapp-wide p small {
          font-size: 10.5px !important;
          margin-top: 4px !important;
        }
        .zm-whatsapp-wide .zm-whatsapp-main-btn {
          padding: 15px 24px !important;
          border-radius: 10px !important;
          background: #25d366 !important;
          color: #fff !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .zm-whatsapp-wide .zm-whatsapp-help-btn {
          padding: 14px 20px !important;
          border-radius: 10px !important;
          font-size: 11px !important;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #fff !important;
          border: 1px solid #bfe6cc !important;
        }
        @media (max-width: 620px) {
          .zm-whatsapp-wide {
            margin-bottom: 42px !important;
            padding: 16px 12px !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }
          .zm-whatsapp-wide > div {
            grid-column: 1 / -1;
          }
          .zm-whatsapp-wide .zm-whatsapp-main-btn,
          .zm-whatsapp-wide .zm-whatsapp-help-btn {
            width: 100%;
            padding-inline: 10px !important;
          }
        }
      `}</style>

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
    </div>
  );
}
