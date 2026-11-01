import type { Metadata } from "next";
import { collections } from "@store/lib/catalog";
import { CollectionArchive } from "@store/components/shop/ArchivePage";
import { bannerOg, shareMeta } from "@store/lib/seo";
import { collectionListing, listingMeta } from "@store/lib/archive-page";

const c = collections["new-arrivals"];
const PATH = "/new-arrivals/";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 24 products per page; ?page=2 … are their own pages (canonical to themselves), filtered views canonicalise to the page.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const meta = await listingMeta(PATH, await searchParams, c.seoTitle, { collection: "new-arrivals" });
  return {
    title: { absolute: meta.title },
    description: c.seoDescription,
    alternates: { canonical: meta.canonical },
    ...shareMeta({ title: meta.title, description: c.seoDescription, path: meta.canonical, image: bannerOg(c.banner, c.title) }),
  };
}

export default async function Page({ searchParams }: Props) {
  const { params, data } = await collectionListing("new-arrivals", PATH, await searchParams);
  return <CollectionArchive k="new-arrivals" data={data} params={params} basePath={PATH} />;
}
