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

      <section className="site-shell mock-home-section mock-products-section">
        <div className="mock-section-head">
          <div><span className="mock-eyebrow">BESTSELLERS</span><h2>Our most-ordered right now.</h2></div>
          <Link href="/bestsellers">Shop all bestsellers →</Link>
        </div>
        <ProductGrid products={products.slice(0, 8)} />
      </section>

      <section className="mock-standard-section">
        <div className="site-shell mock-standard-grid">
          <div>
            <span className="mock-eyebrow">THE ZELVO STANDARD</span>
            <h2>We don&apos;t sell everything.<br /><em>Only what&apos;s worth it.</em></h2>
            <p>Useful, clear and easy to order. That&apos;s the standard behind every Zelvomart pick.</p>
            <Link href="/about-us" className="mock-btn-light">Our story →</Link>
          </div>
          <div className="mock-standard-cards">
            <article><span>01</span><b>Chosen, not dumped</b><p>Products are selected for practical everyday use.</p></article>
            <article><span>02</span><b>Checked before dispatch</b><p>Clear information and a final check before it leaves us.</p></article>
            <article><span>03</span><b>Pay when it arrives</b><p>Cash on Delivery keeps ordering simple and familiar.</p></article>
            <article><span>04</span><b>Real people, real help</b><p>WhatsApp support when you want a human answer.</p></article>
          </div>
        </div>
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


      <section className="mock-order-steps">
        <div className="site-shell">
          <span className="mock-eyebrow">HOW IT WORKS</span><h2>Order in a minute. Pay when it arrives.</h2>
          <div className="mock-step-grid">
            <article><b>01</b><span className="mock-step-icon"><Image src="/images/order-steps/01-choose.svg" alt="Choose a product" width={38} height={38} /></span><h3>Choose</h3><p>Pick the product that works for you.</p></article>
            <article><b>02</b><span className="mock-step-icon"><Image src="/images/order-steps/02-confirm.svg" alt="Confirm your order" width={38} height={38} /></span><h3>Confirm</h3><p>Enter delivery details and place your order.</p></article>
            <article><b>03</b><span className="mock-step-icon"><Image src="/images/order-steps/03-checked-packed.svg" alt="Order checked and packed" width={38} height={38} /></span><h3>Checked &amp; packed</h3><p>We check and pack your order carefully before dispatch.</p></article>
            <article className="dark"><b>04</b><span className="mock-step-icon"><Image src="/images/order-steps/04-delivered-pay-cash.svg" alt="Delivered and paid with cash" width={38} height={38} /></span><h3>Delivered &amp; pay cash</h3><p>Receive your parcel and pay Cash on Delivery.</p></article>
          </div>
        </div>
      </section>

      <section className="site-shell mock-whatsapp-strip">
        <div><span>◉</span><p><b>Questions before you order? Ask a real person.</b><small>We&apos;re here for product, stock and delivery questions.</small></p></div>
        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
        <Link href="/contact-us">Browse help &amp; contact</Link>
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
    </div>
  );
}
