# Tracking and replay rollout

## Implemented in this checkout

The developer brief is used as feature requirements. Existing checkout, inventory,
customers, permissions and order workflows remain in place. The Prisma changes
are additive: old replay JSON and historical Clarity order fields are retained.
Clarity scripts, browser calls and visible settings have been removed.

- Settings-only browser pixels, production-domain/staff exclusions, one TikTok page
  call, normalized SKU/PKR payloads, click cookies and stable visitor identity.
- Purchase order-number event IDs shared with the worker, excluded test/staff/blocked
  orders, and server OrderConfirmed/OrderDelivered events.
- Explicit skipped job status, worker heartbeat, missing-token/stuck-job/coverage
  health, daily summary and authenticated manual job retry. Jobs stays accessible
  through health details while removed from the sidebar.
- Shared Meta/TikTok/Google feeds, plain descriptions, variant SKU links, attributes
  and compatible catalog image copies. The storefront keeps its existing images.
- Replay chunks, snapshot metadata, database funnel filtering before pagination,
  private signed chunk delivery, incremental player loading, live polling, journey
  markers, speed controls, inactivity skipping, fullscreen and viewport fitting.
- Five-second recorder flushes, snapshots on load/navigation, thirty-minute idle
  rollover, masked inputs and confirmation details, URL privacy and device exclusion.

## Existing server worker (Docker option)

From the repository root on the existing server:

1. Copy `deployment/worker.env.example` to `backend/.env.worker` and populate it
   using the existing backend configuration. Use a Supabase session-pooler or
   direct connection for `WORKER_DATABASE_URL`; never transaction-pooler port 6543.
2. Run `docker compose -f compose.worker.yml build`.
3. When ready to process the real queue, run
   `docker compose -f compose.worker.yml up -d`.
4. Inspect `docker compose -f compose.worker.yml logs --tail=100 worker` and admin
   Tracking Health. The heartbeat should turn healthy within thirty seconds.

No inbound port is required. The worker needs outbound PostgreSQL, email-provider,
Meta and TikTok access. Starting it processes the existing real queue, including
emails. Server access/deployment method is still needed; this service has not been
started from this development session. PM2 can instead run `npm run worker` with
the backend directory as cwd and the same environment.

## Private Cloudflare R2 bucket

The private `zelvomart-replays` bucket has now been created in the Zelvomart account,
with public access disabled, playback CORS and a thirty-day `replays/` lifecycle
rule. The existing multipart-abort rule is preserved. Gzip upload, signed playback,
production-origin CORS and unsigned-access rejection passed; the QA object was removed.
The local backend environment now has `REPLAY_S3_BUCKET=zelvomart-replays`.
On the production API deployment set `REPLAY_S3_BUCKET` to that same private bucket and use
the existing R2 `S3_ENDPOINT`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID` and
`S3_SECRET_ACCESS_KEY`, with read/write/delete permission for the private bucket.
Disable public access. No replay public URL is used.

Apply the CORS policy in `replay-cors.json` to the private bucket, adding the actual
admin origin if different. Apply/merge `replay-lifecycle.json` as an R2 lifecycle
rule: every object under `replays/` expires **30 days** after upload. Preserve any
unrelated existing rules. In Cloudflare: R2 → the replay bucket → Settings →
Object lifecycle rules → Add rule → prefix `replays/`, delete objects after 30 days.
The admin retention setting (default 30, maximum 30 days) removes the database
metadata on the same schedule; it does not edit the bucket.

Recordings are stored **only** in the private bucket. Without `REPLAY_S3_BUCKET`
(plus `S3_ENDPOINT` and the S3 access keys) nothing is recorded: the storefront
does not load the recorder, the replay endpoints answer 503
`REPLAY_STORAGE_NOT_CONFIGURED` without touching the database, and Admin →
Session Replays and Admin → Tracking show a warning. There is no sampling: with
the bucket configured, every visitor is recorded. PostgreSQL keeps only metadata
per chunk (storage key, event count, size, timestamps); the inline `events`
column stays empty.

Old inline recordings are not kept or moved. Remove them with
`backend/prisma/sql/02-purge-old-replays.sql` (steps in `backend/prisma/sql/README.md`).

## Database and catalog deployment

The additive SQL in
`backend/prisma/migrations/202610180001_tracking_replays/migration.sql` was applied
to the currently configured database with `prisma db execute`. Existing recordings
were not dropped. On another environment apply that migration before the code.
If using Prisma Migrate, reconcile its migration history before running deploy;
`db execute` does not create a `_prisma_migrations` record. Regenerate Prisma.

Fifteen required JPG copies were created in the configured image storage. For a
different database/storage deployment run `npx tsx scripts/backfill-catalog-images.ts`
first, then add `--apply`. Feed image mappings are stored as settings. Missing-image
counts are exposed in response headers rather than publishing incompatible URLs.

Public feed URLs are `/feeds/meta.xml`, `/feeds/tiktok.xml`, `/feeds/google.xml`.
The API equivalents are `/api/feed/<platform>.xml`. Import into the external
catalogs, confirm SKU/group matching, then switch feed sources there. Existing
catalogs, DNS, ad-account ownership and platform access are not changed by this code.

## Verification and remaining acceptance

Passed: frontend/backend/worker TypeScript checks; seven payload/privacy/job-status
regressions; live configured-database replay ingestion, duplicate-chunk counts,
URL privacy, funnel filtering and authenticated index/chunk endpoints; all three
catalog feeds returned seven items. Temporary replay fixtures were cleaned up.
The customer API checks also cover existing authentication, validation and reads.
No full build was run for these changes.

Still requires deployment/account verification: worker restart/heartbeat and queue
draining; production API environment rollout; browser/server Events
Manager deduplication with saved test codes; external catalog imports; production
mobile/desktop recording, live follow and ten-minute playback startup under three
seconds. These are not claimed as completed. Test-event buttons send to the actual
platform and display its response; they have not been invoked during implementation.

Useful local checks (from backend):

```sh
npx tsx --test scripts/tracking-regression.test.ts
npx tsx scripts/check-tracking-replays.ts
npx tsx scripts/check-customers.ts
```

## Current Vercel site and live replay verification

The current public site is `https://zelvomart.vercel.app`. Set `NEXT_PUBLIC_SITE_URL`
to that origin in both deployments. R2 CORS allows that exact origin and localhost
port 3000; public access remains disabled. Browser/server tracking uses the
configured site and excludes staff, admin pages, localhost and other previews.

Local frontend environment values now target `http://localhost:4000` for
`BACKEND_URL` and `NEXT_PUBLIC_API_URL`. Production retains its deployed backend
origin. The old deployed replay response had inline events without a chunk index;
the new loader accepts both formats and validates responses before reading them.
Replay upload failures return 503 so the recorder can retry instead of losing data.

The additive `202610180002_replay_checkpoints` migration was applied to the
configured database. It backfills snapshot/timestamp metadata without removing
events. Live views start at the latest snapshot. Duplicate uploads are serialized
per session so concurrent retries do not inflate counts.

Browser verification: the original failing recording now renders and advances
during playback while remaining chunks load. A mobile QA recording showed new
live mutations without reload, held its frame while paused, and resumed at the
latest frame. The viewport fits after player recreation. Late live events update
the real replay DOM. QA records and objects are removed after testing.

Covered cases include legacy/malformed responses, empty live sessions, partial
loading, timeout/network retries, signed URL refresh, ended sessions, quiet-reading
heartbeats, idle rollover and staff exclusion. This is targeted validation, not a
guarantee for every browser/network condition. Ten regression tests and targeted
frontend/backend/worker type checks passed; no full build was run.

Deploy the updated frontend and backend for the public Vercel site to receive these
fixes. Production environment rollout and the always-on worker remain outstanding.

## Future domains, idle timing and dashboard styling

Both the current Vercel host and `zelvomart.com` / `www.zelvomart.com` are explicitly
allowed by browser/server tracking and backend CORS. Vercel remains the canonical
site until `NEXT_PUBLIC_SITE_URL` is changed. The replay CORS template includes all
three hosts and localhost. Applying the latest template in the Cloudflare dashboard
was blocked by a network timeout; the previously saved Vercel/localhost policy remains.

Future custom-domain playback uses an authenticated same-origin chunk download.
Direct R2 fetch failures also fall back to this path. It retains reports permission
checks and private bucket access. Missing files return 410; retained legacy event
JSON can still provide playback if a migrated object is unavailable.

Timings: upload/live refresh every 5 seconds; rrweb skips inactive gaps above
10 seconds by default; sessions end after 30 minutes without pointer, keyboard,
scroll or touch activity. Activity after the timeout starts a new session, including
after a sleeping tab wakes up or the page reloads. A throttled session-storage
timestamp preserves idle handling across navigation. Upload retry delay backs off
from 2.5 seconds to 30 seconds, and final buffered batches are drained on stop.

The player now has colored overview cards, event-colored journey rows, clearer
timestamps, background treatments and consistent compact control typography.
Twelve regressions and frontend/backend type checks pass. The final live API test
could not run because Supabase was unreachable; prior live-update verification is
recorded above. Re-run `check-tracking-replays.ts` after connectivity is restored.

## Idle pause and recovery safeguards

Recording now pauses after 2 minutes without interaction (checked every 5 seconds),
and immediately when the tab becomes hidden. Returning before the 30-minute idle
session timeout resumes the same session with a fresh snapshot; activity after
30 minutes creates a new session. Background/sleeping tabs are checked on return.
Playback skips gaps over 10 seconds by default, including heartbeat-only gaps.

Uploads time out after 15 seconds, retry with backoff, and retry on reconnect.
Queued event buffering is capped at 2,000 events plus the pending upload; hitting
that cap pauses capture until the queue drains, then starts a fresh snapshot.
Privacy opt-out discards unsent queued events and stops capture. Requests already
in flight may finish. Browser termination can still lose unsent in-memory events.

Fourteen timing/tracking regression tests and the frontend type check passed.
No full build was run. Live database/storage integration remains to be rechecked
when Supabase connectivity returns.

## Replay startup visibility

Playback now begins at the first FullSnapshot rather than metadata time, without
a fixed 18-second seek. Replay-only style rules neutralize storefront entrance
animations/reveal opacity so rrweb's paused CSS animations cannot leave main content
transparent. This does not change the actual storefront or expose hidden form fields.
Hidden-tab events are rejected directly in the recorder callback as well as pausing
capture on visibility change; returning resumes with a new snapshot.
Fifteen regression tests and the frontend type check passed. Existing sessions that
never captured content cannot have that missing content reconstructed by this fix.
