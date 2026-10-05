# Premium navigation + dynamic pages update

- Homepage now shows one product grid only; the second Beauty product grid was removed.
- Public header navigation is limited to Shop, Blog, About Us and Contact.
- Category navigation remains available inside Shop instead of occupying the main navbar.
- Blog now uses the same database-backed Page system as About Us and Contact.
- Shop remains fully dynamic from Products and Categories APIs.
- Added Admin > Pages to edit Blog, About Us and Contact content without frontend code changes.
- Added backend page upsert endpoint so a missing Blog page can be created from Admin on existing databases.
- Added Blog to the seed data for fresh databases.
- All four public pages use the same premium typography, spacing, neutral palette and content-shell treatment.
