# Progress

Work from the 21 October 2026 audit, done in batches, one branch each. Finding IDs (C1, H5, …) refer to the
audit report kept outside this repository.

## Batch 1: security (branch `fix/security-batch-1`)

| Item | Status | Notes |
|---|---|---|
| C1: lock the public schema (SQL + rollback) | Done (files only) | `backend/prisma/sql/`. Not run on any Supabase project: a person runs it, steps in the README there. |
| H5: admin 2FA, session checks, token lifetime, seed, env names | Done | Two-step login (password, then authenticator code), required for OWNER and MANAGER, set up at first sign-in with a QR code. Optional for other roles under Admin → Security. Owners can reset a user's 2FA in Users & Roles. `requireAuth` re-reads active, role and 2FA from the database (60 s cache, cleared on change). Tokens last 2 h; the admin proxy refreshes them while the admin works. Seed no longer touches admin accounts; the first owner is created with `npm run admin:create`. |
| K5: database TLS verification | Done | `backend/src/lib/db-ssl.ts`: every Postgres connection (Prisma, pg-boss, scripts) verifies the server against Supabase's root CA (embedded, valid to 2031). `sslmode` in the URL can no longer switch it off. `DATABASE_CA_CERT` replaces the CA; `DATABASE_SSL_VERIFY=false` is an emergency switch only. Tested against a local TLS Postgres: a wrong CA is refused, the right CA connects. |
| Zod validation on admin product, category, page and redirect writes | To do | |

### Left for a person (not code)
- After deploy, each OWNER/MANAGER sets up 2FA at the next sign-in (needs a phone with an authenticator app).
- Delete `ADMIN_EMAIL` and `ADMIN_PASSWORD` from both Vercel projects (no code reads them now).
- Change the owner password if it was ever the published default.
- Deploy to a preview first and confirm the backend reaches the database (`/api/health`). If it fails with a certificate error, set `DATABASE_SSL_VERIFY=false` on that environment and report the error text.
- Run `01-lock-public-schema.sql`, staging first.
- Remove `public` from the Supabase Data API exposed schemas.
