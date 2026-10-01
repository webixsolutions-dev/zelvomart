import Link from "next/link";
import Hero from "@/components/Hero";
import TrustStrip from "@/components/TrustStrip";
import CategoryGrid from "@/components/CategoryGrid";
import ProductGrid from "@/components/ProductGrid";
import PopularCollections from "@/components/PopularCollections";
import Faq from "@/components/Faq";
import { getCategories, getProducts } from "@/lib/store";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [categories, featured, latest, fashion, beauty, homeConfig] = await Promise.all([
    getCategories(),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ limit: 12 }),
    getProducts({ category: "fashion-accessories", limit: 4 }),
    getProducts({ category: "beauty-personal-care", limit: 4 }),
    getSetting<any>("homepage.config", {}),
  ]);
  const heroProducts = featured.items.length ? featured.items : latest.items;
  const best = featured.items.length ? featured.items : latest.items.slice(0, 8);

  return (
    <>
      <Hero products={heroProducts} config={homeConfig} />
      <section className="section"><div className="site-shell"><TrustStrip /></div></section>

      <section className="section section-soft">
        <div className="site-shell">
          <div className="section-title"><div><h2>Shop by Category</h2><p>Explore our categories and find exactly what you need.</p></div><Link href="/shop" className="btn-outline">View All</Link></div>
          <CategoryGrid categories={categories} />
        </div>
      </section>

      <section className="section">
        <div className="site-shell">
          <div className="section-title"><div><h2>Best Sellers</h2><p>Real products from the Zelvomart catalogue, available with Cash on Delivery.</p></div><Link href="/shop" className="btn-outline">Shop All</Link></div>
          <ProductGrid products={best} />
        </div>
      </section>

      {fashion.items.length ? <section className="section section-soft"><div className="site-shell"><div className="section-title"><div><h2>Fashion Accessories</h2><p>Popular accessories from the live catalogue.</p></div><Link href="/product-category/fashion-accessories/" className="btn-outline">View Category</Link></div><ProductGrid products={fashion.items} /></div></section> : null}
      {beauty.items.length ? <section className="section"><div className="site-shell"><div className="section-title"><div><h2>Beauty & Personal Care</h2><p>Quality-checked beauty and personal care products.</p></div><Link href="/product-category/beauty-personal-care/" className="btn-outline">View Category</Link></div><ProductGrid products={beauty.items} /></div></section> : null}

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
