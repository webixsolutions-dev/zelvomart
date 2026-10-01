# Frontend content/category update

- Storefront now exposes exactly six categories: Home & Living, Home Decor, Beauty & Personal Care, Tech & Gadgets, Fashion Accessories, Sports & Fitness.
- Header/mobile category links point directly to `/product-category/<slug>/` instead of the old `/category/<slug>` redirect route.
- Homepage category showcase is limited to the six storefront categories.
- Shop page includes populated category pills, filters and dummy catalogue fallback when the API has no products.
- Category pages show product grids directly and use category-specific dummy products only as a fallback.
- Dummy product cards link to working dummy product detail fallbacks if the backend product is unavailable.
- Blog now contains six populated article cards plus CTA.
- About, Contact, FAQ, Shipping & Delivery, Returns & Exchange, Privacy Policy and Terms include meaningful fallback copy so they never appear empty when CMS content is missing.
- Static content pages include a customer-support CTA.
