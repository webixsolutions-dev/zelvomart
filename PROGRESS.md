# Progress

## Dashboard health-card removal (23 October 2026)

- Removed the System health card and its dedicated admin endpoint/service/tests at the owner's request. Successful email sends no longer write a health-only database marker.
- Kept `/api/health` for deployment checks and the separate Tracking Health page and worker heartbeat used by tracking operations.
- Removed two unreferenced historical Markdown reports: `deployment/WORK-REPORT-2026-10-20.md` (explicitly superseded by the launch-readiness report) and `deployment/storefront-move/DELETED-FILES.md` (a stale deleted-file inventory).

## Live database cleanup check (23 October 2026)

- Read-only Supabase check: database is 16 MB; `SessionReplay` and `SessionReplayChunk` are already empty. No replay purge was needed in this pass.
- The 8 unused CMS `Page` rows were exported to the ignored local recovery file `tmp-pages-backup-2026-10-23/pages.json`, deleted as requested by the handover cleanup, and verified at 0 rows.
- Read-only security check: no grants to `anon`/`authenticated` on public tables and all public tables have RLS enabled. The separate Supabase Data API exposed-schemas setting was not inspected.
- The queue currently contains 1,185 `QUEUED` jobs and no worker heartbeat is recorded. Do not start the worker until the backlog and email side effects have been reviewed.

Work from the 21 October 2026 audit, done in batches, one branch each. Finding IDs (C1, H5, …) refer to the
audit report kept outside this repository.

## Batch 1: security (branch `fix/security-batch-1`)

| Item | Status | Notes |
|---|---|---|
| C1: lock the public schema (SQL + rollback) | Done (files only) | `backend/prisma/sql/`. Not run on any Supabase project: a person runs it, steps in the README there. |
| H5: admin 2FA, session checks, token lifetime, seed, env names | Done | Two-step login (password, then authenticator code), required for OWNER and MANAGER, set up at first sign-in with a QR code. Optional for other roles under Admin → Security. Owners can reset a user's 2FA in Users & Roles. `requireAuth` re-reads active, role and 2FA from the database (60 s cache, cleared on change). Tokens last 2 h; the admin proxy refreshes them while the admin works. Seed no longer touches admin accounts; the first owner is created with `npm run admin:create`. |
| K5: database TLS verification | Done | `backend/src/lib/db-ssl.ts`: every Postgres connection (Prisma, pg-boss, scripts) verifies the server against Supabase's root CA (embedded, valid to 2031). `sslmode` in the URL can no longer switch it off. `DATABASE_CA_CERT` replaces the CA; `DATABASE_SSL_VERIFY=false` is an emergency switch only. Tested against a local TLS Postgres: a wrong CA is refused, the right CA connects. |
| Zod validation on admin product, category, page and redirect writes | Done | `backend/src/lib/admin-validators.ts`: type, length and format checks (slugs, links never `javascript:`, prices ≥ 0, sale price below the regular price, variants). It validates only; the routes keep the original body, so a PATCH still touches only the fields it sent. A real save from Admin → Products passes. Errors come back as `{ error, issues[] }`. |

### Left for a person (not code)
- Products saved with a sale price at or above the regular price (e.g. the "lipstic" test item) now need that fixed before they can be saved again.
- Delete `ADMIN_EMAIL` and `ADMIN_PASSWORD` from both Vercel projects (no code reads them now).
- Change the owner password if it was ever the published default.
- Deploy to a preview first and confirm the backend reaches the database (`/api/health`). If it fails with a certificate error, set `DATABASE_SSL_VERIFY=false` on that environment and report the error text.
- Run `01-lock-public-schema.sql`, staging first.
- Remove `public` from the Supabase Data API exposed schemas.

### Batch 1 status
All four items are done in code. Tests: every backend test passes (9 files, including the new `auth.test.ts` and `admin-validators.test.ts`); backend `tsc` and `next build` pass.

## Batch 1-B: optional 2FA and password change (branch `fix/auth-options`)

| Item | Status | Notes |
|---|---|---|
| 2FA optional for every role | Done | No role is forced to set up 2FA at sign-in; `requireAuth` no longer answers `TWO_FACTOR_REQUIRED`. Accounts that turned 2FA on are still asked for a code. |
| Turn off 2FA (Admin → Security) | Done | Asks for the current password. Clears the secret; audit `disable_2fa`. Wrong password → 401 `WRONG_PASSWORD` (does not sign the admin out). |
| Change password (Admin → Security) | Done | Current, new, confirm. New password at least 10 characters. 5 tries per 15 minutes. Audit `change_password`. Every other session of the account ends; this one stays signed in. |
| Reset password (Admin → Users & Roles) | Done | Owners (users.write) set a new password for a team member; all of that member's sessions end. Audit `reset_password`. Minimum for new users is also 10 characters now. |

How "end other sessions" works without a database change: every admin token carries a short fingerprint of the
stored password hash, and `requireAuth` compares it with the current one. A new password means a new fingerprint,
so older tokens stop working within a minute on every server (at once on the one that made the change).

Tested locally (API and browser): sign-in without a code when 2FA is off; wrong current password shows a message
and keeps the admin signed in; after a change the same tab stays signed in, a second browser is sent to the login
page, the old password is refused and the new one works; the 6th try in 15 minutes gets 429; 2FA on → sign-in asks
for a code → turned off with the password → sign-in without a code; reset password signs the member out and the
new password works. Backend tests (13) and `next build` pass.

### Left for a person (not code)
- After deploy, every admin signs in once more (tokens issued before this change do not carry the fingerprint).


## Batch 2: recordings to R2, Pages removed, backend timeouts (branch `fix/data-loss-batch-2`)

| Item | Status | Notes |
|---|---|---|
| C4: recordings only in the private R2 bucket | Done | No Postgres fallback. Without `REPLAY_S3_BUCKET` (plus `S3_ENDPOINT` and the S3 keys) nothing is recorded: the storefront does not load the recorder, the replay endpoints answer 503 `REPLAY_STORAGE_NOT_CONFIGURED` before any database write, and Admin → Session Replays and Admin → Tracking show a warning. Postgres keeps metadata only (storage key, counts, size, timestamps). No sampling: every visitor is recorded. |
| C4: purge SQL | Done (file only) | `backend/prisma/sql/02-purge-old-replays.sql`: deletes every recording, clears order links, `VACUUM FULL`. Tested on a copy of the local database. |
| C4: R2 lifecycle | Done (file only) | `deployment/replay-lifecycle.json`: `replays/` objects expire after 30 days. Retention setting default 30, maximum 30. Steps in `deployment/TRACKING-REPLAY-ROLLOUT.md`. The old `migrate-replay-storage.ts` is removed (old data is not kept). |
| Admin → Pages removed | Done | Sidebar link, pages and `/api/admin/pages` GET/POST/PATCH removed. `/api/pages/:slug` and `loadPolicy()` unchanged: policy text changes only in code. CMS pages left the sitemap, and the seeds and WordPress import no longer write the Page table. `backend/prisma/sql/03-drop-cms-pages.sql` deletes every Page row (file only, tested on a copy). |
| Catch-all `[...slug]` | Done, kept as a 404 route | It no longer renders any CMS page, so old slugs answer 404. It stays only to show the store's own 404 (header and footer) and to apply an Admin redirect the proxy map has not loaded yet (up to 2 minutes). Deleting the file would give Next.js's plain built-in 404 page, because the store and the admin each have their own root layout. |
| H3: backend fetch timeout | Done | `apiFetch()`: 5 s per attempt, one retry for timeouts, dropped connections and 5xx (never for 4xx). If both fail it serves the last good answer for that path (and logs it); with none it throws and the page shows its own empty or error state. `DEFAULT_CATEGORIES` and `lib/dummy-content.ts` removed. If the store layout gets no settings at all it loads no pixels or recorder. Tested against a fake backend: slow, flaky, 500 and 404 cases. |

### Left for a person (not code)
- Set `REPLAY_S3_BUCKET` on the backend (Vercel) and check the R2 token can write to that bucket; until then nothing is recorded.
- Add the 30-day lifecycle rule on the R2 bucket (Cloudflare → R2 → bucket → Settings → Object lifecycle rules).
- After deploying this release: run `02-purge-old-replays.sql`, then `03-drop-cms-pages.sql` (steps in `backend/prisma/sql/README.md`).
- Admin → Settings: set the recording retention to 30 days or less if it was saved higher.

### Batch 2 status
All items done in code. Backend tests (13), backend `tsc` and `next build` pass. Store pages return 200 and old slugs 404 with the store design; with the backend stopped, cached pages keep showing their products.

## Batch 3: images, speed and SEO (branch `fix/perf-seo-batch-3`)

| Item | Status | Notes |
|---|---|---|
| WebP on upload | Done | `toSiteWebp()` (backend `lib/catalog-images.ts`): JPG, PNG, AVIF and oversized WebP become WebP, at most 1600 px wide, quality 82, metadata removed; a WebP that already fits is kept unchanged, GIFs and videos pass through. Used by `POST /api/admin/upload` (also the bulk image ZIP) and every review photo (customer form, CSV/ZIP import). The JPG feed copy is still made from the original; feeds always use it for WebP images. Tests in `catalog-images.test.ts`. |
| K6: 35 MB PNG folder | Done | `public/images/Zelvomart images/` → `public/images/zelvomart/`: 21 files, WebP, each under 150 KB, 35 MB → 1.6 MB, names without spaces or &. Note: nothing on the live store shows these files (only `lib/store-images.ts` and `lib/product-media.ts` point at them, and that code is unused); left for the Batch 4 clean-up. |
| M1: JavaScript | Done | Meta and TikTok pixels `lazyOnload`; GA4's gtag.js after load + idle (events queue until then). Browser pixel events wait up to ~25 s for the pixel. Cart drawer is its own chunk, mounted when the browser is idle (or at once when the cart opens). Product reviews list via `next/dynamic`. browserslist pinned to the modern set. |
| M2: hero and CSS | Done | Hero art through `next/image` (`getImageProps`, desktop/phone art direction, AVIF/WebP at displayed width). Only the first slide (fetchPriority high) is in the first HTML; slides 2–3 mount on first interaction or after 3 s. Desktop: 2 hero images before interaction → 1. `globals.css`: 424 rules that match nothing removed (209 KB → 166 KB); `Footer.module.css` merged in: 3 stylesheets → 2 (the other is next/font's @font-face). Pixel diff against the previous build on 14 pages at 1440 and 390 px: identical except the re-encoded hero image. |
| M3: titles and canonicals | Done | No second "| Zelvomart" on product titles (admin hint added). Home canonical and og:url `https://zelvomart.com/`. Already in place and checked: the two duplicate policy URLs answer 301; Product JSON-LD has `shippingDetails` and `hasMerchantReturnPolicy` from the store settings; no JSON-LD node without `@type` on 15 pages. |

### Left for a person (not code)
- Free delivery threshold: the flow says Rs 7,500, the code default is Rs 8,000 ("decided 19 Oct 2026" in `storefront/lib/site.ts`). The live value comes from Admin → Settings → Delivery; set it there (JSON-LD and the storefront follow it).
- After deploy: run PageSpeed on the home page (mobile) to measure LCP/TBT against the audit's 2.8 s / 1,140 ms.

### Batch 3 status
All items done in code. Backend tests (16), backend `tsc` and `next build` pass.

## Batch 4: clean-up and CI (branch `chore/cleanup-batch-4`)

| Item | Status | Notes |
|---|---|---|
| K1: dead code | Done | The 8 unused files from the audit, plus 6 more found by an import graph from every page/route (a duplicate `useAdminData.tsx`, `ProductStats.tsx`, `lib/phone.ts`, `lib/settings.ts`, `lib/store-images.ts`, `lib/product-media.ts`). `lib/store.ts` replaced by `loadPublicSettings()` in `storefront/lib/backend.ts` (single data layer). Backend: unused `bookPostExOrder()` stub and the never-read `checkout.requiredFields` seed setting removed; `lib/totp.ts` stays (admin 2FA). |
| K1: unused public assets | Done | 39 files (3.4 MB) that no page requests or references (crawl of 32 store pages at 1440 and 390 px + code search). Kept on purpose: `/brand/` logos, `/images/products/` (database product images), `/images/zelvomart/`. Fixed on the way: shop, bestsellers, deals and new-arrivals pages pointed og:image at files that did not exist. |
| K2: Prettier | Done | Separate "format only" commit; `npm run format` / `format:check` in the backend. |
| K2: routers | Done | `server.ts` 3,843 → 109 lines; routes in `src/routes/` (public, tracking, replay, customer-auth, auth, admin/orders, admin/products, admin/customers, admin/settings, admin/reports), shared helpers in `src/http/shared.ts`. Same 120 registered layers before and after; no reordered pair can match the same request. Kept in one PR: it is a move of unchanged code, and the checks cover it as a whole. |
| L1: generated client | Done | `backend/src/generated/` (28 MB, incl. a 20 MB Windows engine) out of git and ignored; made by `prisma generate` at install/build. Removed from `vercel.json` includeFiles. |
| L1: deployment screenshots | Done | 104 images (8.3 MB) removed; notes and runbooks stay. |
| L1: CI | Done | `.github/workflows/ci.yml`: npm ci, prisma validate, backend typecheck/format/tests, frontend typecheck, next build. No secrets or database needed. README has the Ignored Build Step for both Vercel projects. |

### Left for a person (not code)
- In each Vercel project: Settings → Git → Ignored Build Step → paste the command from the README.
- Watch the first backend preview deploy after this merge: the Prisma client is now generated on Vercel instead of committed. If the deploy fails with a missing Prisma file, add `"src/generated/prisma/**"` back to `includeFiles` in `backend/vercel.json`.
- Optional, later: protect `main` on GitHub (require the CI check and one review).

### Batch 4 status
All items done in code. Backend tests (48), both typechecks, Prettier check and `next build` pass locally.
Next: Batch 5 (region and monitoring).
## Batch 5: region and monitoring (branch `codex/region-monitoring-batch-5`)

### Region configuration
- Both deployment configurations now select `bom1` (Mumbai). This changes compute placement on the next deployment only; no dashboard or existing deployment was modified.
- Supabase remains in Sydney. Database relocation requires a separate project/data migration decision and is outside this change.
- Validation: inspected both JSON configs. Full batch checks will be recorded below after implementation.

### Left for a person (not code)
- Deploy both apps and verify their active function region and `/api/health`.
- Decide separately whether to migrate Supabase from Sydney to Mumbai.

### Optional Sentry monitoring — complete in code
- Added Sentry v11 to backend and Next.js (server, edge, browser and global error boundary). No valid DSN means no SDK initialization; CI/local builds need no Sentry account.
- Shared `@zelvomart/monitoring` allowlist retains only error type, safe stack location, release/environment and structural identifiers. Removes auth/contact/checkout data, request URLs, headers, cookies, bodies, breadcrumbs, arbitrary context, SQL and attachments. SDK v11 personal-data collection is explicitly disabled. Logs/metrics are dropped; tracing and Sentry Replay are off. Existing rrweb remains separate.
- Optional source-map upload is guarded by build credentials and commit SHA; frontend maps are deleted after upload. Updated Vercel Ignored Build Step instructions to include shared packages.
- Tests cover disabled/invalid DSNs, hostile nested sensitive event payloads and source-map upload disabled without credentials. No live Sentry event or source map was uploaded.

### System health card removal
- Removed the standalone dashboard card, its OWNER/MANAGER admin endpoint, service and tests, and the email-success database timestamp at the owner's request. The separate Tracking Health page, worker heartbeat and generic deployment `/api/health` check remain.

### Validation
- Backend tests: **54/54 pass**, no live database/mail service required.
- Backend and frontend TypeScript checks: pass.
- Backend build and frontend production build (`.next-launch`, isolated from the running dev server): pass; 72 static pages generated.
- Backend Prettier check: pass. `endOfLine: auto` handles the existing Windows CRLF checkout without reformatting unrelated files.
- Not exercised: authenticated browser card against live services, Sentry ingestion/source-map matching, deployed Mumbai placement. These are rollout smoke tests, not evidence claimed by unit/build checks.

### Batch 5 status and Batch 6 gate
All Batch 5 code is implemented and locally checked. Merge/deployment and optional monitoring credentials remain manual.
`deployment/batch-5-6-runbook.md` consolidates rollout steps and a reproducible three-page performance measurement checklist.
Batch 6 intentionally has **no invented baseline or speculative performance changes**: it requires both Mumbai deployments
to be live, then mobile Slow 4G Lighthouse measurements of real production pages. The historical Speed Index 4.3 s is not
a measurement of this branch. Existing SQL, replay storage, Resend, worker backlog review/deployment, domain and launch
configuration tasks from the handover remain manual and were not executed here.

### Handover review and verification 23 October 2026

- Reviewed existing Batch 5 rather than rebuilding it: both apps select `bom1`; the system-health
  endpoint and dashboard restrict access to OWNER/MANAGER, distinguish an absent worker from an
  endpoint error, and turn stale at the tested 120-second boundary.
- Closed an SDK telemetry gap: automatic browser/process/HTTP session envelopes and client reports
  bypass `beforeSend`. They are now disabled at initialization, and tracing is explicitly sampled at
  zero even if a tracing environment variable is present. In-memory SDK transport tests verify that
  normal page loads/HTTP requests emit nothing and captured errors are sanitized error events only.
- Fresh `npm ci` passes. Compared every pre-existing lockfile package version with main: no unrelated
  dependency version changed. Backend tests **56/56**, both typechecks, backend formatting, backend
  build and the isolated frontend production build all pass. Prior preview deployments and CI were
  green; the new review commit must also pass remote CI before merge.
- Git pull was repaired by backing up two broken local Codex checkpoint refs before removing only
  those refs. No branch or source history was deleted. Author identity already matched the owner;
  repository-local GitHub credential selection now uses the saved `webixsolutions-dev` account.
- No production database command, dashboard setting, secret or environment variable was changed.

## Batch 5-B: audit follow-ups (branch `fix/audit-followups-batch-5b`)

22 October 2026 handover reviewed against the merged source and the existing Batch 5 branch. This branch
starts from Batch 5 so its PR must be reviewed separately after Batch 5 lands. Work plan: cap replay
ingestion; return clear duplicate-email conflicts; serialize all structured data safely; ship pg-boss
search-path SQL and rollback; run the complete CI checks and record the manual rollout work.

### B-3: structured-data script safety

- Added one `jsonLd()` serializer that escapes every `<` as a JSON Unicode escape. All six JSON-LD
  emitters (organization, website, product, breadcrumb, FAQ and policy) now use it.
- Tested a hostile product title, nested strings, Unicode and a closing-script/image payload through
  React's HTML renderer: exactly one script, no injected HTML, and JSON round-trips without data loss.
- Validation: `node --import tsx --test backend/scripts/json-ld.test.ts` passes (1 test).

### B-2: duplicate team-user email

- Team-user create and update return `409 { error: "EMAIL_ALREADY_EXISTS" }` only for the email unique
  constraint. Email values are trimmed and lowercased consistently; other failures still reach the
  normal error handler. Add Staff shows a clear inline message and keeps the form open.
- Customer email is not unique in the existing schema, so shared customer emails remain supported.
  The existing customer-phone conflict stays a 409 with its specific message; no migration was added.
- Validation: duplicate-email HTTP route tests plus existing app-error tests pass (8 including subtests);
  backend and frontend typechecks pass. Tests stub imports before registering the actual routes and
  never load the database connection module.

### B-4: pg-boss database hygiene

- Added `backend/prisma/sql/04-pgboss-search-path.sql` for the installed pg-boss 10 function signatures,
  with a separate rollback and operator instructions. Missing worker functions or an unexpected custom
  path stop the entire patch; applying it twice is safe.
- Validation: both SQL tests pass on isolated in-memory PostgreSQL using the installed pg-boss DDL,
  including actual queue create/delete, reapplication, rollback and failure guards. No live database
  was accessed. The performance-advisor review stays manual after the purge; no unmeasured indexes
  were added.

### B-1: bounded replay ingestion and atomic rate limits

- Replaced read/reset/increment rate limiting with one atomic PostgreSQL upsert, including window
  resets and retry times. The high-frequency chunk route uses bounded in-memory counters per instance;
  it no longer queries the database for a per-request rate-limit bucket.
- Only `/start` can register a recording. Up to 200 new sessions per IP in a rolling 24-hour window;
  re-announcing the same registered session does not consume quota. Analytics events annotate existing
  sessions only, and early cart/checkout events are restored during registration.
- Each session accepts at most 400 immutable chunk sequences and 20 MiB of compressed R2 data. A
  transaction-scoped session lock covers admission, upload and metadata, so concurrent requests cannot
  exceed the caps or overwrite admitted keys. Duplicate retries acknowledge the existing chunk;
  unknown sessions, exhausted quotas and failed uploads never create arbitrary recording rows.
- The recorder buffers while registration retries, stops on a durable quota without rotating IDs,
  and retains that stop across reloads. Short per-IP throttles remain retryable. R2 PUT has a 15-second
  timeout; storage failures do not commit chunk metadata or consume session capacity.
- Validation: 8 new ingestion/delivery tests pass, including real atomic SQL on isolated in-memory
  PostgreSQL, floods, concurrent resets, 200-session quota, 40,000-event normal session, concurrent
  400-chunk boundary, byte boundary, duplicate immutability, unknown/unregistered session rejection,
  upload failure and browser registration/stop/retry behavior. Both app typechecks pass.

### Left for a person (not code)

- Review Supabase security/performance advisors. Run guarded SQL 04 only after installing the launch
  worker, staging first, with the supplied rollback available.
- Verify the Supabase Data API exposed-schemas setting. Complete Vercel secret cleanup/Sensitive
  flags, ignored build commands, main protection, owner password and delivery settings from Part A.
- Configure and verify Resend/domain and Sentry credentials/alerts. Review the 1,185-job backlog before
  deploying the worker. Complete infrastructure upgrades, final content, live domain/SSL, tracking
  tokens and real-order smoke tests from Part C.

### Final Batch 5-B verification 23 October 2026

- Clean dependency installation, Prisma validation, backend tests **73/73**, both TypeScript checks,
  backend Prettier check, backend build and frontend production build pass. The worktree uses its own
  dependencies; a shared dependency junction was removed after it caused local resolution failures.
- Batch 5 PR #20 merged through green CI and successful previews. Its production deployment on
  `4f8ebd8` also passes CI and both Vercel deployment statuses; backend `/api/health`, storefront home
  and admin login return 200. A backend response identifies the `bom1` compute hop. No authenticated
  admin action, live recording upload or real order was performed.
- Rollout steps and operating limits are in `deployment/batch-5b-runbook.md`. The pg-boss patch and
  Supabase performance-advisor review remain manual, as required by the handover.

## Footer navigation scroll fix — 27 October 2026
- Footer navigation links and the footer logo now reset the viewport instantly to the top on client navigation and again when the destination pathname commits. This keeps the full header visible and avoids the upward smooth-scroll animation from the previous footer position.
- Uses Next.js `onNavigate`, so opening links in another tab and external/social links retain their normal behavior. Other navigation and browser history are unchanged.
- Validation: frontend TypeScript and production build pass. Browser checks: About footer at y=4881 → Privacy Policy y=0, then Privacy Policy footer y=2781 → FAQ y=0; full header top=38 px in both destinations.

## Hotfix: product pages answered 500 — 28 October 2026 (branch `hotfix/product-page-500`)
- Cause: PR #24 read `?variant=` with `useSearchParams()` in `ProductDetail.tsx`. The product page is statically
  generated (`revalidate = 300` + `generateStaticParams`) with no `<Suspense>` boundary, so every on-demand render
  failed with "useSearchParams() should be wrapped in a suspense boundary" → HTTP 500.
- Fix (2 files, nothing else touched): `ProductDetail.tsx` reads the variant from `window.location.search` in an
  effect after mount (`variantSku` + `urlRead` state); the existing effect still preselects the matching in-stock
  variant. `useViewContent` (`storefront/lib/orders.ts`) takes a `ready` flag (default `true`) and fires once per
  product/variant only after the URL is read.
- Other `useSearchParams()` users checked: GoogleAnalytics, TrackingProvider and SessionReplayProvider sit inside the
  store layout's `<Suspense>`; SearchView and OrderConfirmed are wrapped by their pages. Three admin pages
  (orders print, bulk print, session replays list/detail) have no `<Suspense>`, but `AdminShell` renders them only
  after the client-side session check, so they never run during server rendering. Not changed.
- Checked locally with the backend running: the code before the fix reproduces the production error (500 on
  every product page, same message in the log); after the fix product pages answer 200, a missing product 404,
  `?variant=T-DB-M` preselects M, ViewContent fires exactly once with the right SKU (and with the product SKU
  without `?variant`). `npm run build` passes with no Suspense/CSR-bailout error; backend tests 71/71 pass.
- CI on this PR was red for a reason unrelated to the fix: since PR #24, `main` itself failed the backend Prettier
  check (7 backend files not formatted). Those 7 files were formatted with Prettier only; their compiled JavaScript
  is identical before and after (esbuild), so no behaviour changed. All CI steps then pass locally (prisma validate,
  both typechecks, Prettier check, backend tests 71/71, frontend build).

## Batch 7: go-live hardening (branch `batch-7/go-live`)

- Added cron-compatible job processing, bounded retries and daily cleanup; added order test marking and replay opt-out for admins.
- Hardened Meta Purchase deduplication and tracking payloads; aligned feed links and site canonicals with `https://www.zelvomart.com`.
- Local verification before merge: 71 backend tests passed, frontend/backend typechecks and production build passed. PR #24 was merged to `main` as `0007b451`.
- Production smoke check after merge: storefront, backend health, feeds and sitemap returned HTTP 200; feeds listed 21 products and used the `www` host.

## Batch 8: go-live follow-up (branch `batch-8/go-live-finish`)

- Daily cron now accepts GET and POST with the same Bearer `CRON_SECRET` authorization and `JOB_MODE=cron` gate.
- Session replay deletion now requires the dedicated `replays.write` permission; read-only report access can no longer delete recordings.
- Owner/provider actions remain pending: verify backend production environment and email sender, back up and clean the confirmed Supabase database, skip pre-launch jobs and flag sample orders, then enable the cron runner and configure cron-job.org. TikTok work is intentionally excluded at the owner's request.

## Batch 8: guarded admin deletion tools (branch `batch-8/delete-tools`)

- Added selected-row and selected-page replay controls, manager/owner-only deletion, exact-count confirmation and typed `DELETE` for batches over ten. Replay removal unlinks orders and removes database events/chunk metadata; R2 failures are returned with storage keys so orphaned files can be retried.
- Added coupon permanent deletion as a separately confirmed action while preserving the existing deactivate action and historical order coupon snapshots.
- Added single/bulk order deletion for cancelled or test orders only. Non-cancelled orders must first be marked test; owners must confirm the exact report-removal phrase. Jobs are removed transactionally, linked replays are unlinked, customers are retained and inventory is not restocked.
- Bulk endpoints deduplicate and cap requests at 200 IDs, require an exact confirmation count, report deleted/skipped/errors, and audit each successful deletion.
- Local validation: backend/frontend TypeScript checks and all 71 backend tests pass. Live deletion against production was not run.

## Batch 8: favicon cleanup (branch `batch-8/favicon`)

- Replaced the ambiguous public favicon filename with `favicon-zelvomart.png`, added a root `favicon.ico`, and pointed both store and admin metadata to the new brand icon. The ICO was generated from the existing Zelvomart app icon at 16/32/48 px.
- Frontend production build passed on the speed branch (favicon route generated from the existing icon).

## Batch 8: speed, checkout and schema follow-up (branch `batch-8/speed`)

- Order now sets the selected cart line to the chosen quantity instead of incrementing it, disables repeat submission while checkout opens, and prefetches checkout on product detail pages. The add-to-cart behavior remains additive.
- Delayed rrweb startup until the browser becomes idle or two seconds elapse; added immediate store/admin loading skeletons and reduced-motion handling.
- Admin reference data now uses memory plus sessionStorage with a five-minute stale-while-revalidate window for products, categories and coupons only. Auth, order, customer and replay data are excluded.
- Admin orders and session replays are server-paginated; background jobs now load 50 rows per request with total-count pagination instead of fetching up to 500 rows at once.
- Checkout now increments its independent IP and phone limits in one Postgres statement. Product pages emit ProductGroup/hasVariant schema when SKU options exist, including each option's image, price and availability.
- Product shipping markup now uses the live delivery fee and free-shipping threshold without incorrectly making a single high-priced item free to ship; return markup links to the actual conditional refund policy instead of advertising a blanket 7-day return.
- Local checks: backend/frontend TypeScript checks, backend Prettier, 71 backend tests, and frontend production build passed. The production build logged backend timeouts for policy-page content during static generation; it completed using the page fallbacks.
- Still requires owner/service access: production environment and Resend verification, Supabase backup/SQL cleanup, cron-job.org + JOB_MODE setup, Secret sensitivity flags, domain/DNS and live smoke tests. TikTok settings and events were left untouched per request.

## Hotfix: checkout answered 500 — 29 October 2026 (PR #26, merged)
- Found while testing the order-delete change: `consumeDatabaseRateLimits` (7f4ca51, merged 28 Oct) passed the checkout
  rate-limit rules as untyped parameters in a `VALUES` list; Postgres read them as text and
  `"windowMs" * interval` failed, so `POST /api/orders` answered 500 for every checkout with a phone number.
- Fix: the parameters are cast (`::text`, `::int`). Checked locally: before, 500 with that error; after, orders are
  created and the 7th attempt from one phone in 15 minutes gets 429. Backend production deploy succeeded.

## Simple delete for orders, coupons and session recordings — 29 October 2026 (branch `fix/simple-order-delete`)
- Orders: `DELETE /api/admin/orders/:id` (new) and `POST /api/admin/orders/bulk-delete` delete any order, for OWNER
  and MANAGER only (ORDER_AGENT gets 403). The "mark as test first" rule and the typed owner phrase are gone. In one
  transaction: the order's Job rows are deleted (no email or Meta/TikTok event is sent for it), its session recording
  is unlinked, the order is deleted (items, history and notes cascade). No restock; the customer stays; one
  `hard_delete` audit entry per order; at most 200 IDs per request.
- Admin: orders list (row Delete and "Delete selected") and order detail page (new Delete button) ask one question,
  "Delete N order(s)? This cannot be undone.", and the rows leave the table at once (no page reload); the detail page
  returns to the list. The delete buttons show only for OWNER and MANAGER.
- Coupons and session recordings: the typed "DELETE" step for more than 10 items is removed (frontend and backend);
  one confirm only.
- Checked locally: ORDER_AGENT 403; OWNER deletes a normal NEW (non-test) order; jobs, items and orders gone,
  customer kept, stock unchanged, 3 audit entries; unknown ID skipped; 250 IDs → 200 processed. Browser: single,
  selected and detail deletes each show exactly one dialog and the rows disappear without a reload; 11 coupons
  bulk-deleted without the typed word, and the coupon screen shows one confirm. Backend tests 71/71, both typechecks,
  Prettier check and frontend build pass.

## Go-live Part 1: launch checkout fixes — 29 October 2026 (branch `fix/launch-checkout`)
- **1.1 Bundles.** A bundle line holds whole bundles: 2, 4, 6 … pcs. −/+ on the product page, cart drawer and cart
  page move one bundle; lines read "2 bundles (4 pcs)". The API gets `pieces / 2` bundles of size 2 (order, coupon
  quote, abandoned-checkout save and the restore link all use the same `cartLineForApi`). Line totals use the
  server's rounding (discount off the whole line, then rounded). Old or restored carts with an odd bundle count are
  rounded **up** with a visible note in the cart, drawer and checkout. The checkout retry key now follows the cart, so
  a changed cart never gets an older order back.
- **1.2 Variant price.** The product page's main price, sale price, "You save", Buy 1 / Buy 2 prices, total, sticky
  bar and WhatsApp text all use the selected variant's price (fallback: product price). ViewContent/AddToCart send it too.
- **1.3 Variant by ID.** Cart lines store `variantId`; the name is for display only. Variants that would show the
  same name show every attribute ("Red / Small", "Red / Large"). Name-only lines in localStorage are resolved to the
  ID once. `content_ids` stay the variant SKU (the Purchase event used the variant *name* before; fixed).
- **1.4 Sold out.** Cards add the first in-stock variant, or show a disabled "Sold out". Sold-out swatches (image,
  colour and size) are disabled; "in stock" follows the selected variant. `addToCart` refuses sold-out items (also
  for wishlist "Add all" and the drawer upsell, which now skips sold-out products). The server check stays.
- **1.5 One limit.** 20 pcs per line (10 bundles), `MAX_LINE_PIECES` in `frontend/storefront/lib/store.tsx` and
  `backend/src/lib/validators.ts`; the API now counts pieces (`quantity × bundleSize ≤ 20`). The UI stops at 20 with a
  message; old carts above 20 are reduced with a note.
- **1.6 Rate limits.** `backend/src/lib/store-limits.ts`: checkout 60 per 15 min per IP, 6 per phone per 15 min on
  **any** IP (the phone bucket no longer includes the IP); events per visitor id (240/min), else 1,200/min per IP;
  search 120/min; coupon 40/min. The store proxy also falls back to `x-forwarded-for`. A checkout 429 shows
  "Bohot zyada koshishen hui hain. 2 minute baad dobara try karein ya WhatsApp par order karein." with a WhatsApp
  button carrying the cart. Tests: forwarded IP only with the right secret, IPs counted apart, 7th order from one
  phone blocked, 20 phones on one IP allowed. Local run through the proxy: 20 phones on one IP → 20 × 201, each
  stored with `clientIp` 39.45.10.20; one phone on 7 IPs → 6 × 201 then 429; a spoofed `x-zm-client-ip` without the
  secret is ignored. (Two real networks still to be checked in production after `STORE_PROXY_SECRET` is set.)
- **1.7 Product tabs.** Product pages show Admin → Product tabs (`store.productTabs`, loaded with the store
  settings); a product's override wins; a tab saved empty is hidden; never-saved tabs show the default text.
  Sanitized on save and on display. Tab text may use `{free_delivery_over}` and `{delivery_fee}`, filled from
  Settings → Delivery (the defaults use them instead of "Rs 8,000"). Saving tabs already revalidates the cache;
  checked locally (edit → page shows the new text). Storefront fallback amounts are now 7,500 / 190.
  Production's saved tabs are still the old built-in default text with a fixed "Rs 8,000" (read from the preview
  backend); a saved tab whose text is exactly that old default is shown as the new default with live amounts
  (Rs 7,500 / Rs 190). Hand-edited text is shown as written. **Data still saying Rs 8,000** (owner to edit): the
  announcement bar item "Free Delivery on Orders Above Rs 8,000".
- **1.8 Security.** next 16.3.8 → 16.4.3; body-parser 2.3.0 → 2.4.0 and qs 6.16.0 → 6.17.1 (under express);
  multer 2.4.0 → 2.5.0. `npm audit --omit=dev`: before 9 (1 critical, 5 high, 2 moderate, 1 low), after 5 (3 high,
  1 moderate, 1 low). **Prisma finding:** the remaining highs are one advisory, `deepmerge-ts` < 8 (stack exhaustion
  on recursive objects), reached only through `prisma` → `@prisma/config`, the CLI's config loader. It runs at build
  time (`prisma generate`) on our own config, never at request time; `@prisma/client` and `@prisma/adapter-pg` do not
  depend on it. The fix needs prisma 7 (a major upgrade), so it is left for a separate task. The low/moderate item is
  `deepmerge` under `sanitize-html` (backend pins 2.17.4; 2.18.1 has the fix) — left as is.
- **1.9 TikTok.** No `tiktok-event` / `tiktok-purchase` job is created (events, new orders, admin status changes,
  "resend purchase") unless `tracking.tiktokEventsApiEnabled` is on and a TikTok pixel ID is set. Checked live:
  order with TikTok off → no TikTok job; on → one.
- **1.10 Email.** One recipient list for the team alert, daily summary (API and worker) and failure alerts:
  `notifications.orderRecipients`, else `ORDER_ALERT_RECIPIENTS`, else support@. Contact form → `SUPPORT_EMAIL_TO`
  (comma list) or support@. Offer emails BCC `OFFERS_COPY_TO` when set. Internal emails start with `[Orders]` /
  `[Support]` and open with "Zelvomart mailbox: … · copy: …". Customer emails, From, Reply-To and customer subjects
  unchanged. Checked with the real order template: "[Orders] ZM-10021 • New COD order • Rs 29,242".
  **Before** `orders@`/`offers@` are added to any list, the owner must confirm both mailboxes exist in Hostinger.
- **Checks:** backend 87/87 tests, both typechecks, Prettier, prisma validate, frontend build (Next 16.4.3). Browser
  run (24 checks): variant names/prices, Buy 2 = 7,598 for Red / Large, steps of 2, cap at 20 with message, drawer +
  adds a bundle, three lines by variant id, reload, order ZM-10021 saved 6 pcs / Rs 22,794 line / Rs 29,242 total =
  what checkout showed, old-cart migration notes, friendly 429, sold-out card, card adds Rose Gold not sold-out Silver.
- **Still to do (Part 2, needs the owner's computer and "yes"):** env backup, Resend key, `CRON_SECRET`,
  `STORE_PROXY_SECRET`, site URLs, pg_dump + job cleanup, `JOB_MODE=cron`, unused env vars, the
  `zelvomart.vercel.app` redirect and the host-list PR, cron-job.org.

## Sitemaps split like Yoast — 29 October 2026 (branch `feat/split-sitemap`)
- **URLs.** `/sitemap_index.xml` (index; `/sitemap.xml` serves the same content, no redirect) lists only non-empty
  children: `/page-sitemap.xml` (the 13 static pages), `/product_cat-sitemap.xml` (categories with at least one
  published product), `/product-sitemap.xml` (published, not-noindex products with up to 10 image entries each, main
  image first). Past 1,000 products: `/product-sitemap2.xml`, 3 … (rewrite to `/sitemaps/products/N`). Index
  `<lastmod>` = newest inside the child. `<lastmod>` only (no priority/changefreq), values XML-escaped, www origin.
  robots.txt points to `/sitemap_index.xml`.
- **Code.** One module, `frontend/storefront/lib/sitemaps.ts` (data, XML, responses); route handlers in
  `frontend/app/<file>.xml/route.ts` call `serveSitemap()` (`storefront/lib/sitemap-route.ts`). The old
  `app/(store)/sitemap.ts` is gone. Backend `GET /api/seo/sitemap` now also returns title, category, absolute image
  URLs, category name/image and published-product count (`backend/src/lib/seo-sitemap.ts`, same filters).
- **Never empty.** `loadSeoIndex()` now throws instead of returning empty lists. Checked locally: built while the
  backend was up, then backend down + revalidation → the last good file kept serving (87 products); built and run
  while the backend was down → `503`, `Retry-After: 600`, `Cache-Control: no-store`, and 200 again once it was back.
- **Browser view.** `frontend/public/sitemap.css` via `<?xml-stylesheet type="text/css"?>` (no XSLT, no JavaScript):
  heading, URL count (CSS counters), "for search engines" note, one row per URL with last modified and image count;
  larger text on phones. Links in the XML view are not clickable by design.
- **HTML sitemap** `/sitemap/`: summary (Pages · Categories · Products, last update), the three sections with
  products under their category, and a "For search engines" table (file, URLs, last modified). `noindex, follow`,
  canonical `https://www.zelvomart.com/sitemap/`, "Sitemap" link in the footer. On a backend failure it shows a
  short "updating" notice instead of empty lists.
- **Cache.** `revalidate = 3600`; the backend's cache invalidation now also refreshes `/sitemap_index.xml`, the three
  children and `/sitemap` (extra product sitemaps refresh through the `products` tag).
- **Redirect table:** no rows with "sitemap" in `sourcePath`, nothing removed.
- **Checks:** backend 90/90 tests (new: images, drafts and noindex excluded), frontend sitemap tests 8/8 (xmllint on
  every file, only non-empty children, absolute www/R2 URLs, `&amp;`, 1,000-split, 503), both typechecks, Prettier,
  build with and without a backend. Local run on production catalog data: 13 pages, 6 categories (Tech has no
  published products), 87 products, 367 images, matching the database.
- **Search Console (owner):** Sitemaps → remove old WordPress entries that show "Couldn't fetch" (keep
  `sitemap_index.xml`), submit `sitemap_index.xml`; optionally also the three children.

## Sitemap follow-up — 30 October 2026 (branch `fix/sitemap-followup`)
- **What went wrong after PR #31.** Storefront and backend deployed at the same moment; the storefront prerendered
  its sitemaps against the still-old `/api/seo/sitemap` (slug + updatedAt only). Every product fell back to Home &
  Living and had no images: live files showed 1 category and 0 image entries (cached for an hour).
- **Shape check.** `isSeoIndex()` (`storefront/lib/sitemaps.ts`) requires `title`, `category`, `images[]` on every
  product and a numeric `publishedProducts` on every category. `loadSeoIndex()` asks `/api/seo/sitemap?v=2` (a new
  cache key, so an old cached answer is never reused); a wrong shape is retried once uncached, then it is a failure:
  503 + `Retry-After: 600`, never cached. Next's own "dynamic" signal is rethrown (`unstable_rethrow`), so a build
  against an old backend leaves the routes on-demand instead of freezing bad data. Checked locally: old shape →
  build passes, all sitemap files 503; backend switched to the new shape → 7 categories, 87 products, 367 images.
- **No invented category.** Sitemaps map a backend category slug to a store category exactly (`exactCategoryId`);
  unknown/missing → no category (logged, listed under "Other products" on `/sitemap/`), never Home & Living.
- **All categories listed (owner decision).** `product_cat-sitemap.xml` and `/sitemap/` list every category the
  admin still has, empty ones too (`/sitemap/` shows "(0 products)"). Category pages are `index, follow` even when
  empty; instead of an empty grid they show "New … products are coming soon", a WhatsApp button, links to the
  other categories and four bestsellers (or newest products).
- **Image alt text.** `frontend/lib/image-alt.ts`: image 1 = product title (or the saved main-image alt / CSV
  `imageAlt`); a later image of a variant = "<title> in <variant>"; others = "<title> – view N"; always distinct.
  Admin → product → gallery: an optional alt field under each photo (placeholder = generated text), saved as
  `imageMeta.alts` (URL → text) in the catalog meta; image URLs and order unchanged. Product page thumbnails are
  buttons labelled "Show image N of M" with `alt=""` images; cards use image 1's alt. (The image sitemap has no alt
  field, so the XML is unchanged.)
- **Deploy rule:** after any change to the `/api/seo/sitemap` response, deploy the **backend first**, then the
  storefront (the shape check covers a race: 503 until both are live, never wrong data).
- **Checks:** frontend tests 14/14 (new: old shape → 503, unknown category, all categories, alt text), backend
  90/90, both typechecks, Prettier, CI build without a backend.
