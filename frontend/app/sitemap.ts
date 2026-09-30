import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://zelvomart.com").replace(/\/$/, "");
  const [products, categories, pages] = await Promise.all([
    prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/shop/`, lastModified: new Date() },
    ...products.map((row) => ({ url: `${base}/product/${row.slug}/`, lastModified: row.updatedAt })),
    ...categories.map((row) => ({ url: `${base}/product-category/${row.slug}/`, lastModified: row.updatedAt })),
    ...pages.map((row) => ({ url: `${base}/${row.slug}/`, lastModified: row.updatedAt })),
  ];
}
