import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategoryBySlug, products, type CategoryId } from "@store/lib/catalog";
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
  await loadStore();
  // An empty listing is what Google files as a "soft 404": noindex until a product is published here.
  const empty = !products.some((p) => p.category === c.id);
  return {
    ...(empty ? { robots: { index: false, follow: true } } : {}),
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
