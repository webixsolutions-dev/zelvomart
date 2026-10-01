import Link from "next/link";
import { getCategories } from "@/lib/store";
import type { Category } from "@/types/product";

export default async function NotFound() {
  let categories: Category[] = [];
  try {
    categories = await getCategories();
  } catch (error) {
    console.error("[404] Could not load categories", error);
  }
  return <div className="site-shell py-24 text-center"><span className="text-xs font-black tracking-widest text-sky-600">404</span><h1 className="mt-3 text-4xl font-black text-slate-800">We couldn't find that page.</h1><p className="mx-auto mt-3 max-w-xl text-slate-500">Search the shop or choose one of the top categories below.</p><form action="/shop" className="mx-auto mt-7 flex max-w-xl overflow-hidden rounded-full border border-slate-300"><input name="q" placeholder="Search products..." className="min-w-0 flex-1 px-5 py-3 outline-none"/><button className="bg-slate-900 px-5 font-bold text-white">Search</button></form><div className="mt-8 flex flex-wrap justify-center gap-2">{categories.slice(0,7).map((category)=><Link className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold" href={`/product-category/${category.slug}/`} key={category.id}>{category.name}</Link>)}</div></div>;
}
