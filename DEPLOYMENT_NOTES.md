# Zelvomart deployment notes

Read-only review of this repo. No application process was started and no database command was run.

Secret values from `.env` files are not copied here. Only variable names, where they are read, and production placeholders are listed.

Where a claim is not proven by the files, it is marked **UNCERTAIN**.

---

## 1. Repo structure

npm workspaces monorepo. There is no Turborepo config (`turbo.json` is absent; `.turbo/` is only gitignored).

| Path | Role |
| --- | --- |
| `package.json` | Workspace root. Workspaces: `frontend`, `backend` (`package.json` lines 3–4). |
| `frontend/` | Next.js storefront and admin UI, plus same-origin `/api/*` proxy routes. |
| `backend/` | Express 5 API, Prisma schema, seed, and a separate pg-boss worker. |
| `backend/src/server.ts` | HTTP entry. |
| `backend/workers/main.ts` | Long-running job worker. Not started by the web process. |
| `backend/prisma/schema.prisma` | PostgreSQL schema. |
| `backend/api/index.ts` | Re-exports the Express app. `backend/vercel.json` does not use this file; it points at `src/server.ts`. |

Package manager: **npm**. Evidence: root `package-lock.json`, `backend/package-lock.json`, and `npm run --workspace` scripts. No `pnpm-lock.yaml` or `yarn.lock`.

Node version: **no `engines` field, no `.nvmrc`, no `.node-version`**. Next.js 16 needs Node.js 20.9 or newer. **UNCERTAIN** which exact Node version production should pin; use 20 LTS or 22 LTS.

| App | Framework (from `package.json`) |
| --- | --- |
| Frontend | `next` `^16.0.0`, `react` `^19.2.0` (`frontend/package.json` lines 17–19) |
| Backend | `express` `^5.1.0`, `@prisma/client` `^6.19.3`, `pg-boss` `^10.3.2` (`backend/package.json` lines 25–37) |

The backend is a **standalone Express server**. It is not implemented as Next.js API routes. The frontend still has its own Next.js route handlers, and those handlers proxy to Express. Both exist.

`README.md` lines 33–35 say the frontend has no Next.js API routes. That sentence is stale. The routes under `frontend/app/api/` are real.

---

## 2. How the frontend talks to the backend

There is no `frontend/middleware.ts`. `frontend/next.config.ts` has no general `/api` rewrite. It only rewrites two paths, at lines 38–43:

- `/feeds/meta.xml` → `{BACKEND_URL or NEXT_PUBLIC_API_URL or http://localhost:4000}/api/feed/meta.xml`
- `/uploads/:path*` → `{same base}/uploads/:path*`

That fallback to `http://localhost:4000` is used even when `NODE_ENV` is production.

### Admin login flow

1. Browser `POST /api/admin-session/login` from `frontend/app/admin/login/page.tsx` lines 37–42. Same origin. `credentials: 'same-origin'`. Body is JSON `{ email, password }`.
2. `frontend/app/api/admin-session/login/route.ts` line 3 picks the backend:

```text
BACKEND_URL || NEXT_PUBLIC_API_URL || "http://localhost:4000"
```

This fallback to localhost is used in production too. Unlike the admin proxy, this route does not drop a URL that equals the frontend origin.

3. Line 11: server-side `POST {base}/api/auth/login` with only `content-type: application/json`. It does **not** forward `Origin`, cookies, or `Authorization`.
4. Network failure is caught and returned as **503** `{ error: "BACKEND_UNAVAILABLE" }` (lines 17–18).
5. If the upstream status is not OK, or the JSON has no `token`, the upstream status and body are returned as-is (lines 22–23). An upstream **500** stays **500**.
6. On success, the JWT is stored in an httpOnly cookie and the browser only receives `{ user }` (lines 26–33). The token is not put in `localStorage` by this route.

Cookie written by the login route (lines 27–33):

| Attribute | Value |
| --- | --- |
| Name | `zelvomart_admin_session` |
| httpOnly | `true` |
| sameSite | `lax` |
| secure | `true` only when `NODE_ENV === "production"` |
| path | `/` |
| maxAge | `60 * 60 * 8` (8 hours) |
| domain | **not set** (host-only cookie on the frontend host) |

Logout (`frontend/app/api/admin-session/logout/route.ts` lines 6–12) clears that cookie with the same flags and `maxAge: 0`.

The Express login handler (`backend/src/server.ts` lines 795–805) does **not** set a cookie. It returns `{ token, user }`. The token is a JWT signed in `backend/src/lib/auth.ts` lines 15–17 (`expiresIn: "8h"`, issuer `zelvomart-backend`, audience `zelvomart-admin`). Verification uses `Authorization: Bearer` only (`auth.ts` lines 23–27). There is no admin session cookie on the backend.

### `/api/admin-proxy/[...path]` and `/api/admin-proxy/api/auth/me`

File: `frontend/app/api/admin-proxy/[...path]/route.ts`.

1. Reads cookie `zelvomart_admin_session` (lines 18–20). **If the cookie is missing, it returns 401 `{ error: "UNAUTHORIZED" }` and never calls the backend.**
2. Backend candidates (lines 6–14): `BACKEND_URL`, then `NEXT_PUBLIC_API_URL`. `http://localhost:4000` is added only when `NODE_ENV !== "production"`. Any candidate equal to the frontend origin (`request.nextUrl.origin`) is removed.
3. If no candidate remains: **503** `{ error: "BACKEND_URL_NOT_CONFIGURED" }` (lines 25–29).
4. Forwards `GET/POST/PUT/PATCH/DELETE/HEAD` to `{base}/{path}{search}` with `Authorization: Bearer {cookie}` (lines 38–39). Also forwards `content-type`, `accept`, `user-agent`, `x-forwarded-for`, `x-real-ip`, `referer`, and **`origin`** (lines 41–53).
5. A URL such as `/api/admin-proxy/api/auth/me` becomes backend `GET /api/auth/me`.
6. Backend `GET /api/auth/me` (`server.ts` line 807) uses `requireAuth()`. Missing, expired, or invalid JWT → **401** `{ error: "UNAUTHORIZED" }` (`auth.ts` lines 27 and 34).

The login page calls this on mount (`frontend/app/admin/login/page.tsx` lines 22–25). A logged-out browser therefore gets **401** before anyone submits the form. That 401 is expected until login has set the cookie.

Admin UI calls go through `adminFetch()` in `frontend/lib/client-api.ts` lines 5–34, which prefixes `/api/admin-proxy` and uses `credentials: 'same-origin'`. A 401 clears the cookie and redirects to `/admin/login` (lines 19–24).

### Why production login can be 500 and `/auth/me` can be 401

These two statuses have different causes. The 401 is usually the result of the 500, not a second independent bug.

**Login 500**

`/api/admin-session/login` returns 500 when the upstream response status is 500 (route lines 22–23). A dead host, connection refused, or DNS failure is **503** `BACKEND_UNAVAILABLE`, not 500. So a real 500 means some HTTP server answered.

The backend turns almost every thrown exception into **500** `{ error: "SERVER_ERROR" }` (`server.ts` lines 1386–1388). Only Prisma codes `P1001` and `P1002` become 503. This app does not use Prisma’s Rust engine at runtime. `backend/src/lib/db.ts` lines 16–30 connect with `pg` `Pool` and `@prisma/adapter-pg`. A pool timeout, auth failure, or “prepared statement” error from Supabase’s transaction pooler is often a plain `Error`, so it becomes **500**, not 503.

Concrete 500 paths in code, in the order to check:

1. **Backend process or Vercel function crashes while handling login, or the DB call throws.** `POST /api/auth/login` (`server.ts` lines 795–804) always hits the database (`allowRequest` → `consumeRateLimit` in `backend/src/lib/rate-limit.ts` lines 13–15, then `prisma.user.findUnique`). If `DATABASE_URL` is missing, `db.ts` lines 7–8 throw at import time and the process never listens. On Vercel that is a function crash, which the platform returns as HTTP 500, and the Next route forwards it.
2. **`JWT_SECRET` and `AUTH_SECRET` are both unset, and the email/password were correct.** `signAdminToken` throws `"JWT_SECRET is not configured"` (`auth.ts` lines 9–12) after the password check (`server.ts` line 804). The error middleware returns 500. A wrong password is **401** `INVALID_CREDENTIALS`, not 500. A missing admin row is also 401.
3. **Schema was never applied**, so `User` or `RateLimitBucket` does not exist. Prisma then throws, and the error middleware returns 500. See section 4: `prisma migrate deploy` does not create the full schema.
4. **Less likely for this exact 500:** `BACKEND_URL` / `NEXT_PUBLIC_API_URL` missing. The login route then calls `http://localhost:4000` from the frontend host (route line 3). From Vercel that connection fails and the route returns **503**, not 500. If those variables are set to the **frontend** origin, `POST /api/auth/login` does not exist on Next.js, so the status is typically **404**, not 500.

CORS does not explain the login 500. The login proxy does not send `Origin`, and the CORS callback allows a missing origin (`server.ts` line 31).

**`/api/admin-proxy/api/auth/me` 401**

Most likely: the cookie was never set, because login did not return a token. The proxy returns 401 at `admin-proxy/[...path]/route.ts` lines 19–20 with no backend call. The login page always makes this request while logged out.

If login actually returned 200 and `/auth/me` is still 401:

- The backend rejected the Bearer token (`auth.ts` lines 27–34): bad signature, expired token, or `JWT_SECRET` changed between the two requests.
- The cookie was not stored. `secure: true` requires HTTPS. `sameSite: "lax"` is correct for this same-origin proxy. No `Domain` is required, because the backend never receives the cookie.

Cookie `Domain` / cross-site `SameSite=None` is **not** what makes admin login work. The JWT stays on the frontend host and is forwarded as a Bearer header.

After a successful login, later admin calls can still become **500** (not 401) if `FRONTEND_URL` does not include the production frontend origin. The proxy forwards the browser `Origin` (admin-proxy lines 52–53). The CORS callback then calls `cb(new Error('CORS_NOT_ALLOWED'))` (`server.ts` line 31), and the error middleware turns that into 500.

### Frontend route → backend endpoint

| Frontend route / caller | Backend endpoint | Method | Auth |
| --- | --- | --- | --- |
| `frontend/app/api/admin-session/login/route.ts` | `/api/auth/login` | POST | None. Rate limit `admin-login` 8 / 15 min (`server.ts` line 798). |
| `frontend/app/api/admin-session/logout/route.ts` | none | POST | Clears the frontend cookie only. |
| `frontend/app/api/admin-proxy/[...path]/route.ts` | whatever path follows `/api/admin-proxy` (example: `/api/auth/me`, `/api/admin/*`) | same as browser | Cookie required, then `Authorization: Bearer`. Backend `requireAuth` adds permission checks. |
| `frontend/app/api/store-proxy/[...path]/route.ts` | only paths in `SAFE_PREFIXES` (lines 3–11): `/api/events`, `/api/session-replays/*`, `/api/contact`, `/api/reviews`, `/api/orders`, `/api/orders/*`, `/api/checkout/*`, `/api/experiments/*` | same as browser | No admin cookie. No Bearer added. |
| `frontend/app/api/account/login/route.ts` | `/api/customer-auth/login` via `customerAuthFetch` | POST | None. Sets cookie `zelvo_store_session`. |
| `frontend/app/api/account/signup/route.ts` | `/api/customer-auth/signup` | POST | None. Sets `zelvo_store_session`. |
| `frontend/app/api/account/logout/route.ts` | `/api/customer-auth/logout` | POST | Bearer from `zelvo_store_session`, then deletes the cookie. |
| `frontend/app/api/account/me/route.ts` | `/api/customer-auth/me` | GET | Bearer from `zelvo_store_session`. Missing cookie → 401 before the backend call. |
| `frontend/app/api/checkout-order/route.ts` | `/api/orders` | POST | None. Sets `zelvomart_order_confirmation`. **No UI caller found.** Current checkout uses the store proxy (`CheckoutClient.tsx` line 168). |
| `frontend/app/api/contact/route.ts` | `/api/contact` via `apiFetch` | POST | None. |
| `frontend/app/api/backend-health/route.ts` | `/api/health` | GET | None. Refuses a backend URL equal to the frontend origin. No localhost fallback. |
| `frontend/app/api/revalidate/route.ts` | none (Next cache) | POST | Header `x-revalidation-secret` must equal `REVALIDATION_SECRET`. |
| `frontend/lib/api.ts` `apiFetch` (server components: store, product, sitemap, CMS) | path passed in, for example `/api/store/bootstrap`, `/api/products`, `/api/pages/:slug`, `/api/seo/sitemap` | usually GET | None. Production throws if both backend URL env vars are empty (lines 5–7). No localhost fallback in production. |
| `frontend/lib/client-api.ts` line 43 when `auth` is false | `{NEXT_PUBLIC_API_URL or http://localhost:4000}{path}` **from the browser** | varies | None. Subject to CORS. |
| `frontend/components/TrackOrderClient.tsx` | `{API_BASE}/api/orders/track` from the browser | POST | None. CORS. |
| `frontend/components/ReviewForm.tsx` | `{API_BASE}/api/reviews` from the browser | POST | None. CORS. |
| `frontend/app/product-preview/page.tsx` | `{API_BASE}/api/settings/public` from the browser | GET | None. CORS. |
| `frontend/next.config.ts` rewrites | `/api/feed/meta.xml`, `/uploads/*` | GET | None. |

`API_BASE` is `NEXT_PUBLIC_API_URL` or `http://localhost:4000` even in production (`frontend/lib/client-api.ts` line 1). That value is inlined into the browser bundle at **build** time. Changing it in the host dashboard does nothing until the frontend is rebuilt.

Store customer cookie (`frontend/lib/account-server.ts` lines 3–4, set in the account login route lines 11–16):

| Attribute | Value |
| --- | --- |
| Name | `zelvo_store_session` |
| httpOnly | `true` |
| sameSite | `lax` |
| secure | production only |
| path | `/` |
| domain | not set |
| lifetime | backend `expiresAt`, else 30 days (`STORE_SESSION_MAX_AGE`) |

Order cookie (`checkout-order/route.ts` lines 4 and 45–50): name `zelvomart_order_confirmation`, httpOnly, sameSite `lax`, secure in production, path `/checkout/success`, maxAge 1 hour. The current checkout UI does not call this route.

---

## 3. Backend details

### Process model

- Entry: `backend/src/server.ts`.
- Loads `dotenv/config` (line 1). On a host that injects env vars, a missing file is fine.
- Port: `Number(process.env.PORT || 4000)` (line 29).
- Listens only when `process.env.VERCEL` is unset (line 1391): `app.listen(port)`.
- On Vercel it exports the Express app and does not listen (lines 1389–1391). `backend/vercel.json` builds `src/server.ts` with `@vercel/node` and sends every path to that file.
- Health: `GET /api/health` (line 360). Runs `SELECT 1`. `{ ok: true, version: "2.0.0" }` or **503** `{ ok: false, error: <exception message> }`. The failure body includes the raw error message even in production.

There is no WebSocket server. There is no in-process cron. Scheduled work lives only in `backend/workers/main.ts`, which must be a second always-on process.

The API enqueues jobs by calling `dispatchJobRow`, which starts pg-boss (`backend/src/lib/jobs.ts` lines 6–21). Consumers and schedules are registered only in the worker (`workers/main.ts` lines 271–275):

| Schedule | Cron | Work |
| --- | --- | --- |
| `daily-summary` | `0 4 * * *` | Email summary |
| `tracking-health-check` | `15 4 * * *` | Meta/order health alert |
| `abandoned-checkout-scan` | `*/15 * * * *` | Reads abandoned checkouts. Does not send messages. |
| `job-recovery` | `*/5 * * * *` | Re-dispatches stranded jobs |
| `rate-limit-cleanup` | `30 3 * * *` | Deletes old rate-limit rows |

Order placement also queues `order-team-email`, `customer-order-email`, and `meta-purchase` (`backend/src/lib/order.ts` lines 259–263). Browser events queue `meta-event` (`server.ts` lines 550–566). Status changes queue `customer-status-email` (`server.ts` line 934). If the worker is not running, those rows stay queued. Vercel serverless will not run `workers/main.ts`.

`bookPostExOrder` (`backend/src/lib/postex.ts` lines 6–21) is never called. PostEx is used only to build a tracking URL from a number an admin saves (`server.ts` lines 960–972).

### CORS

`server.ts` line 31:

- Allowed origins: comma-separated `FRONTEND_URL`, default `http://localhost:3000` (line 30).
- Missing `Origin` is allowed (server-to-server fetches).
- Any other origin becomes a CORS error, which the error handler returns as **500**.
- `credentials: false`.

Production `FRONTEND_URL` must be the exact browser origin, for example `https://<frontend-domain>` with no path and no trailing space. Add a second origin with a comma if both `www` and apex are used: `https://zelvomart.com,https://www.zelvomart.com`.

The local `backend/.env` currently sets `FRONTEND_URL` to a localhost value. That must change for production. Do not copy the local value into the host.

### Auth

- Admin JWT: HMAC via `jsonwebtoken`, secret `JWT_SECRET` or else `AUTH_SECRET` (`auth.ts` lines 9–16). Issuer `zelvomart-backend`, audience `zelvomart-admin`, 8 hours.
- Admin API auth is Bearer only. The frontend stores that JWT in `zelvomart_admin_session`.
- Login checks the `User` table with bcrypt (`server.ts` lines 795–800). It does **not** read `ADMIN_EMAIL` or `ADMIN_PASSWORD`.
- Those two variables are used only by `backend/prisma/seed.ts` lines 202–227, which upserts an `OWNER` user. The server does not seed on startup.
- `totp.ts` exists and the user row has `totpSecret` / `twoFactorReady`, but `POST /api/auth/login` never checks a second factor.
- Customer sessions are random tokens, SHA-256 hashed, stored in `StoreSession` (`server.ts` lines 251–269). The browser cookie holds the raw token; the API expects `Authorization: Bearer`.
- Login rate limit exists: 8 attempts per 15 minutes per IP + email (`server.ts` line 798). It is database-backed, so it fails closed as 500 if the rate-limit table or the database is down.

### Uploads, email, Meta

- Uploads: `POST /api/admin/upload` (auth `products.write`). Multer memory storage, 8 MB (`server.ts` line 28 and lines 1365–1383). Bytes go to Cloudflare R2 through the S3 API (`backend/src/lib/storage.ts`). Required: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`. Optional: `S3_REGION` (default `auto`), `S3_FORCE_PATH_STYLE`, `LOCAL_UPLOAD_DIR` (local static files only; `server.ts` line 32). There is no fallback upload to local disk when R2 is missing; the route returns 503 `STORAGE_NOT_CONFIGURED`.
- Email: Resend (`backend/src/lib/email.ts`). `RESEND_API_KEY` required to send. `EMAIL_FROM` optional (default `Zelvomart Orders <orders@zelvomart.com>`). `ORDER_ALERT_RECIPIENTS` optional (default `zelvomart@gmail.com`, line 28). Actual sending of order mail happens in the worker.
- Meta Pixel / CAPI: `META_CAPI_TOKEN` required for server events (`backend/src/lib/meta.ts` lines 33–34). Pixel id from the settings table, else `META_PIXEL_ID`, else `NEXT_PUBLIC_META_PIXEL_ID`, else hardcoded `1645715973642563` (line 30). `META_TEST_EVENT_CODE` is sent only when `APP_ENV=staging` (lines 67–68). Marketing API (`backend/src/lib/meta-marketing.ts`): `META_MARKETING_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`, `META_INSTAGRAM_ACCOUNT_ID`, `META_GRAPH_VERSION` (default `v23.0`). Tokens can also be stored in settings by an admin.
- Cache busting: backend `POST`s to `{first FRONTEND_URL}/api/revalidate` with header `x-revalidation-secret` (`backend/src/lib/cache-invalidation.ts` lines 19–36). Needs `REVALIDATION_SECRET` and `FRONTEND_URL`. Failures are ignored outside development.

### All Express routes

Controller logic is inline in `backend/src/server.ts` unless noted. `requireAuth()` with no argument means any valid admin JWT.

| Method | Path | Auth | Line |
| --- | --- | --- | --- |
| GET | `/api/health` | none | 360 |
| POST | `/api/contact` | rate limit | 362 |
| GET | `/api/store/bootstrap` | none | 387 |
| GET | `/api/categories` | none | 396 |
| GET | `/api/products` | none | 402 |
| GET | `/api/products/slug/:slug` | none | 437 |
| GET | `/api/pages/:slug` | none | 438 |
| GET | `/api/settings/public` | none | 439 |
| GET | `/api/cities` | none | 440 |
| GET | `/api/seo/sitemap` | none | 441 |
| GET | `/api/redirects/resolve` | none | 442 |
| GET | `/api/feed/meta.xml` | none | 443 |
| POST | `/api/orders` | rate limit | 493 |
| POST | `/api/orders/track` | rate limit | 501 |
| GET | `/api/orders/confirmation/:orderNumber` | query `key` must equal order id | 502 |
| POST | `/api/checkout/abandoned` | none | 511 |
| POST | `/api/reviews` | rate limit | 512 |
| POST | `/api/events` | rate limit; bots ignored | 525 |
| GET | `/api/experiments/active` | none | 573 |
| POST | `/api/experiments/exposure` | none | 597 |
| POST | `/api/session-replays/start` | none | 612 |
| POST | `/api/session-replays/chunk` | none | 649 |
| POST | `/api/session-replays/end` | none | 747 |
| POST | `/api/customer-auth/signup` | rate limit | 756 |
| POST | `/api/customer-auth/login` | rate limit | 773 |
| GET | `/api/customer-auth/me` | customer Bearer | 783 |
| POST | `/api/customer-auth/logout` | customer Bearer | 789 |
| POST | `/api/auth/login` | rate limit | 795 |
| GET | `/api/auth/me` | `requireAuth()` | 807 |
| GET | `/api/admin/dashboard` | `orders.read` | 809 |
| GET | `/api/admin/products` | `products.write` | 826 |
| GET | `/api/admin/products/:id` | `products.write` | 827 |
| POST | `/api/admin/products` | `products.write` | 828 |
| PATCH | `/api/admin/products/:id` | `products.write` | 849 |
| DELETE | `/api/admin/products/:id` | `products.write` | 878 |
| POST | `/api/admin/products/:id/variants` | `products.write` | 896 |
| DELETE | `/api/admin/variants/:id` | `products.write` | 907 |
| GET | `/api/admin/categories` | `products.write` | 909 |
| POST | `/api/admin/categories` | `products.write` | 910 |
| PATCH | `/api/admin/categories/:id` | `products.write` | 911 |
| DELETE | `/api/admin/categories/:id` | `products.write` | 912 |
| GET | `/api/admin/orders` | `orders.read` | 914 |
| PATCH | `/api/admin/orders/bulk-status` | `orders.write` | 922 |
| GET | `/api/admin/orders/:id` | `orders.read` | 939 |
| PATCH | `/api/admin/orders/:id/status` | `orders.write` | 940 |
| PATCH | `/api/admin/orders/:id/tracking` | `orders.write` | 960 |
| GET | `/api/admin/customers` | `customers.read` | 975 |
| PATCH | `/api/admin/customers/:id/blocklist` | `customers.write` | 976 |
| GET | `/api/admin/pages` | `content.write` | 978 |
| POST | `/api/admin/pages` | `content.write` | 979 |
| PATCH | `/api/admin/pages/:id` | `content.write` | 980 |
| GET | `/api/admin/product-tabs` | `products.write` | 982 |
| PUT | `/api/admin/product-tabs` | `products.write` | 986 |
| GET | `/api/admin/settings` | `settings.write` | 994 |
| PUT | `/api/admin/settings` | `settings.write` | 995 |
| PUT | `/api/admin/cities` | `settings.write` | 996 |
| GET | `/api/admin/users` | `users.write` | 998 |
| POST | `/api/admin/users` | `users.write` | 999 |
| PATCH | `/api/admin/users/:id` | `users.write` | 1000 |
| GET | `/api/admin/reviews` | `content.write` | 1002 |
| PATCH | `/api/admin/reviews/:id` | `content.write` | 1003 |
| GET | `/api/admin/redirects` | `settings.write` | 1004 |
| POST | `/api/admin/redirects` | `settings.write` | 1005 |
| DELETE | `/api/admin/redirects/:id` | `settings.write` | 1006 |
| GET | `/api/admin/session-replays` | `reports.read` | 1007 |
| GET | `/api/admin/session-replays/:id` | `reports.read` | 1028 |
| DELETE | `/api/admin/session-replays/:id` | `reports.read` | 1048 |
| GET | `/api/admin/experiments` | `reports.read` | 1055 |
| POST | `/api/admin/experiments` | `content.write` | 1085 |
| PATCH | `/api/admin/experiments/:id` | `content.write` | 1090 |
| GET | `/api/admin/jobs` | `reports.read` | 1097 |
| GET | `/api/admin/tracking` | `reports.read` | 1098 |
| GET | `/api/admin/cro` | `reports.read` | 1123 |
| GET | `/api/admin/reports` | `reports.read` | 1163 |
| GET | `/api/admin/marketing` | `reports.read` | 1192 |
| PUT | `/api/admin/marketing/meta` | `settings.write` | 1213 |
| POST | `/api/admin/marketing/meta/test` | `settings.write` | 1227 |
| GET | `/api/admin/abandoned` | `customers.read` | 1229 |
| POST | `/api/admin/products/import` | `products.write` | 1233 |
| GET | `/api/admin/product-import/template/:kind` | `products.write` | 1301 |
| POST | `/api/admin/products/bulk-status` | `products.write` | 1307 |
| POST | `/api/admin/products/:id/images` | `products.write` | 1327 |
| GET | `/api/admin/products/export.csv` | `orders.export` | 1363 |
| GET | `/api/admin/orders/export.csv` | `orders.export` | 1364 |
| POST | `/api/admin/upload` | `products.write` | 1365 |
| GET | `/uploads/*` | none; local disk via `express.static` | 32 |

Express route order matters: `/api/admin/products/export.csv`, `/api/admin/products/import`, and `/api/admin/products/bulk-status` are registered **after** `/api/admin/products/:id`. **UNCERTAIN** whether Express 5 treats `export.csv` as an `:id`. If CSV export or import 404s in production, this registration order is the first place to check.

---

## 4. Database

- ORM: Prisma 6 with the client engine and the `pg` driver adapter (`schema.prisma` lines 1–12, `db.ts` lines 1–30).
- Provider: PostgreSQL.
- `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")` (`schema.prisma` lines 8–12).
- Runtime queries use `DATABASE_URL` only (`db.ts` line 6). `DIRECT_URL` is for Prisma CLI (`db push` / migrate), not for request traffic.
- Generated client output: `backend/src/generated/prisma` (committed).
- Migrations folder: only `backend/prisma/migrations/20261007_store_accounts/migration.sql`. That file creates `StoreUser` and `StoreSession` only. There is no `migration_lock.toml`.
- `SETUP_DATABASE.bat` lines 9–11 run `prisma generate`, `db push`, then `seed`. That is the path this repo actually uses.

Production commands, from `backend/` (or `npm run <script> --workspace backend` from the root):

```bash
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm run seed
```

`npm run db:migrate` is `prisma migrate dev` (`backend/package.json` line 11). That is a dev command. **Do not use `migrate dev` in production.** `prisma migrate deploy` will not create products, orders, users, or the rest of the schema, because those tables have no migration. Use `db push` unless you later add a baseline migration.

Seed **is required once** to create the admin user. `seed.ts` lines 202–227 create the owner only when both `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set. If they are missing, seed still writes pages, cities, and the order sequence, and login then returns 401 because no `User` row exists. Seed’s upsert **overwrites the owner password** on every run (lines 208–216). Do not run seed on every deploy.

### Pooling

`db.ts` opens a `pg` `Pool` with a 30s connect timeout, keep-alive, and SSL when `DATABASE_SSL=true` or the URL contains `supabase.co` (lines 11–21). Pool `max` is not set (`pg` default is 10).

`schema.prisma` has `directUrl`, which is correct for Prisma CLI against Supabase. Double-check both URLs:

- `DATABASE_URL`: runtime. For a long-running Node service, use the Supabase **session** pooler (pooler host, port **5432**, user `postgres.<project-ref>`).
- `DIRECT_URL`: Prisma `db push`. Same session pooler, or the direct host if the machine has IPv6. `VERCEL_DATABASE_FIX.md` says the direct host `db.<project-ref>.supabase.co:5432` is IPv6-only and fails from typical cloud builders.
- If you stay on the transaction pooler (port **6543**), `VERCEL_POOL_TIMEOUT_FIX.md` says the URL needs `pgbouncer=true`. Transaction mode rejects prepared statements. Whether `@prisma/adapter-pg` honors `pgbouncer=true` is **UNCERTAIN**; session mode avoids that question for a long-running server.
- Do not put `connection_limit=1` on a server that runs parallel queries. The pool-timeout note in `VERCEL_POOL_TIMEOUT_FIX.md` describes that failure.

`backend/scripts/validate-supabase-env.mjs` checks URL shape only. It reads `backend/.env` and can print connection errors. It does not need to be part of boot.

---

## 5. Environment variables

Local files found:

- `backend/.env` exists and is gitignored. Names below. Values are not copied.
- `backend/.env.example` is **missing**, even though `README.md` line 63 and `SETUP_DATABASE.bat` line 3 tell you to copy it.
- `frontend/.env.example` exists and is tracked.
- `frontend/.env` and `frontend/.env.local` are **missing** on this machine.

Local `backend/.env` shape (no values): `PORT` is `4000`, `APP_ENV` is `development`, `FRONTEND_URL` and `NEXT_PUBLIC_SITE_URL` are localhost. `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `REVALIDATION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, email, Meta pixel id, and R2 variables are non-empty. `RESEND_API_KEY`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`, `POSTEX_API_BASE_URL`, and `POSTEX_API_TOKEN` are **absent**. `POSTEX_TRACKING_BASE_URL` is listed twice.

Next.js inlines `process.env.NEXT_PUBLIC_*` and statically referenced server `process.env.*` at **build** time. Set frontend variables, then redeploy. Setting them after the build does not change an already built deployment.

### Frontend variables

| Variable | Used in | Required? | Purpose | Production placeholder | Must match the other app? |
| --- | --- | --- | --- | --- | --- |
| `BACKEND_URL` | `frontend/app/api/admin-session/login/route.ts:3`, `admin-proxy/[...path]/route.ts:7`, `store-proxy/[...path]/route.ts:14`, `backend-health/route.ts:5`, `checkout-order/route.ts:3`, `frontend/lib/api.ts:3`, `frontend/next.config.ts:39` | Required in production | Server-side origin of Express. No path. | `https://<backend-domain>` | Same origin as backend public URL. Not the frontend URL. |
| `NEXT_PUBLIC_API_URL` | same files as fallback; browser bundle `frontend/lib/client-api.ts:1` | Required | Browser calls (track order, reviews, product preview) and fallback if `BACKEND_URL` is empty. Example file sets `http://localhost:4000`. | `https://<backend-domain>` | Same value as `BACKEND_URL`. |
| `NEXT_PUBLIC_SITE_URL` | `frontend/app/layout.tsx:27`, `robots.ts:2`, `sitemap.ts:4`, product metadata. Example is `http://localhost:3000`. | Required | Canonical site URL. | `https://<frontend-domain>` | Should equal backend `NEXT_PUBLIC_SITE_URL` and the public site origin. |
| `REVALIDATION_SECRET` | `frontend/app/api/revalidate/route.ts:8` | Required if admin edits should refresh the storefront | Shared secret for cache invalidation. | long random string | **Must equal backend `REVALIDATION_SECRET`.** |
| `NEXT_PUBLIC_META_PIXEL_ID` | `frontend/app/layout.tsx:44`. Fallback hardcoded `1645715973642563`. | Optional | Browser pixel if settings have none. | pixel id | Should equal backend `META_PIXEL_ID`. |
| `NEXT_PUBLIC_CLARITY_ID` | `frontend/app/layout.tsx:45` | Optional | Microsoft Clarity. | clarity project id or empty | No. Settings key `tracking.clarityId` overrides it. |
| `NEXT_PUBLIC_IMAGE_HOSTS` | `frontend/next.config.ts:24` | Optional | Extra `next/image` hostnames, comma-separated. | `cdn.example.com` | No. Must be hostnames only, not URLs. |
| `NEXT_PUBLIC_SESSION_REPLAY_ENABLED` | `frontend/lib/session-replay-client.ts:88` | Optional | Set `false` to disable recording. Default is enabled. | `true` or `false` | No. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `frontend/.env.example:6` and `README.md` only | Unused by code | Documented but never read. UI hardcodes `923002026711` in `frontend/components/FloatingWhatsApp.tsx:7`. | n/a | No. |
| `NODE_ENV` | cookie `secure` flags | Set by the host | `production` turns on `Secure` cookies. | `production` | No. |

Change these for production if they are still localhost: `BACKEND_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`.

### Backend variables

| Variable | Used in | Required? | Purpose | Production placeholder | Must match? |
| --- | --- | --- | --- | --- | --- |
| `PORT` | `backend/src/server.ts:29` | Optional | Listen port. Default 4000. Hosts usually inject this. | `4000` or the host’s `PORT` | No. |
| `FRONTEND_URL` | `server.ts:30` CORS; `cache-invalidation.ts:21` | Required | Comma-separated browser origins allowed by CORS, and the revalidate target. Local file is localhost. | `https://<frontend-domain>` | Must be the frontend origin (`NEXT_PUBLIC_SITE_URL` without a path). |
| `DATABASE_URL` | `db.ts:6`, `jobs.ts:8`, Prisma schema | Required | Runtime Postgres URL. | `postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres` | No. Never put this on the frontend. |
| `DIRECT_URL` | `schema.prisma:11` | Required for Prisma CLI | Direct/session URL for `db push`. | session pooler or direct Postgres URL | No. |
| `DATABASE_SSL` | `db.ts:12` | Optional | Force SSL. Supabase URLs already enable SSL. | `true` if the host is not Supabase and still needs SSL | No. |
| `JWT_SECRET` | `auth.ts:10` | Required | Signs and verifies admin JWTs. | long random string, 32+ bytes | Backend only. Do not copy it to the frontend. `AUTH_SECRET` is used only if `JWT_SECRET` is empty. |
| `AUTH_SECRET` | `auth.ts:10` | Optional alias | Same as `JWT_SECRET`. Not in the local `.env`. | leave unset if `JWT_SECRET` is set | No. |
| `REVALIDATION_SECRET` | `cache-invalidation.ts:20` | Required for instant storefront refresh | Sent to the frontend revalidate route. | same long random string as the frontend | **Must equal frontend `REVALIDATION_SECRET`.** |
| `ADMIN_EMAIL` | `prisma/seed.ts:202` | Required for the first seed | Owner email. Not checked at login. | `owner@<your-domain>` | No. |
| `ADMIN_PASSWORD` | `prisma/seed.ts:203` | Required for the first seed | Owner password, hashed by seed. README example is `ChangeMe123!`. | a unique password, 12+ characters | No. |
| `APP_ENV` | `server.ts:1120`, `meta.ts:67` | Optional | Local file is `development`. Use `production`. `staging` enables Meta test events. | `production` | No. |
| `NEXT_PUBLIC_SITE_URL` | `server.ts:75`, `server.ts:446` feed links, `email.ts`, `workers/main.ts:86` | Required | Links in email, redirects, and the product feed. Local file is localhost. | `https://<frontend-domain>` | Same public origin as frontend `NEXT_PUBLIC_SITE_URL`. |
| `RESEND_API_KEY` | `email.ts:7`, `workers/main.ts:117` | Required to send mail | Resend API key. **Missing from local `.env`.** | `re_<resend-key>` | No. |
| `EMAIL_FROM` | `email.ts:76` and other senders | Optional | From address. Default `Zelvomart Orders <orders@zelvomart.com>`. | `Zelvomart Orders <orders@<your-domain>>` | No. Domain must be verified in Resend. |
| `ORDER_ALERT_RECIPIENTS` | `email.ts:28` | Optional | Comma-separated alert inbox. Default `zelvomart@gmail.com`. | `ops@<your-domain>` | No. |
| `META_PIXEL_ID` | `meta.ts:30`, `meta-marketing.ts:21` | Optional if set in admin settings | Server pixel id. | same id as the frontend pixel | Should match `NEXT_PUBLIC_META_PIXEL_ID`. |
| `META_CAPI_TOKEN` | `meta.ts:33` | Required for CAPI | Conversions API token. **Missing from local `.env`.** | Meta CAPI token | No. |
| `META_TEST_EVENT_CODE` | `meta.ts:67` | Optional | Used when `APP_ENV=staging`. **Missing locally.** | test event code or unset | No. |
| `META_GRAPH_VERSION` | `meta-marketing.ts:3` | Optional | Default `v23.0`. | `v23.0` | No. |
| `META_MARKETING_ACCESS_TOKEN` | `meta-marketing.ts:33` | Optional | Ads API. Can be saved in settings instead. | Meta token or unset | No. |
| `META_AD_ACCOUNT_ID` | `meta-marketing.ts:22` | Optional | Ads account. | `act_<id>` or unset | No. |
| `META_PAGE_ID` | `meta-marketing.ts:23` | Optional | Facebook page. | page id or unset | No. |
| `META_INSTAGRAM_ACCOUNT_ID` | `meta-marketing.ts:24` | Optional | Instagram account. | id or unset | No. |
| `NEXT_PUBLIC_META_PIXEL_ID` | `meta.ts:30` backend fallback | Optional | Not needed on the backend if `META_PIXEL_ID` is set. | same pixel id | See pixel row. |
| `S3_ENDPOINT` | `storage.ts:10` | Required for uploads | R2 S3 endpoint. | `https://<account-id>.r2.cloudflarestorage.com` | No. |
| `S3_REGION` | `storage.ts:65` | Optional | Default `auto`. | `auto` | No. |
| `S3_BUCKET` | `storage.ts:10` | Required for uploads | Bucket name. | `<bucket-name>` | No. |
| `S3_ACCESS_KEY_ID` | `storage.ts:10` | Required for uploads | R2 access key. | R2 access key id | No. |
| `S3_SECRET_ACCESS_KEY` | `storage.ts:10` | Required for uploads | R2 secret. | R2 secret | No. |
| `S3_PUBLIC_BASE_URL` | `storage.ts:10` | Required for uploads | Public base URL returned to the admin UI. No trailing path required. | `https://<public-r2-host>` | Hostname should be allowed by `next.config.ts` `images.remotePatterns` (already allows `*.r2.dev`). |
| `S3_FORCE_PATH_STYLE` | `storage.ts:62` | Optional | `true` / `false`. R2 is detected from the endpoint host. | unset | No. |
| `LOCAL_UPLOAD_DIR` | `storage.ts:19` | Optional | Local `/uploads` directory. Default `<cwd>/uploads`. Ephemeral on serverless. | unset on a host with R2 | No. |
| `POSTEX_TRACKING_BASE_URL` | `postex.ts:2` | Optional | Default `https://postex.pk/tracking`. | `https://postex.pk/tracking` | No. |
| `POSTEX_API_BASE_URL` | `postex.ts:7` | Unused at runtime | Read only by `bookPostExOrder`, which nothing calls. **Missing locally.** | `https://<postex-api-host>` | No. |
| `POSTEX_API_TOKEN` | `postex.ts:7` | Unused at runtime | Same as above. | PostEx token | No. |
| `STORE_SESSION_DAYS` | `server.ts:252` | Optional | Customer session length, clamped 1–90. Default 30. | `30` | No. |
| `SESSION_REPLAY_RETENTION_DAYS` | `server.ts:351` | Optional | Default 30. | `30` | No. |
| `NODE_ENV` | error messages, Prisma log level | Set by the host | `production` hides 500 error messages (`server.ts` line 1388). | `production` | No. |
| `VERCEL` | `server.ts:1391` | Set by Vercel only | When set, Express does not call `listen`. | do not set this on Render/Railway/Fly | No. |

Script-only (not needed for the running API): `SOURCE_STORE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, `MIGRATE_PAST_ORDERS` (`backend/scripts/migrate-wordpress.ts`), `WP_SITEMAP_URL` (`backend/scripts/migration/export-wordpress-urls.ts`).

### In code, missing from local `backend/.env`

`RESEND_API_KEY`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`, `POSTEX_API_BASE_URL`, `POSTEX_API_TOKEN`, `AUTH_SECRET`, `DATABASE_SSL`, `S3_FORCE_PATH_STYLE`, `LOCAL_UPLOAD_DIR`, `META_MARKETING_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`, `META_INSTAGRAM_ACCOUNT_ID`, `NEXT_PUBLIC_META_PIXEL_ID`.

### In local `backend/.env`, and used

Every name in that file is referenced. `POSTEX_TRACKING_BASE_URL` is duplicated. Nothing in the file is dead.

### In `frontend/.env.example`, unused by code

`NEXT_PUBLIC_WHATSAPP_NUMBER`.

---

## 6. Build and run scripts

Root `package.json`:

| Script | Command |
| --- | --- |
| `dev` | both apps via `concurrently` |
| `build` | backend build, then frontend build |
| `build:backend` / `build:frontend` | workspace builds |
| `seed` | `npm run seed --workspace backend` |
| `worker` | `npm run worker --workspace backend` |

There is **no root `start` script**.

Backend (`backend/package.json`):

| Script | Command |
| --- | --- |
| `dev` | `prisma generate` then `tsx watch src/server.ts` |
| `build` | `prisma generate --schema=prisma/schema.prisma && tsc -p tsconfig.json` |
| `start` | `node dist/src/server.js` |
| `seed` | `tsx prisma/seed.ts` |
| `worker` | `tsx workers/main.ts` |
| `postinstall` | `prisma generate` |

TypeScript `rootDir` is `.` and `outDir` is `dist` (`backend/tsconfig.json` lines 6–7), so the compiled entry is `dist/src/server.js`, not `dist/server.js`. `workers/` and `prisma/seed.ts` are excluded from `tsc` (line 14). The worker stays on `tsx`.

`tsx`, `typescript`, and `prisma` are **devDependencies** (`backend/package.json` lines 45–48). A production install that omits devDependencies can still **run** `node dist/src/server.js` after a build, but it cannot run `npm run worker` or `npm run seed` unless `tsx` is installed. Build must happen while `prisma` and `typescript` are installed.

Frontend:

| Script | Command |
| --- | --- |
| `dev` | `next dev` |
| `build` | `prebuild` cleans stale files, then `next build` |
| `start` | `next start` |

### Production commands

Backend web, from `backend/` (or with Root Directory = `backend`):

```bash
npm install --include=dev
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm run build
npm start
```

`npm start` runs `node dist/src/server.js`.

One-time admin user, with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set:

```bash
npm run seed
```

Worker, second service, same env, same root:

```bash
npm install --include=dev
npx prisma generate --schema=prisma/schema.prisma
npm run worker
```

Frontend, Root Directory = `frontend` (Vercel does this):

```bash
npm install
npm run build
npm start
```

From the monorepo root the equivalents are `npm run build:backend`, `npm run start --workspace backend`, `npm run build:frontend`, and `npm run start --workspace frontend`.

---

## 7. Existing deployment config

| File | What it says |
| --- | --- |
| `backend/vercel.json` | Vercel legacy build. Region `iad1`. `@vercel/node` compiles `src/server.ts` and routes `/(.*)` to it. Includes `prisma/**` and `src/generated/prisma/**`. This is a serverless Express app, not `npm start`. |
| `frontend/vercel.json` | absent |
| `render.yaml`, `railway.toml`, `fly.toml`, `netlify.toml`, `Dockerfile`, `docker-compose.yml`, `Procfile` | absent |
| `.github/workflows` | absent |
| `.vercel/` | gitignored. Not inspected as a deployment source of truth. |

`PERFORMANCE_OPTIMIZATION.md` lines 18–30 say the backend was aimed at Vercel region `hnd1` and the URLs `https://zelvomart-backend.vercel.app` and `https://zelvomart.vercel.app`. The committed `backend/vercel.json` region is **`iad1`**, not `hnd1`. Those hostnames are documentation, not proof of a live deployment. **UNCERTAIN** whether those Vercel projects still exist; this review did not call them.

`README.md` lines 104–150 also say “two Vercel projects”, frontend root `frontend`, backend root `backend`.

Git:

- Remote `origin`: `https://github.com/webixsolutions-dev/zelvomart.git` (fetch and push).
- Current branch: `minha`, tracking `origin/minha`.
- Other branches: local `main`, `origin/main`, `origin/HEAD` → `origin/main`.
- `git ls-files` shows `frontend/.env.example` and `frontend/next-env.d.ts`. It does **not** show `backend/.env`, `frontend/.env`, or `frontend/.env.local`.
- `git log --all` for `backend/.env`, `frontend/.env`, `frontend/.env.local`, and `.env` returned **no commits**. Those secret files are not in git history. No rotation is required because of git history.
- `backend/.env` is present on disk and ignored by `.gitignore` lines 12–14 (`.env` and `.env.*`, with `!.env.example`). Do not commit it.

---

## 8. Deployment plan

### Where to run the backend

Run the API as a **long-running Node service** on Render, Railway, or Fly.io, plus a **second service** for `npm run worker`.

Vercel is a poor fit even though `backend/vercel.json` exists:

- `listen()` is skipped when `VERCEL` is set, so the app only works as a serverless function.
- pg-boss schedules in `workers/main.ts` never start on Vercel.
- Order email and Meta CAPI are queued for that worker (`order.ts` lines 259–263).
- A `pg` pool inside short-lived functions fights Supabase’s pooler (see `VERCEL_DATABASE_FIX.md` and `VERCEL_POOL_TIMEOUT_FIX.md`).
- Local `/uploads` disks are ephemeral. R2 avoids that, but only when the S3 variables are set on that host.

Render is the straightforward choice: one web service, one worker, a health check, and `PORT` injected automatically. Railway or Fly.io are the same shape. A single VPS with two processes is also fine.

Keep the **frontend on Vercel** (Next.js 16). Root directory `frontend`.

Do not point `BACKEND_URL` at the Vercel frontend URL.

### a) Backend service

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Environment | Node 20 or 22 |
| Build | `npm install --include=dev && npx prisma generate --schema=prisma/schema.prisma && npx prisma db push --schema=prisma/schema.prisma && npm run build` |
| Start | `npm start` which is `node dist/src/server.js` |
| Port | host `PORT` (code falls back to 4000) |
| Health check | `GET /api/health` — success JSON has `"ok": true`. Treat 503 as unhealthy. |

Worker service: same root, same env, build `npm install --include=dev && npx prisma generate --schema=prisma/schema.prisma`, start `npm run worker`. No public HTTP port required. Do not set `VERCEL` on either service.

Run `npm run seed` once after the first successful `db push`, not on every boot.

### b) Backend env names and placeholders

Set these on the web service and the worker:

```text
NODE_ENV=production
APP_ENV=production
PORT=4000
FRONTEND_URL=https://<frontend-domain>
NEXT_PUBLIC_SITE_URL=https://<frontend-domain>
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres
DIRECT_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres
JWT_SECRET=<long-random-string>
REVALIDATION_SECRET=<same-long-random-string-as-frontend>
ADMIN_EMAIL=owner@<your-domain>
ADMIN_PASSWORD=<unique-password>
RESEND_API_KEY=re_<resend-key>
EMAIL_FROM=Zelvomart Orders <orders@<your-domain>>
ORDER_ALERT_RECIPIENTS=ops@<your-domain>
META_PIXEL_ID=<pixel-id>
META_CAPI_TOKEN=<meta-capi-token>
META_GRAPH_VERSION=v23.0
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY_ID=<r2-access-key-id>
S3_SECRET_ACCESS_KEY=<r2-secret>
S3_PUBLIC_BASE_URL=https://<public-r2-host>
POSTEX_TRACKING_BASE_URL=https://postex.pk/tracking
STORE_SESSION_DAYS=30
SESSION_REPLAY_RETENTION_DAYS=30
```

Optional: `META_TEST_EVENT_CODE` (only if `APP_ENV=staging`), `META_MARKETING_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID`, `META_INSTAGRAM_ACCOUNT_ID`, `DATABASE_SSL=true`, `POSTEX_API_BASE_URL`, `POSTEX_API_TOKEN`.

Leave `AUTH_SECRET` unset when `JWT_SECRET` is set.

### c) Frontend (Vercel)

Root directory: `frontend`. Framework preset: Next.js. Build `npm run build` or `next build`. Do not add `DATABASE_URL`, `JWT_SECRET`, Resend, R2, or Meta CAPI secrets.

```text
BACKEND_URL=https://<backend-domain>
NEXT_PUBLIC_API_URL=https://<backend-domain>
NEXT_PUBLIC_SITE_URL=https://<frontend-domain>
REVALIDATION_SECRET=<same-long-random-string-as-backend>
NEXT_PUBLIC_META_PIXEL_ID=<pixel-id>
NEXT_PUBLIC_CLARITY_ID=
NEXT_PUBLIC_IMAGE_HOSTS=
NEXT_PUBLIC_SESSION_REPLAY_ENABLED=true
```

Then **redeploy** the frontend. `NEXT_PUBLIC_API_URL` and the server routes that read `BACKEND_URL` are fixed at build time.

`BACKEND_URL` must not be `http://localhost:4000` and must not be the frontend’s own origin. The admin proxy deletes a candidate that equals its own origin and then returns 503.

### d) CORS and cookies

Frontend and backend on different hosts is already how this app is built.

- Set backend `FRONTEND_URL` to the exact frontend origin. Include `https://www...` as a second comma-separated origin if you use both.
- Do not set cookie `Domain` to the backend host. Admin and customer cookies are set by Next.js on the frontend host.
- Keep `sameSite: "lax"` and `secure: true` in production. Both are already what the login route does when `NODE_ENV=production`.
- Do not switch the backend to `credentials: true` unless you also change the code. Admin auth does not use a cross-site cookie.
- Browser calls that skip the proxy (`TrackOrderClient`, `ReviewForm`, product preview) need the frontend origin in `FRONTEND_URL`, because the browser sends `Origin`.

### e) How to verify

Replace the hosts. Do not paste real passwords into shell history on a shared machine if you can avoid it.

Health, from anywhere:

```bash
curl -sS -D - https://<backend-domain>/api/health
```

Expect HTTP 200 and `"ok": true`. HTTP 503 with `DB_UNAVAILABLE` or a connection error means `DATABASE_URL` / pooler / SSL, not the frontend.

Login, direct to Express:

```bash
curl -sS -D - https://<backend-domain>/api/auth/login \
  -H "content-type: application/json" \
  -d "{\"email\":\"owner@<your-domain>\",\"password\":\"<the-seed-password>\"}"
```

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `token` and `user` | Credentials, database, and `JWT_SECRET` are fine. |
| 401 | `INVALID_CREDENTIALS` | No matching active user, or wrong password. Seed did not run or `ADMIN_EMAIL` differs. |
| 429 | `RATE_LIMITED` | 8 attempts / 15 min. Wait. |
| 500 | `SERVER_ERROR` | Exception after the route started. Check backend logs for `JWT_SECRET is not configured` or a Postgres error. |
| 503 | `DATABASE_UNAVAILABLE` | Prisma `P1001` / `P1002` only. |

Then:

```bash
curl -sS -D - https://<backend-domain>/api/auth/me \
  -H "authorization: Bearer <token-from-login>"
```

Expect 200 `{ "user": ... }`. 401 here means the token was not the Bearer value, or `JWT_SECRET` does not match the signer.

Through the frontend:

```bash
curl -sS -D - https://<frontend-domain>/api/admin-session/login \
  -H "content-type: application/json" \
  -d "{\"email\":\"owner@<your-domain>\",\"password\":\"<the-seed-password>\"}"
```

Expect 200 and `Set-Cookie: zelvomart_admin_session=...; HttpOnly; Secure; SameSite=Lax; Path=/`. Then send that cookie:

```bash
curl -sS -D - https://<frontend-domain>/api/admin-proxy/api/auth/me \
  -H "cookie: zelvomart_admin_session=<cookie-value>"
```

Expect 200. Without the cookie, 401 is the proxy’s own response.

Also:

```bash
curl -sS https://<frontend-domain>/api/backend-health
```

Expect the same `ok: true` payload. `BACKEND_URL_NOT_CONFIGURED` means the frontend build has no usable backend URL.

Logs:

- Vercel (frontend): the login function log should show either a proxied status or `BACKEND_UNAVAILABLE`. A 500 response whose JSON is `{ "error": "SERVER_ERROR" }` came from Express, not from Next failing to find an env var (that path is 503).
- Backend: the error middleware prints the exception (`server.ts` line 1388) before returning 500. Look for `JWT_SECRET is not configured`, `DATABASE_URL is not configured`, Prisma error codes, or `pg` timeouts. Worker logs should contain `Zelvomart worker is running.` (`workers/main.ts` line 277).

---

## Troubleshooting

Ordered for the pair “`POST /api/admin-session/login` is 500” and “`GET /api/admin-proxy/api/auth/me` is 401”.

1. **The 401 is the logged-out proxy, because login never set the cookie.** `admin-proxy` lines 19–20 return 401 when `zelvomart_admin_session` is absent. The login page requests `/api/auth/me` on every visit (`login/page.tsx` lines 22–25). Fix the login 500 first. Confirm with the `Set-Cookie` check above. This is the likely explanation of the 401.

2. **Express caught an exception and the Next route forwarded status 500.** Read the login response body.
   - `{ "error": "SERVER_ERROR" }` → backend logs.
   - `{ "error": "BACKEND_UNAVAILABLE" }` with status 503 → the frontend cannot open a TCP connection. `BACKEND_URL` is missing, still `http://localhost:4000`, or the backend is down. The login route’s production fallback is localhost (`admin-session/login/route.ts` line 3).
   - `{ "error": "INVALID_CREDENTIALS" }` is 401, not this bug.
   - An HTML body or Vercel `FUNCTION_INVOCATION_FAILED` → the backend project on Vercel crashed at import. `db.ts` lines 7–8 throw if `DATABASE_URL` is missing. A bad Supabase host does the same during the first query.

3. **`JWT_SECRET` is unset on the backend that answered login.** That throw happens only after bcrypt succeeds (`auth.ts` lines 9–12, `server.ts` line 804). Logs will contain `JWT_SECRET is not configured`. Set one secret on the web service and redeploy. Do not also set a different `AUTH_SECRET`.

4. **Database URL is wrong for the host.** Direct `db.<ref>.supabase.co` often fails off IPv6 (`VERCEL_DATABASE_FIX.md`). Transaction pooler port 6543 without a session-mode URL can throw prepared-statement errors, which this error handler maps to 500 because they are not `P1001`/`P1002`. Point `DATABASE_URL` at the session pooler, redeploy, and require `GET /api/health` to return `ok: true` before testing login.

5. **Schema or admin user was never created.** `migrate deploy` does not build this schema. Run `prisma db push`, then `npm run seed` with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. A missing user is 401 `INVALID_CREDENTIALS`. A missing table is 500 `SERVER_ERROR`.

6. **`BACKEND_URL` is the frontend origin or an old Vercel backend URL that crashes.** `PERFORMANCE_OPTIMIZATION.md` documents `https://zelvomart-backend.vercel.app`. If that function crashes, login is 500. Put the new Render/Railway/Fly origin in both `BACKEND_URL` and `NEXT_PUBLIC_API_URL`, then redeploy the frontend.

7. **Only after login returns 200:** `/auth/me` 401 means the Bearer token failed `jwt.verify` (`auth.ts` lines 19–34). The cookie was not sent (`Secure` on an `http://` site, or a different host than the one that set it), or `JWT_SECRET` changed. Production Vercel is HTTPS, so `Secure` is correct there.

8. **After login works, other admin calls return 500.** `FRONTEND_URL` is still `http://localhost:3000` while the proxy forwards `Origin: https://<frontend-domain>` (`admin-proxy` lines 52–53, CORS at `server.ts` line 31). Set `FRONTEND_URL` to that origin and redeploy the backend.

---

## 9. Risks and fixes

| Issue | Evidence | What to do |
| --- | --- | --- |
| Default admin password published | `README.md` line 72: `ADMIN_PASSWORD=ChangeMe123!` | If seed was run with that password, change the user password in admin and rotate `ADMIN_PASSWORD`. Do not run seed again until the env password is a real one, because seed overwrites the owner hash. |
| `backend/.env` on disk | Present, gitignored. Not in `git ls-files`. No git history for `.env` paths. | Keep it untracked. No history rotation is required from this repo. |
| `backend/.env.example` missing | `README.md` line 63 and `SETUP_DATABASE.bat` line 3 refer to it. The file is not in the tree. | Add a template with placeholders only, when you next edit the repo. Not done in this review. |
| Login calls localhost if env is missing, including in production | `admin-session/login/route.ts` line 3 | Set `BACKEND_URL` and redeploy. A code fix would match `api.ts`, which refuses to fall back to localhost in production. |
| README denies that frontend API routes exist | `README.md` lines 33–35 | Ignore that paragraph. The proxy routes are required. |
| Backend on Vercel cannot run the worker | `vercel.json` plus `workers/main.ts` lines 271–277 | Run a worker service. Otherwise order email and CAPI stay queued. |
| CORS error becomes HTTP 500 | `server.ts` lines 31 and 1386–1388 | Set `FRONTEND_URL` to the real origin. |
| Health check leaks the DB error string | `server.ts` line 360, `error: e?.message` | Do not expose `/api/health` more widely than the platform health checker needs. |
| Hardcoded Meta pixel id | `frontend/app/layout.tsx:44`, `backend/src/lib/meta.ts:30`, value `1645715973642563` | Public pixel id, not an access token. Still replace via env/settings if the pixel changes. |
| Hardcoded WhatsApp number | `frontend/components/FloatingWhatsApp.tsx:7` and several pages. `NEXT_PUBLIC_WHATSAPP_NUMBER` is unused. | Storefront settings override some pages. The floating button default does not read env. |
| Public R2 host committed | `frontend/next.config.ts` line 19, hostname `pub-6861daa0380241a2acc38cd5ca85b301.r2.dev` | This is a public object host, not an R2 secret. Access keys were not found in git. |
| 2FA columns unused | `totp.ts`; login at `server.ts` lines 795–805 | Staff accounts are password-only. |
| Rate limit on admin login | Present, 8 / 15 min (`server.ts` line 798). Not missing. | Keep it. It depends on the database. |
| CORS is not `*` | Allowlist in `server.ts` line 31 | Keep the allowlist. `credentials` is already `false`. |
| Customer logout cookie delete may not match `secure` options | `frontend/app/api/account/logout/route.ts` line 10 uses `cookies.delete(name)` with no options | **UNCERTAIN** in production. If customers stay logged in after logout, delete the cookie with the same `path`, `secure`, and `sameSite` used at login. |
| `express.static` for `/uploads` on a serverless disk | `server.ts` line 32 | Use R2 in production. Do not expect local files to survive. |
| Seed resets the owner password | `seed.ts` lines 208–216 | Run once. |
| Two lockfiles | root `package-lock.json` and `backend/package-lock.json` | Installing with Root Directory `backend` uses the backend lockfile. **UNCERTAIN** whether it is always updated with the root workspace lock. Prefer one install path and do not mix them. |

No hardcoded JWT, database URL, Resend key, or R2 secret was found in tracked source. `git grep` hits for `postgresql://` are in docs and local env helper scripts (`VERCEL_POOL_TIMEOUT_FIX.md`, `backend/scripts/*-env.mjs`, `paste-supabase-uri.mjs`), which tell you how to paste a URL. They are not a committed production password. Confirm with `git grep postgresql://` before sharing the repo if you want a second pass; this review did not open those scripts’ full bodies for URL strings beyond the filename list.
