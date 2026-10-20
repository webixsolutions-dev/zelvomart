import type { Metadata } from "next";
import { collections } from "@store/lib/catalog";
import { CollectionArchive } from "@store/components/shop/ArchivePage";
import { bannerOg, shareMeta } from "@store/lib/seo";
import { loadStore } from "@store/lib/backend";

const c = collections["shop"];

export const metadata: Metadata = {
  title: { absolute: c.seoTitle },
  description: c.seoDescription,
  alternates: { canonical: "/shop-all-products/" },
  ...shareMeta({ title: c.seoTitle, description: c.seoDescription, path: "/shop-all-products/", image: bannerOg(c.banner, c.title) }),
};

export const revalidate = 300;

export default async function Page() {
  await loadStore();
  return <CollectionArchive k="shop" />;
}
