# Zelvomart implementation and verification report

Prepared: 20 October 2026. Earlier reviewed commit: `e75d5de`.

Update: the later local launch-readiness implementation is documented in
[LAUNCH-READINESS-2026-10-20.md](LAUNCH-READINESS-2026-10-20.md). It supersedes the
unfinished 24-hour recovery mechanism and build status below: per-cart expiry is now
implemented, both builds passed, and 29 focused tests passed. Live work remains deferred.

## Dashboard design

The current implementation includes the redesigned Dashboard in
`frontend/components/admin/UnifiedDashboard.tsx`, `OverviewVisuals.tsx` and
`unified-dashboard.css`.

- Six primary metrics: orders, revenue, average order value, conversion, delivery/return performance and orders awaiting confirmation.
- White cards, subtle color accents, consistent SVG icons, clearer numbers, smaller descriptions and aligned comparison footers.
- Arrow indicators compare actual values with the previous period. New activity and unchanged values have explicit labels rather than invented percentages.
- Daily orders and revenue chart with separate labeled axes, accessible data-point titles and an empty state when there are no results.
- Clearer order pipeline, customer funnel, traffic sources, product performance, recovery, integration health and recommended-action panels.
- Independent panel skeletons and retry states, keyboard focus styles and reduced-motion support.
- Responsive CSS changes metrics from six to three to two columns, stacks panels on smaller screens and uses the shared responsive table styles.

The redesign changes presentation and preserves the existing Dashboard data requests and business actions. Browser verification on 20 October was blocked by the browser tool URL policy. Fresh desktop/mobile visual acceptance is therefore still required; responsive CSS is implemented but not newly browser-verified today.

## Shared administration UI

The earlier implementation provides reusable tables with column visibility controls, pagination defaulting to 10 rows, filtering/search, text wrapping/truncation and mobile layouts. Orders, Products and Customers use the shared administration patterns. Summary cards are informational; status tabs perform filtering. Dropdown, search-focus and pagination spacing improvements are included in the existing implementation.

## Orders, customers and recovery

- Order search and filters, native statuses, customer flags, private notes, customer history, tracking and bulk actions.
- Order editing recalculates totals on the server and uses transactions and concurrency checks for inventory changes. Cancellation and reopening use shared stock-transition logic.
- Customer details include order history, delivered/returned counts and abandoned-cart workflows.
- Recovery supports contact eligibility checks, conversion detection, unsubscribe suppression, restore links and agent-triggered follow-up.
- Coupon validation includes normalized codes, usage accounting, discount limits and expiry handling.

Important outstanding setting: the requested **one-day (24-hour) recovery offer expiry is not yet enforced as a separate per-cart offer expiry**. Current recovery uses the selected coupon's expiry. A default recovery coupon has not been selected; sending remains disabled by default. A shared coupon expiry must not be represented as a fresh 24-hour offer for every recipient.

## Session recording and playback

- Private replay storage, authenticated access and retry/fallback handling for recording chunks.
- Playback begins at the first recorded snapshot, with autoplay, fullscreen, viewport scaling, skeletons and partial-load recovery.
- Hidden tabs pause capture immediately. Visible sessions pause after two minutes without interaction and close after 30 minutes without interaction. Returning before closure takes a fresh snapshot; returning after closure starts a new session.
- Playback skips idle gaps over 10 seconds by default. Heartbeats and animation events do not count as meaningful activity for idle skipping.
- Recording uploads and live playback use a five-second cadence. Live status is based on recent activity within 60 seconds; it is an estimate, not an exact simultaneous visitor count.
- Exact storefront hosts include the Vercel deployment and future zelvomart.com/www hosts. Future-domain Cloudflare CORS settings were not confirmed saved; authenticated same-origin playback provides a fallback.
- Personal inputs are masked. Unrelated Google account email or login details are not harvested. Google sign-in and approximate IP geolocation are not implemented.

Older recordings cannot recover page content that was never captured. One hundred simultaneous visitors have not been load-tested.

## Errors and notifications

Central React Toastify notifications provide friendly messages for API/server errors, network failures, timeouts, permissions and rate limits. Duplicate notifications are suppressed, aborted requests remain silent and background tracking requests are excluded from disruptive toasts. A retry error boundary is present. This improves shared error paths; it is not proof that every possible runtime failure has been exercised.

## Backend and rollout

The earlier brief work includes independent Dashboard APIs, checkout/delivery policy alignment, coupon and order-note storage, recovery protections and tracking/job health improvements. The configured database received additive SQL without a reset. The database migration baseline still needs deliberate resolution before using general migration deployment commands.

Worker deployment files are prepared, but installation on the existing always-on server remains outstanding. Actual external email/ad delivery has not been verified. Production deployment of the latest frontend/backend changes must be confirmed separately; a local commit does not establish that production is updated.

PostEx automatic booking and automated cart follow-ups remain later work. Existing manual tracking and agent-triggered recovery are implemented.

## Verification

On 20 October 2026:

- Frontend: `npx tsc --noEmit --incremental false` — passed.
- Backend: `npx tsc --noEmit` — passed.
- Focused tests: `npx tsx --test scripts/admin-brief.test.ts scripts/tracking-regression.test.ts scripts/app-errors.test.ts` — 21 passed, zero failed.
- No full production build was run, respecting the request to avoid repeated builds.
- No external messages were sent and no live load test was run.

Previously recorded on 18 October: isolated live API checks passed Dashboard endpoints, coupon validation, checkout without email/postcode, order edits and stock rollback, private notes, cancellation/reopening, customer history, filters, city validation and converted-cart recovery restrictions. Test fixtures were removed. Those live API checks were not rerun on 20 October and should not be read as current production acceptance.

## Remaining completion checks

1. Browser acceptance of the redesigned Dashboard on desktop and mobile.
2. Confirm production frontend/backend deployment.
3. Configure and start the always-on worker; verify actual delivery with authorized test recipients/accounts.
4. Select the recovery coupon and implement/enforce the requested per-offer 24-hour expiry before enabling that offer.
5. Confirm future-domain deployment/CORS when switching domains.
6. Run a realistic concurrency test before promising support for 100 simultaneous recording visitors.

See `ADMIN-BRIEF-ROLLOUT.md` and `TRACKING-REPLAY-ROLLOUT.md` for the earlier technical handover.
