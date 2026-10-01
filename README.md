# Zelvomart — Fully Separated Frontend + Backend

This package uses a true two-application architecture.

```text
Zelvomart_Separated_Final/
├── frontend/                     # Next.js UI ONLY
│   ├── app/                      # Storefront + admin UI pages
│   ├── components/
│   ├── lib/
│   │   ├── api.ts                # Server-side HTTP client to backend
│   │   └── client-api.ts         # Browser HTTP client to backend
│   ├── public/
│   ├── .env.example
│   └── package.json
│
├── backend/                      # ALL server/database work
│   ├── api/index.ts              # Vercel serverless entry
│   ├── src/server.ts             # Express REST API
│   ├── src/lib/                  # auth, orders, email, tracking, jobs, storage
│   ├── prisma/                   # schema + seed
│   ├── workers/
│   ├── scripts/
│   ├── .env.example
│   └── package.json
│
├── package.json                  # optional local workspace runner
├── START_DEV.bat
└── SETUP_DATABASE.bat
```

## Important separation rule

The frontend has **no Prisma client, no PostgreSQL connection, no DATABASE_URL, no Auth.js server, no bcrypt, no email/jobs code and no Next.js API routes**.

All data and authentication flow through the backend:

```text
Next.js frontend :3000
        ↓ HTTP REST API
Express backend :4000
        ↓ Prisma
Supabase PostgreSQL
```

## Frontend environment

Create `frontend/.env.local` from `frontend/.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_META_PIXEL_ID=1645715973642563
NEXT_PUBLIC_CLARITY_ID=
NEXT_PUBLIC_WHATSAPP_NUMBER=923002026711
```

There is deliberately **no DATABASE_URL in frontend**.

## Backend environment

Create `backend/.env` from `backend/.env.example` and put all private credentials there:

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL="YOUR_SUPABASE_TRANSACTION_POOLER_URL"
DIRECT_URL="YOUR_SUPABASE_SESSION_POOLER_URL"
JWT_SECRET="replace-with-a-long-random-secret"
ADMIN_EMAIL=owner@zelvomart.com
ADMIN_PASSWORD=ChangeMe123!
```

Email, Meta CAPI, R2/S3 and PostEx secrets also live only in `backend/.env`.

## Local setup

From the project root:

```bat
npm install
copy frontend\.env.example frontend\.env.local
copy backend\.env.example backend\.env
npm run prisma:generate
npm run db:push
npm run seed
npm run dev
```

Or use `SETUP_DATABASE.bat` once and `START_DEV.bat` for normal development.

Local URLs:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:4000
Health:   http://localhost:4000/api/health
Admin:    http://localhost:3000/admin/login
```

Admin login uses email + password only. The backend validates credentials and returns the admin token; the frontend never queries the user table directly.

## Vercel deployment — two separate projects

### 1. Backend project

Create a Vercel project with **Root Directory = `backend`**.

Backend environment variables:

```text
DATABASE_URL
DIRECT_URL
JWT_SECRET
FRONTEND_URL=https://YOUR-FRONTEND-DOMAIN
ADMIN_EMAIL
ADMIN_PASSWORD
RESEND_API_KEY
EMAIL_FROM
ORDER_ALERT_RECIPIENTS
META_PIXEL_ID
META_CAPI_TOKEN
META_TEST_EVENT_CODE
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_PUBLIC_BASE_URL
POSTEX_TRACKING_BASE_URL
POSTEX_API_BASE_URL
POSTEX_API_TOKEN
APP_ENV=production
```

### 2. Frontend project

Create another Vercel project with **Root Directory = `frontend`**.

Frontend environment variables only:

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-DOMAIN
BACKEND_URL=https://YOUR-BACKEND-DOMAIN
NEXT_PUBLIC_SITE_URL=https://YOUR-FRONTEND-DOMAIN
NEXT_PUBLIC_META_PIXEL_ID=1645715973642563
NEXT_PUBLIC_CLARITY_ID=
NEXT_PUBLIC_WHATSAPP_NUMBER=923002026711
```

Do **not** add `DATABASE_URL`, `DIRECT_URL`, Supabase password, JWT secret, Resend key or Meta CAPI token to the frontend project.

## Included backend APIs

The backend contains APIs for storefront bootstrap, products, categories, pages, settings, cities, sitemap/feed data, checkout/orders, order tracking, abandoned checkout, reviews, tracking events, admin login, dashboard, products/variants, CSV import/export, categories, orders/status/tracking, customers/blocklist, content pages, settings, users/roles, reviews, redirects, experiments, jobs, tracking health, reports and uploads.

## Build commands

```bat
npm run build:backend
npm run build:frontend
```

The frontend build does not run Prisma and does not require database connectivity.
