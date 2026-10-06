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

      <HomeVideoShowcase videos={shortVideos} />


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
