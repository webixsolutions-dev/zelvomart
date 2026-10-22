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
