import type { MetadataRoute } from "next";
import { categories, designCategoryId, products } from "@store/lib/catalog";
import { site } from "@store/lib/site";
import { loadSeoIndex, loadStore } from "@store/lib/backend";
import { storefrontRedirect } from "@store/lib/redirects";

export const revalidate = 3600;

/**
 * The storefront's own pages, with the date their content last changed. A fixed date, not "now":
 * a sitemap that changes on every request tells search engines nothing. Update a date when that
 * page's content changes. The policy pages use the date they were last saved in Admin → Pages.
 */
const pages: Record<string, string> = {
  "": "2026-10-21",
  shop: "2026-10-21",
  "new-arrivals": "2026-10-21",
  bestsellers: "2026-10-21",
  "deals-and-offers": "2026-10-21",
  "about-us": "2026-10-21",
  "contact-us": "2026-10-21",
  faqs: "2026-10-21",
  "track-your-order": "2026-10-21",
  "shipping-policy": "2026-10-21",
  refund_returns: "2026-10-21",
  "privacy-policy": "2026-10-21",
  "terms-conditions": "2026-10-21",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [seo] = await Promise.all([loadSeoIndex(), loadStore()]);
  const date = (value: string) => new Date(value);
  const savedPages = new Map(seo.pages.map((p) => [p.slug, p.updatedAt]));
  const categoryDates = new Map(seo.categories.map((c) => [designCategoryId(c.slug), c.updatedAt]));
  // A category with no published products is noindex (soft 404), so it stays out until one is published.
  const listed = categories.filter((c) => products.some((p) => p.category === c.id));
  // CMS pages from Admin → Pages, except the slugs the design already serves or that now redirect.
  const cmsPages = seo.pages.filter((p) => !(p.slug in pages) && !storefrontRedirect(`/${p.slug}/`));
  return [
    ...Object.entries(pages).map(([p, changed]) => ({
      url: `${site.url}/${p ? p + "/" : ""}`,
      lastModified: date(savedPages.get(p) || changed),
      priority: p ? 0.7 : 1,
    })),
    ...listed.map((c) => ({ url: `${site.url}/product-category/${c.slug}/`, lastModified: date(categoryDates.get(c.id) || pages.shop), priority: 0.9 })),
    ...seo.products.map((p) => ({ url: `${site.url}/product/${p.slug}/`, lastModified: date(p.updatedAt), priority: 0.8 })),
    ...cmsPages.map((p) => ({ url: `${site.url}/${p.slug}/`, lastModified: date(p.updatedAt), priority: 0.5 })),
  ];
}
