import Image from "next/image";
import Link from "next/link";
import ProductGrid from "@/components/ProductGrid";
import TrustStrip from "@/components/TrustStrip";
import Faq from "@/components/Faq";
import HomeVideoShowcase from "@/components/HomeVideoShowcase";
import FeatureVideoSection from "@/components/FeatureVideoSection";
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
  "kids-toys": "/images/categories/kids-toys.svg",
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
  const heroProducts = products.slice(0, 3);
  const cards = categories.slice(0, 7);
  const first = cards[0];
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
    url: "",
  }));

  const featureVideoPoster = products[1]?.image || products[0]?.image || "/images/hero/zelvomart-hero.webp";

  return (
    <div className="mock-home">
      <section className="site-shell mock-home-hero">
        <div className="mock-home-hero-copy">
          <span className="mock-eyebrow">EVERYDAY, UPGRADED</span>
          <h1>
            Everyday things,<br />
            <em>chosen better.</em>
          </h1>
          <p>
            Useful finds for home, beauty, tech and style — checked with care, clearly described,
            and delivered with Cash on Delivery.
          </p>
          <div className="mock-home-hero-actions">
            <Link href="/shop" className="mock-btn-dark">Browse what&apos;s new →</Link>
            <Link href="/bestsellers" className="mock-btn-light">Shop bestsellers</Link>
          </div>
          <div className="mock-hero-micro">
            <span>✓ Quality checked</span><span>✓ Cash on Delivery</span><span>✓ Real support</span>
          </div>
        </div>

        <div className="mock-home-hero-art">
          <span className="mock-hero-ring one" /><span className="mock-hero-ring two" />
          {heroProducts.map((product, index) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}/`}
              className={`mock-hero-product ${index === 0 ? "tumbler" : index === 1 ? "watch" : "bag"}`}
              aria-label={product.name}
            >
              <Image
                src={product.image || getProductFallbackImage(product)}
                alt={product.name}
                fill
                priority={index === 0}
                sizes={index === 0 ? "280px" : "190px"}
              />
            </Link>
          ))}
          <div className="mock-hero-platform p1" /><div className="mock-hero-platform p2" /><div className="mock-hero-platform p3" />
          <span className="mock-hero-float one">✓ Checked before dispatch</span>
          <span className="mock-hero-float two">▱ Pay when it arrives</span>
        </div>
      </section>

      <section className="site-shell mock-home-trust"><TrustStrip /></section>

      <section className="site-shell mock-home-section">
        <div className="mock-section-head">
          <div><span className="mock-eyebrow">SHOP BY CATEGORY</span><h2>Find what you came for.</h2></div>
          <Link href="/shop">All categories →</Link>
        </div>
        <div className="mock-category-showcase">
          {first ? (
            <Link href={`/product-category/${first.slug}/`} className="mock-category-feature">
              <Image src={first.image || categoryFallbacks[first.slug] || "/images/hero/zelvomart-hero.webp"} alt={first.name} fill sizes="(max-width:700px) 100vw, 40vw" />
              <span>FEATURED COLLECTION</span><h3>{first.name}</h3><b>Explore →</b>
            </Link>
          ) : null}
          <div className="mock-category-minis">
            {cards.slice(1).map((category) => (
              <Link key={category.id} href={`/product-category/${category.slug}/`}>
                <div><Image src={category.image || categoryFallbacks[category.slug] || "/images/hero/zelvomart-hero.webp"} alt={category.name} fill sizes="220px" /></div>
                <b>{category.name}</b><span>→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

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
                <Image src={category.image || categoryFallbacks[category.slug] || "/images/hero/zelvomart-hero.webp"} alt={category.name} fill sizes="(max-width:900px) 100vw, 33vw" />
              </div>
              <span>{index === 0 ? "THE STYLE EDIT" : index === 1 ? "THE TECH EDIT" : "EVERYDAY PICKS"}</span>
              <h3>{category.description || category.name}</h3>
              <b>Shop {category.name} →</b>
            </Link>
          ))}
        </section>
      ) : null}

      <HomeVideoShowcase
        title="Shop through quick videos"
        copy="A simple short-video strip is ready here. As soon as you share the final links, we can plug them in without changing the layout."
        videos={shortVideos}
      />

      <FeatureVideoSection
        title="One featured product story can live here."
        copy="This block is ready for a featured reel, unboxing clip or product demo. Add your video link later and this section will instantly become clickable."
        poster={featureVideoPoster}
        points={["Perfect for a featured reel or unboxing video", "Balanced text + video layout for trust", "Easy to update with your final video URL"]}
      />

      {detailedReviewProducts.length ? (
        <section className="site-shell mock-review-section">
          <div className="mock-section-head">
            <div>
              <span className="mock-eyebrow">REAL PRODUCTS, CURRENT CATALOG</span>
              <h2>What&apos;s live in the store right now.</h2>
              <p>Images, prices, ratings and product names below come from the backend catalog.</p>
            </div>
            <Link href="/shop">Shop the collection →</Link>
          </div>
          <div className="mock-review-media">
            {detailedReviewProducts.map((product) => {
              const review = product.reviews?.[0];
              const rating = product.averageRating || review?.rating || 0;
              return (
                <Link href={`/product/${product.slug}/`} key={product.id} className="mock-catalog-story-card">
                  <div><Image src={product.image || getProductFallbackImage(product)} alt={product.name} fill sizes="240px" /></div>
                  {rating > 0 ? <p>{"★".repeat(Math.max(1, Math.min(5, Math.round(rating))))}</p> : <p className="mock-stock-label">IN STOCK</p>}
                  <b>{review?.body || product.name}</b>
                  <small>{review?.verified ? `Verified review · ${review.name}` : product.categories[0]?.name || product.sku}</small>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mock-order-steps">
        <div className="site-shell">
          <span className="mock-eyebrow">HOW IT WORKS</span><h2>Order in a minute. Pay when it arrives.</h2>
          <div className="mock-step-grid">
            <article><b>01</b><span>▣</span><h3>Choose</h3><p>Pick the product that works for you.</p></article>
            <article><b>02</b><span>✓</span><h3>Confirm</h3><p>Enter delivery details and place your order.</p></article>
            <article><b>03</b><span>▱</span><h3>Delivered</h3><p>We pack carefully and send it your way.</p></article>
            <article className="dark"><b>04</b><span>₨</span><h3>Pay cash</h3><p>Pay when your parcel arrives.</p></article>
          </div>
        </div>
      </section>

      <section className="site-shell mock-unbox">
        <div className="mock-unbox-art">
          {products[0] ? (
            <Link href={`/product/${products[0].slug}/`} className="mock-unbox-product">
              <Image src={products[0].image || getProductFallbackImage(products[0])} alt={products[0].name} fill sizes="460px" />
              <span>PACKED WITH CARE</span>
            </Link>
          ) : (
            <Image src="/images/brand-zelvomart.png" alt="Zelvomart package" fill sizes="400px" />
          )}
        </div>
        <div className="mock-unbox-copy">
          <span className="mock-eyebrow">UNBOX WITH CONFIDENCE</span>
          <h2>Arrives like a gift.<br />Every single time.</h2>
          <p>Thoughtful packing, clear order updates and real support make the experience feel simple from checkout to doorstep.</p>
          <ul><li>Protective packaging</li><li>Order confirmation</li><li>Cash on Delivery</li></ul>
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
            <span className="mock-faq-contact-item"><i>☎</i><b>0300-2026711</b></span>
            <span className="mock-faq-contact-item whatsapp"><i>◉</i><b>Chat on WhatsApp</b></span>
            <span className="mock-faq-contact-item"><i>✉</i><b>zelvomart@gmail.com</b></span>
          </div>
        </div>
        <Faq />
      </section>
    </div>
  );
}
