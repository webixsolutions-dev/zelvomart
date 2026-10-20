import type { MetadataRoute } from "next";
import { categories, designCategoryId } from "@store/lib/catalog";
import { site } from "@store/lib/site";
import { loadSeoIndex } from "@store/lib/backend";
import { storefrontRedirect } from "@store/lib/redirects";

export const revalidate = 3600;

const pages = ["", "shop-all-products", "new-arrivals", "bestsellers", "deals-and-offers", "about-us", "contact-us", "faqs", "track-your-order", "shipping-policy", "refund-and-return-policy", "privacy-policy", "terms-and-conditions"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await loadSeoIndex();
  const now = new Date();
  const date = (value?: string) => (value ? new Date(value) : now);
  const categoryDates = new Map(seo.categories.map((c) => [designCategoryId(c.slug), c.updatedAt]));
  // CMS pages from Admin → Pages, except the slugs the design already serves or that now redirect.
  const cmsPages = seo.pages.filter((p) => !pages.includes(p.slug) && !storefrontRedirect(`/${p.slug}/`));
  return [
    ...pages.map((p) => ({ url: `${site.url}/${p ? p + "/" : ""}`, lastModified: now, priority: p ? 0.7 : 1 })),
    ...categories.map((c) => ({ url: `${site.url}/category/${c.slug}/`, lastModified: date(categoryDates.get(c.id)), priority: 0.9 })),
    ...seo.products.map((p) => ({ url: `${site.url}/product/${p.slug}/`, lastModified: date(p.updatedAt), priority: 0.8 })),
    ...cmsPages.map((p) => ({ url: `${site.url}/${p.slug}/`, lastModified: date(p.updatedAt), priority: 0.5 })),
  ];
}
