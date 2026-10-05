# Navbar + image loading final fix

- Desktop hamburger/search-mobile controls are forcibly hidden above 900px, preventing the menu icon from leaking into desktop layout.
- Desktop header is a clean three-column row: logo, main navigation, support/actions.
- Search now lives inside the support/actions column directly below the phone number.
- Category strip is a dedicated row with exactly six image chips.
- Category header thumbnails use dedicated 96x96 compressed WebP files (roughly 1-2 KB each), eager loading, high fetch priority and direct/unoptimized static serving.
- Header thumbnails plus the fallback hero image are preloaded from the root layout.
- Homepage category photography was re-encoded to 960x720 WebP for quicker transfer and first six are eager-loaded.
- Local fallback hero skips the Next image optimizer cold path while retaining `priority`.
- Existing backend/admin/CRO/session-replay functionality was not changed.
