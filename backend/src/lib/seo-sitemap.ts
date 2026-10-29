import { readCatalogMeta } from "./catalog-meta";

/** Google reads up to 1,000 images per URL; Yoast lists the main image and the gallery. Ten is plenty. */
export const SITEMAP_IMAGE_LIMIT = 10;

export type SitemapProductRow = {
  slug: string;
  title: string;
  status: string;
  updatedAt: Date;
  sourceUrl: string | null;
  images: unknown;
  category: { slug: string } | null;
};

export type SitemapCategoryRow = {
  slug: string;
  name: string;
  updatedAt: Date;
  imageUrl: string | null;
  _count: { products: number };
};

/** An absolute https image URL. Uploaded files ("/uploads/…") are served through the storefront origin. */
export function absoluteImageUrl(value: unknown, origin: string): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const url = raw.startsWith("/") && !raw.startsWith("//") ? new URL(raw, origin) : new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Main image first, then the gallery: absolute, without duplicates, at most SITEMAP_IMAGE_LIMIT. */
export function sitemapImages(images: unknown, origin: string): string[] {
  const list = Array.isArray(images) ? images : [];
  const out: string[] = [];
  for (const value of list) {
    const url = absoluteImageUrl(value, origin);
    if (url && !out.includes(url)) out.push(url);
    if (out.length >= SITEMAP_IMAGE_LIMIT) break;
  }
  return out;
}

/**
 * What search engines may list (GET /api/seo/sitemap): published products that are not marked noindex,
 * with their images, and every category with its count of published products (the storefront leaves
 * out categories with none).
 */
export function seoSitemapIndex(products: SitemapProductRow[], categories: SitemapCategoryRow[], origin: string) {
  return {
    products: products
      .filter((p) => p.status === "PUBLISHED" && readCatalogMeta(p.sourceUrl)?.robotsIndex !== "noindex")
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        updatedAt: p.updatedAt.toISOString(),
        category: p.category?.slug ?? null,
        images: sitemapImages(p.images, origin),
      })),
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      updatedAt: c.updatedAt.toISOString(),
      imageUrl: absoluteImageUrl(c.imageUrl, origin),
      publishedProducts: c._count.products,
    })),
  };
}
