# Launch readiness: local code handover

The user explicitly deferred live deployment, server setup and domain changes on
20 October 2026. Nothing in this document should be read as proof of live acceptance.
Work is on `codex/launch-readiness`; it has not been pushed or deployed.

## Implemented in code

### Storefront design integration

Imported the owned `webixsolutions-dev/zelvo-mart` design at commit `736ca3d` into
isolated `components/launch`, `lib/launch` and `public/launch` directories.
The new home, header/footer, category and collection listings, search, wishlist,
About, Contact, FAQ and policy presentation use the design's components/artwork.
Styles are scoped to the storefront, excluding admin and legacy transactional components.

Product detail, cart, checkout, authenticated account and order tracking retain
the existing working backend components inside the new storefront shell. They were
not replaced with the design repo's mock cart or browser-only order storage.
Exact visual parity of those retained transactional screens with the separate
design remains a visual acceptance item, not a completed claim.

Products and category pages render backend data on the server. Search, category,
price, availability, sorting and pagination use backend requests. There is no new
sample catalog, and the old product fallback no longer invents products when the API
fails. Unavailable catalog requests show an explicit state. Bestseller eligibility
requires a real non-staff, non-test, non-cancelled/non-returned order rather than a
featured label. Ranking counts distinct eligible orders, and price sorting/filtering uses
the effective selling price in SQL, before pagination. New arrivals use product creation
dates; Woo imports preserve dates.

The existing bundle, stock, coupon, abandoned-cart restore, variant-SKU deep-link,
review and order APIs are retained. Wishlist uses saved IDs/slugs and revalidates
availability against the backend, rather than persisting fabricated orders.

### Tracking and Google

- GA4 `G-9SJCXNENVE` is wired into the storefront, overridable by `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- Manual route pageviews exclude staff/opted-out devices, admin and account screens. Confirmation identifiers and query strings are removed from Google page URLs.
- Set `GOOGLE_SITE_VERIFICATION` to the existing verification tag content when available; no tag was fabricated.
- Existing Meta/TikTok browser/server tracking, SKU contents and event-ID deduplication remain intact.
- Search and WhatsApp Contact tracking cover the new pages, without double-counting the existing floating button.
- Restore tokens, coupon codes, typed searches and personal query values are removed from recording/source URLs. Suspicious email/phone search terms are redacted from Search events.
- Privacy content describes analytics, advertising matching and masked replay retention; a device exclusion control is available.

Google setup requirement for later: turn OFF enhanced automatic pageview/history
measurement in the GA4 web stream because this implementation sends manual SPA
pageviews. `send_page_view: false` alone does not disable stream-level history events,
as described in [Google’s pageview documentation](https://developers.google.com/analytics/devguides/collection/ga4/views).
Realtime/Events Manager verification was not performed and no ad test events were sent.

Public settings endpoint security was also fixed: an explicit allowlist prevents
requests for private tokens, worker state or recovery templates. Local HTTP verification
confirmed private-only requests return an empty object. This fix is local until deployed.

### SEO and checkout

- Non-production hosts receive `X-Robots-Tag: noindex`; zelvomart.com/www are the production exceptions.
- One-hop 301 mapping covers the brief's old platform URLs and category paths while preserving product slugs.
- Automatic slash redirects are disabled so WooCommerce URLs do not gain an extra 308 hop.
- Sitemap entries use real backend records and their update dates; redirected fixed routes are replaced by new destinations.
- `/llms.txt`, ticker, trust strip, FAQ and shipping-policy fees use the shared delivery settings; client delivery settings refresh every 45 seconds/focus.
- The required checkout terms checkbox and backend rejection are removed. A linked terms notice remains. No-email/no-postcode checkout remains supported.
- Embedded product/organization JSON-LD escapes `<` to avoid executable markup.

### WooCommerce import safety

`backend/scripts/migrate-wordpress.ts` now defaults to preview. Real import requires
`--apply` and a read-only WooCommerce API key. Authentication uses an HTTPS Basic
header instead of keys in logged URLs. Requests time out and reject cross-origin
API redirects. Import preserves slugs, images, SEO fields, creation dates and stock
tracking/status; it does not synthesize 9,999 units. Images must be copied to configured
storage before WordPress is retired.

Product/variation writes run transactionally after network downloads. Variant IDs are
preserved by SKU instead of deleting all variants. Missing variations are deactivated.
Review re-import compares the same normalized text it stores. Source regular prices
and variation attributes are retained in catalog metadata.

Unsupported grouped/external products and variations sharing one tracked parent
inventory pool stop with a clear error; they require an explicit data mapping rather
than silently creating inaccurate stock. No real import, product deletion or image
backfill was executed because the user deferred live work and Woo credentials are absent.

### Worker and recovery protections

- Backlog preview: `npx tsx scripts/review-worker-backlog.ts` from backend.
- `--apply` marks queued/failed jobs older than seven days SKIPPED; it does not send them.
- Worker delivery also skips expired/already-handled job rows and claims work atomically.
- Worker startup rejects transaction-pooler port 6543 and requires `WORKER_BACKLOG_REVIEWED=true` after review.
- No worker was started and no backlog was changed.
- Recovery offers now create stable per-cart single-use codes expiring 24 hours after the first draft, or at the selected parent coupon's earlier expiry. Repeated drafts do not extend expiry. Checkout enforces expiry and reuse rejection under its existing coupon lock.
- Default coupon stays blank and offers stay disabled. No external messages were sent.
- No schema change was needed. DATABASE-MIGRATIONS.md records the additive-only policy until a real baseline is verified.

## Verification recorded

- Frontend production build passed after correcting a stale metadata re-export.
- Backend production build passed after correcting duplicate serializer keys.
- Separate worker/import/backlog TypeScript compilation passed.
- All 29 focused regression tests passed. The suite includes launch routing, privacy, stock, recovery expiry,
  checkout, replay lifecycle and platform payload checks.
- Local HTTP: real product HTML contains its name, price and schema. Explicit Host-header checks confirm no noindex header for zelvomart.com/www and noindex for the Vercel preview. Home answers 200 with H1 and noindex; `/shop/`, `/faq/`, category and terms legacy paths return direct 301s. Checkout/FAQ/llms endpoints answer 200.
- 44 literal design image references were checked: no missing files.
- Read-only local API checks passed ascending/descending effective-price sorting, combined price/stock filters, bestseller eligibility and malformed pagination defaults.
- Browser visual acceptance and mobile/network performance measurement were not completed because browser automation was blocked by the tool URL policy. No 100-user load test was performed.

An empty cart renders checkout's loading/empty state, so the HTTP checkout check is
not a completed purchase or a filled-form browser test. No real order was placed.

## What is still needed later

1. A read-only WooCommerce key for the real import. In WordPress: WooCommerce > Settings > Advanced > REST API > Add key > Read. Save `WC_CONSUMER_KEY` and `WC_CONSUMER_SECRET` in backend/.env, never in chat. Then run the preview, resolve unsupported source data, review, and import with `--apply`.
2. Review exact sample SKUs before deleting/deactivating them, then run catalog image backfill first without and then with `--apply`.
3. Confirm visual acceptance of retained transactional screens and desktop/mobile layouts; measure the under-2-MB mobile target rather than assuming it.
4. Set Meta/TikTok tokens and test codes in Admin Settings. Reuse Meta pixel 1645715973642563 and the existing GA4 property. Test actual browser/server deduplication with authorized test devices later.
5. Worker host access, a session/direct database connection, backlog review, Resend verification and actual email delivery checks.
6. Vercel replay environment, saved Cloudflare CORS, ten-minute phone/live playback timing and live deployment verification.
7. Choose the recovery discount before enabling offers. The 24-hour mechanism is implemented; the offer remains disabled.
8. Export real WordPress URLs, test them using `check-launch-urls.ts`, and resolve any blog/page-specific mappings not inferable from the brief.
9. Google verification value, Search Console/Bing access, catalog imports, DNS backup/TTL and the planned WordPress switchover/rollback. These are deferred, not completed.

## Useful local commands

From backend:

```powershell
npx tsx scripts/migrate-wordpress.ts
npx tsx scripts/migrate-wordpress.ts --apply
npx tsx scripts/backfill-catalog-images.ts
npx tsx scripts/review-worker-backlog.ts
npx tsx scripts/migration/export-wordpress-urls.ts
npx tsx scripts/check-launch-urls.ts --input=migration/wordpress-urls.json
```

Import/apply/backfill actions are for the later reviewed data stage. They were not run
against the live catalog during this task. The URL checker permits a direct 200 or
one same-origin 301 ending at 200 and writes a JSON report without changing data.
