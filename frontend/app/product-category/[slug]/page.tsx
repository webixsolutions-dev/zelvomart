import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductGrid from "@/components/ProductGrid";
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

  return <div className="site-shell pb-20"><div className="page-head"><h1>{category.name}</h1><p>{category.description || `Explore ${category.name} products from Zelvomart.`}</p></div><div className="mb-5 flex justify-end"><form><select name="sort" defaultValue={sort} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select><button className="ml-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Sort</button></form></div><ProductGrid products={result.items} /></div>;
}
