import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategoryBySlug, type CategoryId } from "@store/lib/catalog";
import { CategoryArchive } from "@store/components/shop/ArchivePage";
import { bannerOg, shareMeta } from "@store/lib/seo";
import { loadStore } from "@store/lib/backend";

// The seven categories are built ahead; any other slug renders on demand and gets the 404 page.
// (dynamicParams = false made every category 404 after an on-demand revalidation, e.g. saving Admin → Settings.)
export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCategoryBySlug((await params).slug);
  if (!c) return {};
  // Indexable even with no products yet: the page then shows a "coming soon" block, other categories and
  // bestsellers instead of an empty grid (owner decision, 30 Oct 2026).
  return {
    title: c.seoTitle,
    description: c.seoDescription,
    alternates: { canonical: `/product-category/${c.slug}/` },
    ...shareMeta({ title: `${c.seoTitle} | Zelvomart`, description: c.seoDescription, path: `/product-category/${c.slug}/`, image: bannerOg(c.banner, c.name) }),
  };
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await loadStore();
  const c = getCategoryBySlug((await params).slug);
  if (!c) notFound();
  return <CategoryArchive id={c.id as CategoryId} />;
}
