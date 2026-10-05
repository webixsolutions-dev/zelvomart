# Navbar, hydration and category-image fix

- Rebuilt the storefront header into a stable two-row desktop layout.
- Main row: logo, navigation, support phone, account/track-order icon and cart.
- Second row: six categories with photographic thumbnails on the left and search aligned on the right, directly below the support-number area.
- Added explicit SVG sizing to the account/cart controls so icons cannot overflow into the hero.
- Added category thumbnails to the mobile drawer.
- Forced the six known category cards to use recovered local WebP photography rather than legacy SVG placeholders.
- Fixed `FlashDealBanner` hydration mismatch by rendering a deterministic placeholder on SSR and starting the live countdown after client hydration.
- No backend, admin, checkout, CRO, Meta attribution or session-replay behavior was removed.
