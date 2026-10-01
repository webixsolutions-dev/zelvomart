import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductGrid from "@/components/ProductGrid";
import PromoCta from "@/components/PromoCta";
import { DUMMY_PRODUCTS } from "@/lib/dummy-content";
import { getCategories, getProducts } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((row) => row.slug === slug);
  if (!category) return {};
  return { title: category.seoTitle || category.name, description: category.seoDescription || category.description || `Shop ${category.name} at Zelvomart with Cash on Delivery.`, alternates: { canonical: `/product-category/${category.slug}/` } };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const category = (await getCategories()).find((row) => row.slug === slug);
  if (!category) notFound();
  const sortValue = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort = sortValue === "price-asc" || sortValue === "price-desc" ? sortValue : "newest";
  const result = await getProducts({ category: slug, sort, limit: 24 });
  const fallbackMap: Record<string, typeof DUMMY_PRODUCTS.best> = {
    "fashion-accessories": DUMMY_PRODUCTS.fashion,
    "beauty-personal-care": DUMMY_PRODUCTS.beauty,
    "home-living": DUMMY_PRODUCTS.best.slice(0,4),
    "home-decor": DUMMY_PRODUCTS.best.slice(4,8),
    "tech-gadgets": DUMMY_PRODUCTS.best.slice(2,6),
    "sports-fitness": DUMMY_PRODUCTS.best.slice(1,5),
    "kids-toys": DUMMY_PRODUCTS.best.slice(4,8),
  };
  const items = result.items.length ? result.items : (fallbackMap[slug] || DUMMY_PRODUCTS.best);

  return (
    <div className="site-shell pb-20">
      <div className="page-head">
        <h1>{category.name}</h1>
        <p>{category.description || `Explore ${category.name} products from Zelvomart.`}</p>
      </div>
      <div className="mb-5 flex justify-end"><form><select name="sort" defaultValue={sort} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select><button className="ml-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Sort</button></form></div>
      <ProductGrid products={items} emptyText="Products will appear here once the catalogue is updated." />
      <PromoCta title={`Need help choosing ${category.name}?`} body="Message us on WhatsApp for product details, stock confirmation and order support." buttonText="Chat on WhatsApp" buttonHref="https://wa.me/923002026711" secondaryText="Continue Shopping" secondaryHref="/shop" />
    </div>
  );
}
