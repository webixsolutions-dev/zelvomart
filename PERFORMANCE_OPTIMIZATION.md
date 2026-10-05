# Zelvomart performance optimization

This build keeps the separated architecture intact: Next.js frontend -> Express API -> Prisma -> Supabase PostgreSQL.

## What changed

- Next.js public data fetches use the Data Cache with timed revalidation and cache tags.
- Homepage/root layout now use one `/api/store/bootstrap` request for shared categories/settings instead of multiple settings requests.
- Public product/category/content pages use ISR-style revalidation instead of forcing every request to render dynamically.
- Checkout confirmation remains `no-store`; admin/auth/orders/events/reviews are never shared-cacheable.
- Backend public GET endpoints emit CDN cache headers with `stale-while-revalidate` and `stale-if-error`.
- Product list queries select only card/list fields instead of loading full descriptions, full variants and review bodies.
- Product/category hot-path database indexes were strengthened in `prisma/schema.prisma`.
- Admin product/category/page/settings/review changes can invalidate frontend cache tags immediately through `/api/revalidate`.
- Hero image now uses `next/image` with priority/fetchPriority for better LCP and AVIF/WebP optimization.
- Static `/images/*` assets receive a one-year immutable cache header.
- Meta Pixel now loads `afterInteractive`; Clarity loads `lazyOnload` so they do not block initial rendering.
- Backend Vercel compute is pinned to `hnd1` (Tokyo) to stay close to the current Supabase `ap-northeast-1` pooler. Vercel CDN still serves cached/static content globally.

## Required production env

Set the SAME strong secret in both Vercel projects:

Frontend:

```env
REVALIDATION_SECRET=<same-long-random-secret>
NEXT_PUBLIC_API_URL=https://zelvomart-backend.vercel.app
BACKEND_URL=https://zelvomart-backend.vercel.app
NEXT_PUBLIC_SITE_URL=https://zelvomart.vercel.app
```

Backend:

```env
REVALIDATION_SECRET=<same-long-random-secret>
FRONTEND_URL=https://zelvomart.vercel.app
```

Keep the existing `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` and integration variables.

## Database indexes

The Prisma schema contains new/expanded indexes for public product and review queries. Apply them once against production:

```bash
cd backend
npm run db:push
```

Use the configured Supabase session/direct connection for schema changes.

## Deployment order

1. Deploy frontend with `REVALIDATION_SECRET`.
2. Deploy backend with the same secret and `FRONTEND_URL`.
3. Run `npm run db:push` once to apply indexes.
4. Test `/api/health`, homepage, shop, a category, a product, checkout and admin login.
5. In Vercel response headers, repeated public requests should show cache activity while admin/auth/order endpoints remain `no-store`.

## Notes

- Vercel automatically scales/load-balances Functions inside the configured region. With a single primary Postgres database, keeping compute near the DB is preferable to spreading database-bound Functions across distant regions.
- If the Supabase project is later moved to another region, update `backend/vercel.json` and `frontend/app/layout.tsx` `preferredRegion` to the nearest Vercel region.
