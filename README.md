# Zelvomart

Online store for zelvomart.com: a Next.js frontend (storefront and admin) and an Express + Prisma backend on PostgreSQL, in one npm workspace.

```text
frontend/
  app/(store)/      storefront pages: the zelvo-mart design, wired to the backend
  app/(admin)/admin admin panel (URLs stay /admin/...)
  app/api/          proxies to the backend: store-proxy, admin-proxy, account, admin-session, revalidate
  storefront/       storefront components, styles and data adapters (lib/backend.ts, lib/store.tsx, lib/redirects.ts)
  components/admin  admin components;  lib/  shared tracking, replay and API helpers
  proxy.ts          admin session check, 301 redirects and trailing slashes
backend/
  src/server.ts     app setup;  src/routes/  the REST API by area (public, auth, replay, tracking, admin/*)
  src/http/shared.ts  helpers the routes share;  src/lib/  orders, coupons, email, tracking, storage
  src/generated/    Prisma client, made by `prisma generate` (not committed)
  prisma/           schema, migrations and seed;  workers/  background jobs;  scripts/  tests and tools
import-templates/   CSV templates for the admin's product import
deployment/         rollout notes, R2 rules and the worker env template
.github/workflows/  CI
```

## Run locally

```bash
npm ci
npm run prisma:generate
npm run db:migrate          # or: npm run db:push
npm run seed                # sample categories and settings
npm run admin:create --workspace backend   # the first owner account (asks for the password)
npm run dev                 # frontend on :3000, backend on :4000
```

`npm run dev:frontend` and `npm run dev:backend` start one side; `npm run worker` runs the background jobs. Backend tests: `npm test --workspace backend` (no database needed). Format the backend with `npm run format --workspace backend`.

## Environment variables

- Backend (`backend/.env`): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, `REVALIDATION_SECRET`; email via `RESEND_API_KEY` and `EMAIL_FROM`; storage via `S3_*` and `REPLAY_S3_BUCKET`; tracking via `META_*` and `TIKTOK_*`; courier tracking links via `POSTEX_TRACKING_BASE_URL`.
- Frontend (`frontend/.env.local`, see `frontend/.env.example`): `BACKEND_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `REVALIDATION_SECRET`, `NEXT_PUBLIC_IMAGE_HOSTS` and the pixel IDs.
- Worker: `deployment/worker.env.example`.

## Where things live

- Storefront look: `frontend/storefront/components` and `storefront/styles/globals.css`, copied from zelvo-mart. Data reaches them only through `storefront/lib` (catalog, store, orders, settings).
- Features the backend has no endpoint for yet (review upload, email updates, account dashboard) go through `storefront/lib/api-gaps.ts`.
- Admin: `frontend/app/(admin)/admin` and `frontend/components/admin`, with their own layout and CSS.
- Hosts other than zelvomart.com get `X-Robots-Tag: noindex` (`frontend/next.config.ts`).

## CI

`.github/workflows/ci.yml` runs on every pull request and on `main`: `npm ci` (which runs `prisma generate`),
`prisma validate`, backend typecheck, Prettier check and tests, frontend typecheck and `next build`. It needs no
secrets and no database.

## Vercel: build only the project that changed

Both Vercel projects build from this repository. Set an Ignored Build Step on each (Project → Settings → Git →
Ignored Build Step → "Run my custom command"), so a change to one app does not redeploy the other. Vercel runs the
command in the project's Root Directory; exit code 0 skips the build, anything else builds (so if the previous
commit cannot be found, it builds).

- Storefront project (Root Directory `frontend`):

  ```bash
  git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ../packages ../package.json ../package-lock.json
  ```

- Backend project (Root Directory `backend`):

  ```bash
  git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ../packages ../package.json ../package-lock.json
  ```

The command is the same text in both projects; it compares only that project's folder and the shared root
`packages/`, `package.json` and `package-lock.json`. To force a build anyway, use "Redeploy" in Vercel.

## Deployment region

Both `frontend/vercel.json` and `backend/vercel.json` select `bom1` (Mumbai), so storefront SSR and the API
run in the same region **after deployment**. This does not move existing deployments or the database.
Supabase currently remains in Sydney; moving it to Mumbai is a separate project/data migration decision.


## Optional error monitoring

Sentry is disabled when no valid DSN is configured. No account or token is needed for local development or CI.

| App | Optional runtime variables |
|---|---|
| Backend | `SENTRY_DSN` |
| Frontend server/edge | `SENTRY_DSN` |
| Browser | `NEXT_PUBLIC_SENTRY_DSN` (public ingestion key, baked into the build) |

Optional source-map upload on each app's build uses `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` and
`VERCEL_GIT_COMMIT_SHA`. Keep the auth token server-side; never use a `NEXT_PUBLIC_` token. Without these credentials,
source-map upload is skipped. Release identifiers come from the Git commit SHA. Frontend maps are removed after upload;
backend maps stay in the server artifact for stack traces. Configure only variables needed by that app, then rebuild.

Only error events are sent. A shared allowlist strips request URLs, headers, cookies, bodies, users, breadcrumbs,
free-form messages, SQL, extra context and attachments. Error type, sanitized source location, line/column and commit
remain for diagnosis. Sentry v11 `dataCollection` disables personal-data collection; logs, metrics, tracing and Sentry
Replay are disabled/dropped. The existing rrweb recorder remains separate. Real error ingestion and source-map matching
must be smoke-tested after configuring an account; no test event was sent to a live service during development.

## Admin dashboard health

The standalone System health dashboard card and its `/api/admin/system-health` endpoint were removed on 23 October
2026 at the owner's request. Worker and queue status remain available in the separate Admin → Tracking Health area;
the generic `/api/health` endpoint remains for deployment checks. Successful email sends no longer write a
health-only database timestamp.

Deployment and measurement checklist: [deployment/batch-5-6-runbook.md](deployment/batch-5-6-runbook.md).
