# Zelvomart — Clean Frontend / Backend Structure

This package reorganises the Zelvomart platform into two clear source areas while preserving the existing Next.js App Router architecture from the build specification.

## Folder structure

```text
Zelvomart_Clean_Structure/
├── frontend/                 # Next.js storefront + admin UI + Next.js route handlers
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── types/
│   ├── auth.ts
│   ├── next.config.ts
│   └── package.json
├── backend/                  # Database schema, seed, jobs, migrations and ops
│   ├── prisma/
│   ├── workers/
│   ├── scripts/
│   ├── migration/
│   └── package.json
├── .env                      # ONE environment file at root (create from .env.example)
├── .env.example
├── package.json              # Root commands
├── SETUP_DATABASE.bat
└── START_DEV.bat
```

## Important architecture note

The specification requires Next.js App Router route handlers for the API. Therefore HTTP API routes stay under `frontend/app/api/`. The `backend/` folder contains the database, Prisma schema, worker jobs, migration and operations tooling. This keeps the project clear without changing the required architecture or duplicating business logic.

## First-time setup (Windows)

1. Open CMD in this ROOT folder — the folder that contains this README and root `package.json`.
2. Create `.env`:
   ```bat
   copy .env.example .env
   ```
3. Put your Supabase/PostgreSQL `DATABASE_URL` and other secrets in root `.env`.
4. Install everything once:
   ```bat
   npm install
   ```
5. Generate Prisma client:
   ```bat
   npm run prisma:generate
   ```
6. Sync database if needed:
   ```bat
   npm run db:push
   ```
7. Seed defaults once:
   ```bat
   npm run seed
   ```
8. Start site:
   ```bat
   npm run dev
   ```

Open http://localhost:3000

## Normal daily use

From the ROOT folder only:

```bat
npm run prisma:generate
npm run dev
```

The previous `package.json not found` problem is avoided because all user-facing commands are now run from the root folder.

## Backend worker

Open a second CMD in the root folder:

```bat
npm run worker
```

## WordPress migration

```bat
npm run migrate:wordpress
```

No dummy products are created. Product/category migration and admin/database content remain the real data source.

## Admin dashboard

- Admin login uses **email + password only**. Authenticator / OTP is not required.
- Open the admin portal at `http://localhost:3000/admin/login`.
- The dashboard uses a clean Camz Cleaning-inspired operations layout with a light sidebar, top bar, KPI cards, tracking health, quick operational counts and recent orders.
- Existing role permissions, order/product/customer logic and audit logging are preserved.

### Admin chrome

Admin routes are intentionally isolated from the storefront chrome. `/admin` and `/admin/*` do **not** render the public header, footer, floating WhatsApp button, cart drawer, Meta Pixel, Clarity or storefront tracking provider. The admin uses only its own sidebar/top management bar.

## Specification verification

See `SPEC_VERIFICATION.md` for the code-by-code verification against all 16 sections of the 30 September 2026 build specification, including P0/P1/P2 status, intentional 2FA deviation, external QA requirements and launch blockers.
