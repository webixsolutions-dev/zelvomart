import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryBySlug, collections } from "@store/lib/catalog";
import { CategoryArchive, CollectionArchive } from "./ArchivePage";
import { bannerOg, shareMeta } from "@store/lib/seo";
import { categoryListing, collectionListing, listingMeta } from "@store/lib/archive-page";

type Search = Record<string, string | string[] | undefined>;
const shop = collections.shop;
const shopPath = "/shop/";

export async function shopMetadata(search: Search = {}): Promise<Metadata> {
  const meta = await listingMeta(shopPath, search, shop.seoTitle, { collection: "shop" });
  return {
    title: { absolute: meta.title },
    description: shop.seoDescription,
    alternates: { canonical: meta.canonical },
    ...shareMeta({ title: meta.title, description: shop.seoDescription, path: meta.canonical, image: bannerOg(shop.banner, shop.title) }),
  };
}

export async function ShopListing({ search }: { search?: Search }) {
  const { params, data } = await collectionListing("shop", shopPath, search ?? {}, { strict: !search });
  return <CollectionArchive k="shop" data={data} params={params} basePath={shopPath} />;
}

export async function categoryMetadata(slug: string, search: Search = {}): Promise<Metadata> {
  const c = getCategoryBySlug(slug);
  if (!c) return {};
  const path = `/product-category/${c.slug}/`;
  const meta = await listingMeta(path, search, c.seoTitle, { category: c.id });
  return {
    title: meta.title,
    description: c.seoDescription,
    alternates: { canonical: meta.canonical },
    ...shareMeta({ title: `${meta.title} | Zelvomart`, description: c.seoDescription, path: meta.canonical, image: bannerOg(c.banner, c.name) }),
  };
}

export async function CategoryListing({ slug, search }: { slug: string; search?: Search }) {
  const c = getCategoryBySlug(slug);
  if (!c) notFound();
  const path = `/product-category/${c.slug}/`;
  const { data, params, soon } = await categoryListing(c.id, path, search ?? {}, { strict: !search });
  return <CategoryArchive id={c.id} data={data} params={params} basePath={path} soon={soon} />;
}
