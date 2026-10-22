# Batch 5 rollout and Batch 6 measurement

Code is prepared on `codex/region-monitoring-batch-5`. These operational tasks remain manual, as specified in the handover.

## Before rollout

1. Review/merge the batch PR after CI passes. Set both Vercel Ignored Build Step commands from README; they now include shared `packages/`.
2. Follow the existing handover's environment cleanup and password-change steps. Check the backend preview generates Prisma correctly and `/api/health` succeeds with strict TLS.
3. Apply security/replay/CMS SQL only after backup and testing, in the order in `backend/prisma/sql/README.md`. No SQL was executed for Batch 5.
4. Configure the replay bucket, write permissions, CORS, 30-day lifecycle and retention using the existing `deployment/replay-*.json` files and handover. This is independent of Sentry.
5. Configure optional Sentry variables listed in README. Upload credentials are private build variables, never browser variables. Without DSNs the apps keep working.

## Deploy and smoke-test

1. Deploy backend and frontend; verify actual function placement is Mumbai (`bom1`). The database is still in Sydney; migration to Mumbai is a separate project/data migration.
2. Check `/api/health`, storefront pages, admin login, and the dashboard as OWNER/MANAGER. Missing worker must be red and say `Worker not running`. Other roles must neither see the card nor access its endpoint.
3. With a configured Sentry account, trigger a controlled staging error and check that only sanitized error details reach the project and stack frames resolve to the release. Confirm request bodies, cookies, contact data and rrweb data are absent. Do not trigger customer transactions for a smoke test.
4. Configure/verify Resend separately. Acknowledgement timestamps are operational signals, not delivery receipts.
5. Review queued worker backlog before worker deployment, following `deployment/worker.env.example`. Do not automatically retry historical order emails.
6. Set delivery threshold to Rs 7,500 in Admin Settings. Domain, Search Console, product feeds, tracking tokens, main protection and Supabase plan/migration remain the handover's launch tasks.

## Batch 6: measure the deployed region change first

Do not optimize against the historical 4.3 s Speed Index or claim a speed improvement from an undeployed configuration.
Once both new deployments are live, use Chrome Lighthouse in a clean profile with mobile emulation and Slow 4G throttling
for the production home page, one real category and one real product. Save HTML/JSON reports and record the deployed SHA,
URLs, timestamp, Chrome/Lighthouse versions and throttle settings. Run each page three times; compare medians under the
same settings. Avoid measuring a login screen, empty product fallback or a preview build against production.

| Page | TTFB | LCP | TBT | CLS | Speed Index | Top 5 opportunities |
|---|---:|---:|---:|---:|---:|---|
| Home | Pending deployed measurement | | | | | |
| Real category | Pending deployed measurement | | | | | |
| Real product | Pending deployed measurement | | | | | |

Put the completed baseline in PROGRESS.md. Inspect the waterfall in order: TTFB/cache, hero download/rendering, fonts,
third-party work, JavaScript and layout shifts. Make only changes supported by that evidence; use one fix per commit,
remeasure and revert changes with no benefit. Record before/after medians. Targets: LCP <2.5 s, TBT <200 ms, CLS <0.1,
Speed Index <3.4 s. No post-deployment measurements or performance improvement are claimed in this batch.
