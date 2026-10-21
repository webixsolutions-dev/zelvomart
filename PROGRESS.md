# Progress

Work from the 21 October 2026 audit, done in batches, one branch each. Finding IDs (C1, H5, …) refer to the
audit report kept outside this repository.

## Batch 1: security (branch `fix/security-batch-1`)

| Item | Status | Notes |
|---|---|---|
| C1: lock the public schema (SQL + rollback) | Done (files only) | `backend/prisma/sql/`. Not run on any Supabase project: a person runs it, steps in the README there. |
| H5: admin 2FA, session checks, token lifetime, seed, env names | Done | Two-step login (password, then authenticator code), required for OWNER and MANAGER, set up at first sign-in with a QR code. Optional for other roles under Admin → Security. Owners can reset a user's 2FA in Users & Roles. `requireAuth` re-reads active, role and 2FA from the database (60 s cache, cleared on change). Tokens last 2 h; the admin proxy refreshes them while the admin works. Seed no longer touches admin accounts; the first owner is created with `npm run admin:create`. |
| K5: database TLS verification | Done | `backend/src/lib/db-ssl.ts`: every Postgres connection (Prisma, pg-boss, scripts) verifies the server against Supabase's root CA (embedded, valid to 2031). `sslmode` in the URL can no longer switch it off. `DATABASE_CA_CERT` replaces the CA; `DATABASE_SSL_VERIFY=false` is an emergency switch only. Tested against a local TLS Postgres: a wrong CA is refused, the right CA connects. |
| Zod validation on admin product, category, page and redirect writes | Done | `backend/src/lib/admin-validators.ts`: type, length and format checks (slugs, links never `javascript:`, prices ≥ 0, sale price below the regular price, variants). It validates only; the routes keep the original body, so a PATCH still touches only the fields it sent. A real save from Admin → Products passes. Errors come back as `{ error, issues[] }`. |

### Left for a person (not code)
- Products saved with a sale price at or above the regular price (e.g. the "lipstic" test item) now need that fixed before they can be saved again.
- Delete `ADMIN_EMAIL` and `ADMIN_PASSWORD` from both Vercel projects (no code reads them now).
- Change the owner password if it was ever the published default.
- Deploy to a preview first and confirm the backend reaches the database (`/api/health`). If it fails with a certificate error, set `DATABASE_SSL_VERIFY=false` on that environment and report the error text.
- Run `01-lock-public-schema.sql`, staging first.
- Remove `public` from the Supabase Data API exposed schemas.

### Batch 1 status
All four items are done in code. Tests: every backend test passes (9 files, including the new `auth.test.ts` and `admin-validators.test.ts`); backend `tsc` and `next build` pass.

## Batch 1-B: optional 2FA and password change (branch `fix/auth-options`)

| Item | Status | Notes |
|---|---|---|
| 2FA optional for every role | Done | No role is forced to set up 2FA at sign-in; `requireAuth` no longer answers `TWO_FACTOR_REQUIRED`. Accounts that turned 2FA on are still asked for a code. |
| Turn off 2FA (Admin → Security) | Done | Asks for the current password. Clears the secret; audit `disable_2fa`. Wrong password → 401 `WRONG_PASSWORD` (does not sign the admin out). |
| Change password (Admin → Security) | Done | Current, new, confirm. New password at least 10 characters. 5 tries per 15 minutes. Audit `change_password`. Every other session of the account ends; this one stays signed in. |
| Reset password (Admin → Users & Roles) | Done | Owners (users.write) set a new password for a team member; all of that member's sessions end. Audit `reset_password`. Minimum for new users is also 10 characters now. |

How "end other sessions" works without a database change: every admin token carries a short fingerprint of the
stored password hash, and `requireAuth` compares it with the current one. A new password means a new fingerprint,
so older tokens stop working within a minute on every server (at once on the one that made the change).

Tested locally (API and browser): sign-in without a code when 2FA is off; wrong current password shows a message
and keeps the admin signed in; after a change the same tab stays signed in, a second browser is sent to the login
page, the old password is refused and the new one works; the 6th try in 15 minutes gets 429; 2FA on → sign-in asks
for a code → turned off with the password → sign-in without a code; reset password signs the member out and the
new password works. Backend tests (13) and `next build` pass.

### Left for a person (not code)
- After deploy, every admin signs in once more (tokens issued before this change do not carry the fingerprint).

Next: Batch 2 (`fix/data-loss-batch-2`): C4 replays to R2 only, purge SQL, remove admin Pages and the catch-all route, H3 fetch timeout.
