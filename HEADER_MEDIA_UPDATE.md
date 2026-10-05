# Header + Media Update

- Moved **Shop All** and the desktop **search bar** into the same clean white toolbar directly under the main header.
- Kept the six category links in a separate slim row beneath the toolbar so the header does not look crowded.
- Recovered the original Zelvomart category artwork from the supplied WordPress uploads backup and replaced generic SVG category fallbacks with the original WebP artwork.
- Recovered the original Zelvomart hero artwork for the no-product fallback.
- Recovered primary images for 16 legacy WooCommerce product slugs from the supplied Meta/WooCommerce catalog and uploads backup. These local images are used when legacy remote WordPress media is missing/slow.
- Product images use `object-fit: contain` on a clean white surface so products are not cropped.
- Category photography uses `object-fit: cover` with a lighter readability overlay.
