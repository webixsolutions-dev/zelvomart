import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategoryBySlug, type CategoryId } from "@/lib/catalog";
import { CategoryArchive } from "@/components/shop/ArchivePage";
import { bannerOg, shareMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCategoryBySlug((await params).slug);
  if (!c) return {};
  return {
    title: c.seoTitle,
    description: c.seoDescription,
    alternates: { canonical: `/category/${c.slug}/` },
    ...shareMeta({ title: `${c.seoTitle} | Zelvomart`, description: c.seoDescription, path: `/category/${c.slug}/`, image: bannerOg(c.banner, c.name) }),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const c = getCategoryBySlug((await params).slug);
  if (!c) notFound();
  return <CategoryArchive id={c.id as CategoryId} />;
}
