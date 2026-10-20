/**
 * Every fixed 301 of the storefront, used by `proxy.ts`. Each old URL answers one 301 straight to
 * its final page, always with a trailing slash. Kept free of imports, because the backend's
 * launch tests read it through `lib/launch/redirects.ts`.
 */

/** Old path (no trailing slash) → new page. */
export const legacyPaths: Record<string, string> = {
  // Old platform pages
  "/shop": "/shop-all-products/",
  "/new-in": "/new-arrivals/",
  "/discount": "/deals-and-offers/",
  "/deals": "/deals-and-offers/",
  "/faq": "/faqs/",
  "/contact": "/contact-us/",
  "/about": "/about-us/",
  "/track-order": "/track-your-order/",
  "/account": "/my-account/",
  "/terms": "/terms-and-conditions/",
  "/terms-conditions": "/terms-and-conditions/",
  "/refund_returns": "/refund-and-return-policy/",
  "/returns-exchange": "/refund-and-return-policy/",
  "/returns-refunds": "/refund-and-return-policy/",
  "/returns": "/refund-and-return-policy/",
  "/shipping-delivery": "/shipping-policy/",
  "/shipping": "/shipping-policy/",
  "/privacy": "/privacy-policy/",
  "/blog": "/",
  // zelvo-mart's vercel.json: the design's short category links
  "/category/home-living": "/category/home-and-living/",
  "/category/beauty": "/category/beauty-and-personal-care/",
  "/category/tech": "/category/tech-and-gadgets/",
  "/category/fashion": "/category/fashion-accessories/",
  "/category/fitness": "/category/sports-and-fitness/",
  "/category/kids": "/category/kids-and-toys/",
};

/** Backend (WooCommerce) category slug → the design's category URL slug. */
export const categorySlugMap: Record<string, string> = {
  "home-living": "home-and-living",
  "home-decor": "home-decor",
  "beauty-personal-care": "beauty-and-personal-care",
  "tech-gadgets": "tech-and-gadgets",
  "fashion-accessories": "fashion-accessories",
  "sports-fitness": "sports-and-fitness",
  "kids-toys": "kids-and-toys",
};

// The old platform linked categories by their backend slug: /category/beauty-personal-care/ and so on.
for (const [backend, design] of Object.entries(categorySlugMap)) {
  if (backend !== design) legacyPaths[`/category/${backend}`] ??= `/category/${design}/`;
}

/**
 * The page an old URL moves to, or null when it has none. The result ends with `/`
 * (or carries the query for the old thank-you page).
 */
export function storefrontRedirect(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const fixed = legacyPaths[path];
  if (fixed) return fixed;
  const category = path.match(/^\/product-category\/(?:.*\/)?([^/]+)$/);
  if (category) {
    const slug = decodeURIComponent(category[1]).toLowerCase();
    return `/category/${encodeURIComponent(categorySlugMap[slug] || slug)}/`;
  }
  const success = path.match(/^\/checkout\/success\/([^/]+)$/);
  if (success) return `/order-confirmed/?order=${success[1]}`;
  return null;
}
