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
import { DUMMY_PRODUCTS } from "@/lib/dummy-content";

export const revalidate = 120;

export default async function HomePage() {
  const [bootstrap, featured, latest, fashion, beauty] = await Promise.all([
    getStoreBootstrap(),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ limit: 12 }),
    getProducts({ category: "fashion-accessories", limit: 4 }),
    getProducts({ category: "beauty-personal-care", limit: 4 }),
  ]);
  const categories = bootstrap.categories;
  const homeConfig = (bootstrap.settings["homepage.config"] || {}) as any;
  const heroProducts = featured.items.length ? featured.items : (latest.items.length ? latest.items : DUMMY_PRODUCTS.best);
  const best = featured.items.length ? featured.items : (latest.items.length ? latest.items.slice(0, 8) : DUMMY_PRODUCTS.best);
  const fashionItems = fashion.items.length ? fashion.items : DUMMY_PRODUCTS.fashion;
  const beautyItems = beauty.items.length ? beauty.items : DUMMY_PRODUCTS.beauty;

  return (
    <>
      <Hero products={heroProducts} config={homeConfig} />
      <section className="section"><div className="site-shell"><TrustStrip /></div></section>

      <section className="section section-soft">
        <div className="site-shell">
          <div className="section-title"><div><h2>Shop by Category</h2><p>Explore our categories and find exactly what you need.</p></div><Link href="/shop" className="btn-outline">View All</Link></div>
          <CategoryGrid categories={categories.slice(0, 6)} />
        </div>
      </section>

      <section className="section">
        <div className="site-shell">
          <div className="section-title"><div><h2>Best Selling Products</h2><p>Popular picks available with Cash on Delivery.</p></div><Link href="/shop" className="btn-outline">Shop All</Link></div>
          <ProductGrid products={best} />
        </div>
      </section>

      <FlashDealBanner />

      <section className="section section-soft">
        <div className="site-shell">
          <div className="section-title"><div><h2>Fashion Accessories</h2><p>Style essentials and gift-worthy picks.</p></div><Link href="/product-category/fashion-accessories/" className="btn-outline">View Category</Link></div>
          <ProductGrid products={fashionItems} />
        </div>
      </section>

      <PromoCta title="Need help with your order?" body="Place your order on the website or contact us on WhatsApp for quick support, stock checks and delivery details." buttonText="Order on WhatsApp" buttonHref="https://wa.me/923002026711" secondaryText="Contact Us" secondaryHref="/contact-us" />

      <section className="section">
        <div className="site-shell">
          <div className="section-title"><div><h2>Beauty & Wellness</h2><p>Look good, move stronger and shop confidently.</p></div><Link href="/product-category/beauty-personal-care/" className="btn-outline">View Category</Link></div>
          <ProductGrid products={beautyItems} />
        </div>
      </section>

      <PromoCta title="Quality checked before dispatch" body="Every order is handled with care. Browse the catalogue, confirm your order and pay with Cash on Delivery where available." buttonText="Start Shopping" buttonHref="/shop" secondaryText="About Us" secondaryHref="/about-us" />

      <section className="section section-soft">
        <div className="site-shell">
          <div className="section-title"><div><h2>How Cash on Delivery Works</h2><p>A simple four-step order journey.</p></div></div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["01", "Order Placed", "Choose your product and place your order."],
              ["02", "Confirmation", "We confirm by phone or WhatsApp."],
              ["03", "Dispatched", "Your parcel is packed and handed to the courier."],
              ["04", "Delivered", "Pay cash when the parcel reaches you."],
            ].map(([n,title,text]) => <div className="rounded-2xl border border-slate-200 bg-white p-5" key={n}><span className="text-xs font-black text-sky-600">{n}</span><h3 className="mt-2 font-black text-slate-800">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>)}
          </div>
        </div>
      </section>

      <PopularCollections videos={homeConfig.popularCollectionsVideos || []} />
      <Faq />
    </>
  );
}
