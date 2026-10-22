# Batch 5-B rollout

Review Batch 5 first, then merge `fix/audit-followups-batch-5b` through a green PR. No schema migration
is required for replay caps, atomic rate limits, duplicate-email handling or JSON-LD serialization.
The SQL file below is a separate manual maintenance step; nothing runs it during deployment.

## Checks after deployment

1. Confirm both Vercel deployments are ready, backend `/api/health` succeeds, and an admin can sign in.
2. With private replay storage configured, browse a fresh store session and find its recording in
   Admin → Session Replays and under `replays/` in the private bucket. A chunk sent before `/start`
   returns `409 REPLAY_SESSION_NOT_STARTED` and creates no recording. Existing sessions from the old
   frontend can resume after a successful `/start` announcement or reload.
3. A session is limited to 400 chunks and 20 MiB compressed data. New sessions from one IP are capped
   at 200 per rolling 24 hours. Quotas answer `429` with `REPLAY_SESSION_LIMIT` or
   `REPLAY_DAILY_START_LIMIT`; the browser stops that recording without creating a new session ID.
   Ordinary per-instance throttles return `RATE_LIMITED` and the browser retries with backoff.
4. Re-adding a team email shows a clear error and the API returns `409 EMAIL_ALREADY_EXISTS`.
   Customers may still share an email; their unique phone-number rules are unchanged.
5. Inspect product, breadcrumb and FAQ structured data. Escaped `<` characters remain valid JSON and
   preserve the original content when parsed.

Run flood tests on an isolated test deployment/bucket, never on production. Automated tests already
cover admission limits and PostgreSQL statement behavior without a network database or real R2.

## Manual database maintenance

Follow Part A of the handover first. After the launch worker has installed pg-boss, test and run
`backend/prisma/sql/04-pgboss-search-path.sql` as the function owner. Read the preconditions and
verification in `backend/prisma/sql/README.md`. Its rollback restores the old default search path.
After the replay purge, review Supabase's performance advisor and real admin query plans before adding
indexes. This PR contains no speculative indexes.

## Rollback and operating limits

Revert the application PR to roll back code; no application schema changed. That restores the old
unbounded recording behavior, so retain private R2 lifecycle rules and monitor storage. A successful
upload whose database transaction later fails may leave its deterministic object key without metadata;
the 30-day R2 lifecycle remains necessary. The transaction holds its session lock during a bounded PUT
to enforce caps across instances without a new reservation table.

## Remaining launch work

Part A database purge, project-secret cleanup, replay bucket configuration, owner password and delivery
settings remain manual. Resend/domain verification, launch worker, paid infrastructure, final product
content, tracking tokens, domain/SSL, and real-order smoke tests remain with the owner/team as specified
in the handover. Batch 6 starts only after Mumbai deployments are live and mobile Slow 4G baselines for
home/category/product have been recorded. No production measurements are claimed by local builds.
