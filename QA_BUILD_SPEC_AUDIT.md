# Zelvomart Build Specification — code audit

Audited against the supplied Build Specification v1.0 on 4 October 2026.

## Launch-critical code covered

- Storefront, catalog, product, cart, checkout, confirmation, search and tracking routes.
- COD order transaction with server-side price/stock validation, idempotency, duplicate/blocklist protection and stock restore paths.
- Team/customer order email jobs, status emails, daily summary and background-job failure alerts.
- Meta Pixel + server Conversions API pipeline with shared event IDs, server-side Purchase, SKU IDs, attribution cookies, EventLog and tracking-health reporting.
- Meta catalog XML feed and source/UTM/fbclid capture.
- Microsoft Clarity tags/events/identify/upgrade/masking, own EventLog funnel reporting, abandoned checkout, experiments and privacy-masked rrweb replay.
- Admin dashboard, orders, products, categories, customers, users/roles/session authentication, settings, reports, Meta attribution, CRO, tracking health, jobs, abandoned checkouts, experiments, reviews and SEO redirects.
- Admin Content/Pages UI removed by project instruction; Page records/APIs remain so existing public dynamic pages keep working.
- SEO metadata/schema/sitemap/robots/redirect/migration support, caching, image optimization, server validation, rate limits and health checks.
- Confirmation-page private address data requires the opaque order key; an order number alone is insufficient.

## Validation performed in this workspace

- TypeScript/TSX source syntax/transpile sweep: PASS (137 source files; declaration files intentionally excluded from emit checks).
- Admin Content/Pages navigation audit: PASS (no visible Content/Pages nav entry; direct route redirects to Admin dashboard).
- ZIP integrity test: performed on the delivered archive.

## Deployment-only sign-off still required

Live Meta, Clarity, Resend/SES, PostEx, database backup/PITR and hosting credentials are intentionally not embedded in source code. Production readiness still requires the real-account and real-device tests listed in `BUILD_SPEC_COMPLETION.md` and in the supplied specification, including Meta Test Events/deduplication, email deliverability, CWV, restore testing and Facebook/Instagram in-app-browser QA.
