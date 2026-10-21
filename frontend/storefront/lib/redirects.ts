/**
 * Every fixed 301 of the storefront, used by `proxy.ts`. The site keeps the WordPress URL structure
 * for every page that is indexed today (`/shop/`, `/product-category/{slug}/`, `/terms-conditions/`,
 * `/refund_returns/`), so those answer 200 and only the other old paths move. Each old URL answers
 * one 301 straight to its final page, always with a trailing slash. Kept free of imports, because the
 * backend's launch tests read it through `lib/launch/redirects.ts`.
 */

/** Old path (no trailing slash) → final page. */
export const legacyPaths: Record<string, string> = {
  // The design's first paths (before the WordPress structure was kept)
  "/shop-all-products": "/shop/",
  "/terms-and-conditions": "/terms-conditions/",
  "/refund-and-return-policy": "/refund_returns/",
  // Old platform pages
  "/new-in": "/new-arrivals/",
  "/discount": "/deals-and-offers/",
  "/deals": "/deals-and-offers/",
  "/faq": "/faqs/",
  "/contact": "/contact-us/",
  "/about": "/about-us/",
  "/track-order": "/track-your-order/",
  "/account": "/my-account/",
  "/terms": "/terms-conditions/",
  "/returns-exchange": "/refund_returns/",
  "/returns-refunds": "/refund_returns/",
  "/returns": "/refund_returns/",
  "/shipping-delivery": "/shipping-policy/",
  "/shipping": "/shipping-policy/",
  "/privacy": "/privacy-policy/",
  "/blog": "/",
};

/** Any other slug a category was ever linked by (the design's long and short ones) → WordPress slug. */
export const categorySlugAliases: Record<string, string> = {
  "home-and-living": "home-living",
  "beauty-and-personal-care": "beauty-personal-care",
  beauty: "beauty-personal-care",
  "tech-and-gadgets": "tech-gadgets",
  tech: "tech-gadgets",
  fashion: "fashion-accessories",
  "sports-and-fitness": "sports-fitness",
  fitness: "sports-fitness",
  "kids-and-toys": "kids-toys",
  kids: "kids-toys",
};

/**
 * The page an old URL moves to, or null when it has none. The result ends with `/`
 * (or carries the query for the old thank-you page).
 */
export function storefrontRedirect(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const fixed = legacyPaths[path];
  if (fixed) return fixed;
  // /category/{design or WordPress slug}/ → /product-category/{WordPress slug}/
  const category = path.match(/^\/category\/([^/]+)$/);
  if (category) {
    const slug = decodeURIComponent(category[1]).toLowerCase();
    return `/product-category/${encodeURIComponent(categorySlugAliases[slug] || slug)}/`;
  }
  // A design slug used under the WordPress prefix still lands on the WordPress slug.
  const aliased = path.match(/^\/product-category\/([^/]+)$/);
  if (aliased) {
    const slug = decodeURIComponent(aliased[1]).toLowerCase();
    if (categorySlugAliases[slug]) return `/product-category/${categorySlugAliases[slug]}/`;
  }
  const success = path.match(/^\/checkout\/success\/([^/]+)$/);
  if (success) return `/order-confirmed/?order=${success[1]}`;
  return null;
}
