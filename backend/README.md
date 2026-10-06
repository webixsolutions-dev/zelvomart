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
