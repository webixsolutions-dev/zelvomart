# Storefront Shop Update

- Removed the desktop “Shop all” button from the category/search strip.
- Moved desktop product search into that left-side position and kept the six category links alongside it.
- Removed dummy/demo product fallback from storefront product queries. Shop, homepage, category and product pages now use real backend catalogue data only.
- Product cards retain category-aware image fallback only for genuinely missing/broken images; this is a visual fallback, not a fake product.
- Shop page uses 12 products per page.
- Added full pagination with Previous / numbered pages / Next, compact ellipses for large catalogues, active-page state, query/filter preservation and an anchor back to the product grid.
