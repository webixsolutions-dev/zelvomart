# Zelvomart Build Specification — implementation status

This build keeps all existing storefront/backend functionality and adds the missing tracking, CRO, security and admin operations required by the supplied **Zelvomart Platform: Build Specification v1.0**. The visible **Admin Content/Pages** section is intentionally removed per the latest project instruction; the underlying Page model/public page APIs are retained so current dynamic public pages are not broken.

## Implemented in code

### Storefront, cart and checkout
- Dynamic home/shop/category/product/cart/checkout/confirmation/search/static pages.
- 30-day first-party cart cookie.
- Product gallery with zoom, lazy thumbnails/video and mobile swipe.
- Bundle pricing with server-side price-floor enforcement, including CSV imports and variant price overrides.
- COD checkout with server-side price/stock recalculation, idempotency, duplicate detection, blocklist handling, rate limiting and honeypot protection.
- Checkout session recovery and abandoned-checkout capture.
- Confirmation URLs now require an opaque per-order key before any private delivery details are returned; the public order number alone cannot fetch the confirmation payload.
- Admin-configured required checkout fields are enforced in both the browser and server, including order notes when enabled.
- Order tracking by order number + phone and PostEx tracking-link support.
- Real-review verification requires a delivered order number + matching checkout phone.

### Meta Pixel + Conversions API / attribution
- Pixel ID defaults to `1645715973642563` and remains configurable from Admin Settings.
- Browser events: PageView, ViewContent, Search, AddToCart, InitiateCheckout, Purchase and Contact.
- Every non-Purchase browser event is queued to CAPI with the exact same `event_id`.
- Purchase is queued server-side as soon as the order transaction commits; browser Purchase uses the order number as the same event ID and is guarded against refresh duplicates.
- SKU-based `content_ids` are used throughout product/cart/checkout/Purchase tracking.
- CAPI includes IP, user agent, `_fbp`, `_fbc`, source URL and SHA-256 customer match data when available.
- Staging test-event code support; production omits it.
- Known bot event suppression.
- EventLog stores browser and server events plus Meta responses/errors.
- Daily tracking-health job detects order/Purchase gaps, volume drops and Meta errors.
- Admin Tracking Health shows browser/server counts, Purchase coverage, deduplication coverage and recent errors.
- `/feeds/meta.xml` uses product/variant SKUs and `item_group_id`, with price, sale price, stock, images, links and product type.
- 30-day first/last-touch UTM + fbclid attribution saved on orders.

### CRO
- Microsoft Clarity loads early on public pages and receives page/product/category/source/device/experiment tags.
- Clarity funnel events include product view, bundle selection, add to cart, buy now, begin checkout, field errors, place-order tap, order placed and WhatsApp tap.
- Checkout/customer inputs are masked from replay.
- Checkout sessions are upgraded and placed orders are identified to Clarity by order number.
- Own EventLog funnel reporting and product conversion reporting.
- Abandoned checkout capture + one-follow-up admin workflow.
- A/B experiment admin with page pattern, traffic split, one running experiment per page pattern, persistent 30-day assignment, Clarity tag, order attribution and exposure/order-rate reporting.
- Privacy-masked rrweb session replay with admin player and retention cleanup.
- Order detail displays Clarity ID, own replay-session link and first/last-touch attribution.

### Admin and operations
- Admin authentication uses email/password with an 8-hour HttpOnly same-site session cookie; protected /admin routes redirect to /admin/login before rendering when no session is present. 2FA is intentionally removed per the current project requirement.
- Role-based API permissions plus role-filtered navigation (Owner, Manager, Order Agent, Marketer).
- Dashboard: orders/revenue, failed jobs, product/customer counts, Meta Purchase coverage and order-email coverage.
- Orders: search/status/city/source/date filters, bulk status updates, status timeline, duplicate/blocklist flags, CSV export, printable invoice + packing slip, manual PostEx tracking, WhatsApp confirmation and status emails.
- Products/categories/customers/users/settings/reports/CRO/tracking/jobs/abandoned/experiments/reviews/redirects/Meta attribution.
- Product price floor is enforced server-side when creating/editing products, variants and CSV imports.
- Notification recipients and HTML order-email templates are editable in Settings.
- Background jobs use pg-boss retry/backoff and durable Job rows; failures are logged and alerted.
- Rate limits are DB-backed and stale buckets are cleaned daily.
- Admin Content/Pages is removed from navigation and direct `/admin/pages` redirects to the dashboard; Page records/APIs remain for compatibility.

### SEO, performance and migration
- Dynamic metadata, canonical support, Product/Offer + Breadcrumb + Organization schema, sitemap and robots.
- Redirect database/admin and WordPress URL/migration scripts.
- Meta catalog feed.
- Next.js/CDN cache headers with revalidation after catalog/settings changes.
- WebP assets/Next Image behavior, hero/product preloading and lazy loading where appropriate.
- Backup/restore scripts, health endpoint and failure/job monitoring hooks.

## External deployment/sign-off still required

These cannot be truthfully completed inside a ZIP because they require the live accounts/infrastructure:

1. Set production/staging environment variables (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `REVALIDATION_SECRET`, `RESEND_API_KEY`, `META_CAPI_TOKEN`, storage keys, etc.).
2. Run `npm run db:push` (or the chosen migration process) and `npm run seed` where appropriate.
3. Run the worker process (`npm run worker`) continuously for email, Meta CAPI, health checks and recovery jobs.
4. Configure/verify the live Meta domain, Automatic Advanced Matching, CAPI token, optional Marketing API credentials and staging `META_TEST_EVENT_CODE`.
5. Configure the real Microsoft Clarity project ID.
6. Configure Resend/SES DNS (SPF, DKIM and DMARC) for `orders@zelvomart.com`.
7. Confirm PostEx merchant API endpoint/token contract before enabling P1 automatic booking/status/settlement operations; P0 manual tracking is implemented.
8. Configure production DB backups/PITR and external uptime/error monitoring.
9. Run the specification’s real-device, Facebook/Instagram in-app-browser, Meta Test Events, email-deliverability, redirect, Core Web Vitals and restore tests before DNS cutover.

## Build commands

```bash
npm install
npm run db:push
npm run build
npm run worker
```

For production, use separate staging and production databases/secrets. Do not place CAPI, database, email or storage secrets in frontend environment variables or in source control.
