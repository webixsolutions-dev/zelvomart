# Zelvomart Backend

Express + Prisma backend. All database, authentication, order, admin, email, tracking, upload and worker logic lives here.

Setup:

```bat
copy .env.example .env
npm install
npm run prisma:generate
npm run db:push
npm run seed
npm run dev
```

Frontend origin is controlled by `FRONTEND_URL`.

### Serverless background jobs (cron mode)

For a backend deployment without a persistent worker, the frontend and backend must share `STORE_PROXY_SECRET` (recommended) or the existing `REVALIDATION_SECRET`; the frontend uses it to pass a trusted visitor IP to the backend. Set `JOB_MODE=cron` and a separate long random `CRON_SECRET` on the backend. Configure cron-job.org to call `POST /api/cron/jobs` every minute and `POST /api/cron/daily` once daily with `Authorization: Bearer <CRON_SECRET>`. Do not run the persistent pg-boss worker at the same time in cron mode. The job route claims persisted rows atomically and retries failures on a later call.

For Vercel deploy this folder as a separate project. `api/index.ts` is the serverless entry and `vercel.json` rewrites `/api/*` to it.

## Storefront customer accounts
The storefront now uses database-backed `StoreUser` + `StoreSession` records. After pulling this version, apply the Prisma schema before starting the backend:

```bash
npm run prisma:generate
npm run db:push
```

`STORE_SESSION_DAYS` controls persistent customer session lifetime and defaults to 30 days.

Quick setup after `npm install`:

```bash
npm run setup
npm run dev
```
