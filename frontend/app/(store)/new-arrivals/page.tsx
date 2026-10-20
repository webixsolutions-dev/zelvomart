import type { Metadata } from "next";
import { collections } from "@store/lib/catalog";
import { CollectionArchive } from "@store/components/shop/ArchivePage";
import { bannerOg, shareMeta } from "@store/lib/seo";

const c = collections["new-arrivals"];

export const metadata: Metadata = {
  title: { absolute: c.seoTitle },
  description: c.seoDescription,
  alternates: { canonical: "/new-arrivals/" },
  ...shareMeta({ title: c.seoTitle, description: c.seoDescription, path: "/new-arrivals/", image: bannerOg(c.banner, c.title) }),
};

export default function Page() {
  return <CollectionArchive k="new-arrivals" />;
}
