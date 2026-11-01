import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategoryBySlug, type CategoryId } from "@store/lib/catalog";
import { CategoryArchive } from "@store/components/shop/ArchivePage";
import { bannerOg, shareMeta } from "@store/lib/seo";
import { categoryListing, listingMeta } from "@store/lib/archive-page";

// The seven categories are built ahead; any other slug renders on demand and gets the 404 page.
// (dynamicParams = false made every category 404 after an on-demand revalidation, e.g. saving Admin → Settings.)
export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const c = getCategoryBySlug((await params).slug);
  if (!c) return {};
  const path = `/product-category/${c.slug}/`;
  const meta = await listingMeta(path, await searchParams, c.seoTitle, { category: c.id as CategoryId });
  // Indexable even with no products yet: the page then shows a "coming soon" block, other categories and
  // bestsellers instead of an empty grid (owner decision, 30 Oct 2026).
  return {
    title: meta.title,
    description: c.seoDescription,
    alternates: { canonical: meta.canonical },
    ...shareMeta({ title: `${meta.title} | Zelvomart`, description: c.seoDescription, path: meta.canonical, image: bannerOg(c.banner, c.name) }),
  };
}

export default async function Page({ params, searchParams }: Props) {
  const c = getCategoryBySlug((await params).slug);
  if (!c) notFound();
  const path = `/product-category/${c.slug}/`;
  const listing = await categoryListing(c.id as CategoryId, path, await searchParams);
  return <CategoryArchive id={c.id as CategoryId} data={listing.data} params={listing.params} basePath={path} soon={listing.soon} />;
}
