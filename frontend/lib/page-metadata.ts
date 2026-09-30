import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export async function metadataForPage(slug: string, fallbackSlugs: string[] = []): Promise<Metadata> {
  const page = await prisma.page.findFirst({
    where: { slug: { in: [slug, ...fallbackSlugs] }, published: true },
    select: { slug: true, title: true, seoTitle: true, seoDescription: true },
  });
  if (!page) return {};
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    alternates: { canonical: `/${page.slug}/` },
    openGraph: {
      title: page.seoTitle || page.title,
      description: page.seoDescription || undefined,
      url: `/${page.slug}/`,
    },
  };
}
