# Zelvomart Build Specification Verification

Verified against **Zelvomart Platform: Build Specification v1.0 (30 September 2026)**.

Legend: **PASS** = implemented in code, **PARTIAL** = implemented but needs a remaining code/design item, **EXTERNAL QA** = code exists but requires real services/devices/production verification, **P1/P2** = later phase, **DEVIATION** = intentionally differs from the document by user instruction.

## Immediate UI correction

- **PASS** Admin routes (`/admin` and `/admin/*`) now render without the public storefront header, footer, floating WhatsApp, cart drawer, Meta Pixel, Clarity or storefront tracking provider.
- **PASS** Admin keeps only its own Camz-style sidebar/top management bar.

## 1–3. Goals, principles and architecture

- **PASS** Next.js App Router + TypeScript storefront/API route handlers.
- **PASS** PostgreSQL + Prisma data model for products, variants, orders, customers, events, jobs, pages, settings, users, reviews, experiments, abandoned checkouts, cities and redirects.
- **PASS** pg-boss background jobs with retries/backoff.
- **PASS** Job recovery now re-dispatches stranded queued application jobs that never received a pg-boss external ID.
- **PASS** R2/S3-compatible storage helper and image upload endpoint exist.
- **PASS** Resend transactional-email integration exists.
- **PASS** Auth.js email/password admin login with server-enforced roles/permissions.
- **DEVIATION** The document requires 2FA for admin users; authenticator/OTP was intentionally removed per current user instruction.
- **PARTIAL / DEPLOYMENT** Separate dev/staging/production secrets are supported by environment variables, but actual staging/prod infrastructure is deployment work.
- **MISSING / DEPLOYMENT** Sentry and external uptime monitor are not fully wired/configured in code.

## 4. Storefront

- **PARTIAL ST-01** Public header/footer, search, cart count, contact and policy links exist. Footer social links/WhatsApp Channel configuration is not fully implemented.
- **PASS ST-02** Announcement/ticker content is editable in admin settings.
- **PASS ST-03** New homepage, hero, category visuals, Popular Collections lazy video section, Beauty & Personal Care section.
- **PASS ST-04** Shop/category product grids, image/name/price/sale price/discount badge, newest and price sorting. Real-review rating now appears on product cards when reviews exist.
- **PASS ST-05** Product/category search and WhatsApp help on empty results.
- **PASS ST-06** DB-backed editable static pages with SEO fields.
- **PASS ST-07** Floating WhatsApp on public pages; product page uses product-prefilled WhatsApp message.
- **PASS ST-08 (P1 already present)** Order number + phone tracking page with PostEx link when available.
- **PASS ST-09** Friendly 404 with search and categories.

## 4.2 Product page

- **PARTIAL PDP-01** One dynamic product template exists with the required functionality; pixel-perfect parity with the live legacy product page still needs final visual comparison/sign-off.
- **PARTIAL PDP-02** Multi-image gallery, zoom, lazy secondary images and tap-to-load video exist. Touch swipe behavior should be device-QA verified.
- **PASS PDP-03** Sale/regular price plus Free Delivery and Cash on Delivery messaging.
- **PASS PDP-04** Buy-1 / Buy-2 bundle, default 5% setting, per-product override, instant price and savings.
- **PARTIAL PDP-05** Variants/out-of-stock enforcement exists; option buttons are functional, but visual color swatches depend on imported variant attributes/design.
- **PASS PDP-06** Add to Cart opens cart drawer with View Cart, Checkout and Continue Shopping.
- **PASS PDP-07** Buy Now/Order Now proceeds to checkout.
- **PASS PDP-08** Mobile sticky add-to-cart bar.
- **PASS PDP-09** Product-prefilled WhatsApp enquiry.
- **PASS PDP-10 (P1 present)** Real reviews model/admin and structured-data rating when reviews exist.
- **PASS PDP-11** Rs 1,000 selling-price floor enforced in admin and again on server order creation, including bundle per-piece price.

## 5. Cart, checkout and COD

- **PASS CK-01** Cart drawer/page with item editing, removal, subtotal and bundle savings; checkout calculates delivery and total.
- **PASS CK-02** Cart stored in a first-party 30-day cookie.
- **PASS CK-03** One-page guest checkout; no customer account requirement.
- **PASS CK-04** Email/postcode/terms required flags configurable in admin.
- **PASS CK-05** Pakistani mobile validation and normalization to +923XXXXXXXXX on server.
- **PASS CK-06** Searchable city list with free-text fallback; admin now manages active cities and per-city delivery min/max estimates.
- **PASS CK-07** COD launch method; NayaPay setting scaffolded for later integration.
- **PASS CK-08** Free/flat/free-above delivery rules and optional COD fee.
- **PASS CK-09** Summary includes items, bundle saving, delivery, fees, total and COD message.
- **PASS CK-10** Submit is disabled while pending and order creation is idempotent by UUID.
- **PASS CK-11** Checkout form values persist in sessionStorage on refresh within the session.
- **EXTERNAL QA CK-12** In-app browsers/slow 3G must be tested on real devices.
- **PASS CK-13** Same phone + same item signature in 24 hours flagged possible duplicate while still saved.
- **PASS CK-14** Customer blocklist; blocklisted orders are saved ON_HOLD.
- **PASS CK-15** Honeypot and persistent DB rate limits by IP/phone; no visible captcha.
- **PASS CK-16** Confirmation shows order number, total, address/city, next steps and city delivery estimate.
- **PASS CK-17** Confirmation reload uses saved order; browser Purchase has one-time local flag and API deduplication.
- **PASS** Required order statuses and status history model exist; cancellation/return restores stock.

## 6. Order pipeline and notifications

- **PASS** Server re-reads products, prices, variants and stock; browser totals are not trusted.
- **PASS** Order, stock reduction, items, status history and follow-up Job rows are written in a Prisma DB transaction.
- **PASS** Team and customer order emails are queued.
- **PASS** Meta Purchase is queued at order creation and does not depend on thank-you page load.
- **PASS** pg-boss retries/backoff plus Job status/error logging.
- **PASS** Recovery schedule retries queued app jobs that failed before being handed to pg-boss.
- **PASS** Daily 9 AM Pakistan summary code with orders, revenue, funnel, source, top products and tracking health.
- **PASS** Failure email alerts exist.
- **PARTIAL** WhatsApp-group failure alert is not automated; manual WhatsApp operations exist.
- **EXTERNAL** SPF/DKIM/DMARC and real mailbox delivery require DNS/email-service setup.
- **PASS WA-01** Confirm-on-WhatsApp action on each order.
- **P2 WA-02** Automatic WhatsApp Cloud API messaging not implemented, as planned for P2.

## 7. Meta Pixel + Conversions API

- **PASS** Event matrix supported: PageView, ViewContent, Search, AddToCart, InitiateCheckout, Purchase, Contact.
- **PASS TR-01** Browser/server use the same event ID; Purchase uses order number.
- **PASS TR-02** Server Purchase is generated by background order job.
- **PASS TR-03** Browser Purchase fires once per order via local one-time flag; API also deduplicates.
- **PASS TR-04** SKUs are used for content IDs and Meta feed IDs.
- **PASS TR-05** PKR and server order total used for Purchase value.
- **PASS TR-06** Server sends IP, UA, fbp/fbc and hashed customer matching fields.
- **PASS TR-07** fbclid creates first-party _fbc when needed; first/last touch stored 30 days.
- **PASS TR-08/09** Pixel loads early; route-change PageView guarded from duplicate rerenders.
- **PASS TR-10** `/api/events` stores browser events and forwards non-Purchase events to CAPI; Meta response is stored server-side.
- **PASS TR-11/12/13/14** Test/staff Purchase guards, bot ignore, server-only token, staging test-event code.
- **EXTERNAL TR-15** Automatic advanced matching/domain verification must be confirmed in Meta Business settings.
- **PASS TR-17** `/feeds/meta.xml` feed exists with SKU, price, sale, availability, links and images.
- **PASS TR-18** UTM/fbclid first/last-touch source capture.
- **PASS TR-19/20/21** Daily tracking health checks, volume/error alerts and admin tracking-health screen.
- **EXTERNAL QA 7.6** Meta Test Events/deduplication/in-app browser sign-off cannot be certified by source inspection and must be run before launch.

## 8. CRO

- **PASS CRO-01** Clarity ID configurable in admin and script loaded early on public storefront routes.
- **PASS CRO-02** page_type, product SKU/category, UTM, paid_meta and device tags are set.
- **PASS CRO-03** Required funnel events are emitted.
- **PASS CRO-04** Order number identifies the Clarity session; Clarity ID stored on order/admin view.
- **PASS CRO-05** Checkout upgrades session recording.
- **PASS CRO-06** Customer input fields are Clarity-masked.
- **PASS CRO-07** Storefront events are persisted in EventLog.
- **P1 PRESENT/PARTIAL CRO-08/09** Reports page includes funnel and product performance; deeper campaign/ad/device breakdown can be expanded.
- **P1 PASS CRO-10** Abandoned checkout storage and one manual WhatsApp follow-up workflow exists.
- **P1 PARTIAL CRO-11–14** Experiment admin CRUD/status/one-per-page guard exists; persistent visitor assignment, SSR variant rendering and statistical reporting still need completion.
- **P2** rrweb recorder intentionally not implemented.

## 9. Admin

- **PASS** Camz-style clean dashboard without storefront header/footer.
- **PASS** Dashboard: today/yesterday orders/revenue, tracking health, failed jobs and today funnel.
- **PASS** Orders: status/date/city/source filters, detail/timeline/notes, duplicate/blocklist flags, Clarity ID, print, bulk status, CSV export.
- **PASS** Products: create/edit, variants, images/video URLs, SKU, price/sale/cost, stock, bundle, SEO, draft/publish, price floor.
- **PASS** Categories: create/edit/order/image/SEO.
- **PASS** Customers: phone-keyed order totals, refusal count and blocklist.
- **PASS** Content: DB-backed static pages; homepage/announcement managed through Settings.
- **PASS** Settings: store info, delivery, checkout flags, payment config, cities/delivery estimates, email recipients/templates, Pixel, Clarity, WhatsApp.
- **PASS** Roles: Owner, Manager, Order Agent, Marketer with server-side permissions.
- **DEVIATION** 2FA intentionally removed at user request although specification requires it.
- **P1** Reports/reviews/experiments/abandoned modules are already present, with noted experiment-reporting limitations.
- **P2** Operations/P&L portal not implemented.

## 10. PostEx

- **PASS PX-01** Manual PostEx tracking number on order; customer tracking URL generated.
- **P1 MISSING** Merchant API booking/bulk labels.
- **P1 MISSING** Automated status sync.
- **P1 MISSING** Settlement import/unpaid COD report.
- **P1 MISSING** PostEx city sync (manual admin city list exists for P0).

## 11. SEO, content and migration

- **PASS SEO-01** WordPress sitemap URL-export script and Redirect model/admin exist; same legacy product/category route shapes are present.
- **EXTERNAL QA SEO-01** Full old-URL → new-URL/301 comparison must be run with the production sitemap before cutover.
- **PASS SEO-02** SEO title/description/canonical fields supported and migration script includes SEO extraction.
- **PASS SEO-03** Product Offer, BreadcrumbList and Organization structured data; aggregate rating only when reviews exist.
- **PASS SEO-04** sitemap and robots route generation.
- **PASS SEO-05** Product Open Graph metadata includes title/description/image.
- **PASS MG-01** Product/category/variant/image/page/SEO migration tooling exists; image re-hosting supported when configured.
- **P1 MG-02** Past order/customer migration is implemented behind `MIGRATE_PAST_ORDERS=true` but remains a P1 migration run.
- **EXTERNAL MG-03** Meta ad destination URLs must be reviewed/updated manually if any URL changes.

## 12. Performance, security and reliability

- **EXTERNAL QA PF-01** CWV targets require Lighthouse/real-device measurements; not certifiable from source alone.
- **PASS/PARTIAL PF-02** Product/category pages use Next revalidation caching. Explicit on-demand invalidation exists for admin edits in several flows; final production cache behavior should be tested.
- **PARTIAL PF-03** Next/Image is used for product imagery and lazy behavior; R2/Next image path exists. Hero uses a CSS background and full WebP/AVIF optimization depends on final uploaded assets/config.
- **PASS PF-04** Only Meta/Clarity third-party tracking scripts; collection videos load only on tap.
- **PARTIAL SC-01** Admin login and roles are enforced; HTTPS is hosting-level. 2FA intentionally removed by user instruction.
- **PASS SC-02** Server validation and server-side price/total recomputation.
- **PASS SC-03** DB-backed rate limits on checkout/search/login.
- **PASS SC-04** Service secrets are environment-variable based.
- **EXTERNAL SC-05** Supabase/managed-Postgres backup retention and restore drill must be configured and tested outside app code.
- **MISSING/DEPLOYMENT SC-06** Sentry + external uptime alert integration still needs deployment configuration.

## 13–16. Customer view, QA and launch

- **PASS CODE PATHS** Mobile-first product → cart → one-page COD checkout → confirmation → tracking/WhatsApp path exists.
- **EXTERNAL QA** Low/mid Android, iPhone, Facebook/Instagram in-app browsers, Chrome, Samsung Internet, Safari, 4G and slow 3G must still be physically tested.
- **EXTERNAL QA** Gmail/Outlook one-minute email delivery, Meta sign-off, Clarity recordings/masking, complete redirect map and role matrix must be tested on staging.
- **EXTERNAL GO-LIVE** Real production test order, CWV sign-off, backup restore, Haroon staging approval, cutover window, DNS rollback and 48-hour monitoring are operational launch tasks.

## Current launch blockers from the document

1. Complete staging device/browser QA and Section 7.6 Meta sign-off.
2. Configure production email DNS (SPF/DKIM/DMARC) and verify inbox delivery.
3. Configure/test managed DB backups + restore.
4. Add/configure Sentry and uptime monitoring.
5. Export current WordPress URLs and run redirect comparison before cutover.
6. Measure Core Web Vitals on home/category/product/checkout and optimize until targets pass.
7. Resolve the intentional security decision: specification requires 2FA, but current user instruction explicitly removes authenticator/2FA.
