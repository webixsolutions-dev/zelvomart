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
  git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ../package.json ../package-lock.json
  ```

- Backend project (Root Directory `backend`):

  ```bash
  git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ../package.json ../package-lock.json
  ```

The command is the same text in both projects; it compares only that project's folder and the shared root
`package.json` / `package-lock.json`. To force a build anyway, use "Redeploy" in Vercel.
