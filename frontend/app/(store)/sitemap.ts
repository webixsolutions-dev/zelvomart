import type { MetadataRoute } from "next";
import { categories, products } from "@store/lib/catalog";
import { site } from "@store/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = ["", "shop-all-products", "new-arrivals", "bestsellers", "deals-and-offers", "about-us", "contact-us", "faqs", "track-your-order", "shipping-policy", "refund-and-return-policy", "privacy-policy", "terms-and-conditions"];
  return [
    ...pages.map((p) => ({ url: `${site.url}/${p ? p + "/" : ""}`, lastModified: now, priority: p ? 0.7 : 1 })),
    ...categories.map((c) => ({ url: `${site.url}/category/${c.slug}/`, lastModified: now, priority: 0.9 })),
    ...products.map((p) => ({ url: `${site.url}/product/${p.slug}/`, lastModified: now, priority: 0.8 })),
  ];
}
