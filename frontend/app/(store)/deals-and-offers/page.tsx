import type { Metadata } from "next";
import { collections } from "@/lib/catalog";
import { CollectionArchive } from "@/components/shop/ArchivePage";
import { bannerOg, shareMeta } from "@/lib/seo";

const c = collections["deals"];

export const metadata: Metadata = {
  title: { absolute: c.seoTitle },
  description: c.seoDescription,
  alternates: { canonical: "/deals-and-offers/" },
  ...shareMeta({ title: c.seoTitle, description: c.seoDescription, path: "/deals-and-offers/", image: bannerOg(c.banner, c.title) }),
};

export default function Page() {
  return <CollectionArchive k="deals" />;
}
