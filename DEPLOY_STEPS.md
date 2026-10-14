# Zelvomart: Vercel deploy steps

No secret values are in this file. The values live in two local, gitignored files in the repo root:

| File | Goes to | Contains secrets |
| --- | --- | --- |
| `deploy.backend.env` | Vercel **backend** project (root directory `backend`) | Yes |
| `deploy.frontend.env` | Vercel **frontend** project (root directory `frontend`) | Yes (`REVALIDATION_SECRET`) |

URLs used in those files:

- Backend: `https://zelvomart-backend.vercel.app`
- Frontend (public): `https://zelvomart.vercel.app`
- Frontend (deployment URL, also allowed by CORS): `https://zelvomart-crabflloe-webix-solutions-projects.vercel.app`

If either project is served from a different domain, change `FRONTEND_URL`, `NEXT_PUBLIC_SITE_URL`, `BACKEND_URL` and `NEXT_PUBLIC_API_URL` in the two files before pasting.

## Order of work

Do the backend first. The frontend reads the backend while it builds.

### 1. Push the code fixes

The fixes in `backend/src/lib/db.ts`, `backend/src/server.ts`, `frontend/app/api/admin-session/login/route.ts` and `frontend/app/api/backend-health/route.ts` are only on this machine. Commit and push them so Vercel builds them.

Do **not** add `deploy.backend.env` or `deploy.frontend.env`. `git status` should not list them.

### 2. Backend project: environment variables

1. Vercel → the **backend** project → Settings → Environment Variables.
2. Select **Production** (add Preview too if you use preview deployments).
3. Use **Import .env** (or paste) with the full contents of `deploy.backend.env`.
4. Remove any old variables that are still set to `localhost`.
5. Do not add `PORT`, `VERCEL` or `NODE_ENV`. Vercel sets `NODE_ENV=production` at runtime by itself. Setting it by hand makes the install step skip devDependencies, and the `prisma generate` postinstall then fails.
6. `RESEND_API_KEY` and `META_CAPI_TOKEN` are empty placeholders. Fill them in to send emails and Meta server events. If Vercel refuses an empty value, delete those two lines and add them later.

### 3. Backend project: redeploy and check

Environment changes do not apply to an existing deployment. Redeploy the backend (Deployments → latest → Redeploy, or push a commit).

Then open:

```text
https://zelvomart-backend.vercel.app/api/health
```

| Response | Meaning |
| --- | --- |
| `{"ok":true,...}` | Backend and database are working. Continue. |
| `{"ok":false,"error":"BACKEND_MISCONFIGURED","missing":["DATABASE_URL"]}` | The variable is not set on this project/environment. Repeat step 2. |
| `{"ok":false,"error":"..."}` with status 503 | The database rejected the connection. Check `DATABASE_URL`. |
| Plain text `FUNCTION_INVOCATION_FAILED` | The function still crashes while loading. Open the backend project → Logs and read the first error line. |

### 4. Frontend project: environment variables

1. Vercel → the **frontend** project → Settings → Environment Variables → **Production**.
2. Import the full contents of `deploy.frontend.env`.
3. Remove old `localhost` values (for example `NEXT_PUBLIC_SITE_URL=http://localhost:3000`).
4. `BACKEND_URL` and `NEXT_PUBLIC_API_URL` must be the **backend** origin, never the storefront URL.
5. `REVALIDATION_SECRET` must be identical on both projects. The two files already use the same value.

### 5. Frontend project: redeploy and check

`BACKEND_URL` and every `NEXT_PUBLIC_*` value is baked in at build time, so a redeploy is required after any change to them. Redeploy **without** the build cache if the old values persist.

Then check, in this order:

```text
https://zelvomart.vercel.app/api/backend-health     -> {"ok":true,...}
https://zelvomart.vercel.app/admin/login            -> sign in with ADMIN_EMAIL / ADMIN_PASSWORD
```

Login error bodies now explain themselves:

| Body from `/api/admin-session/login` | Meaning |
| --- | --- |
| `{"error":"INVALID_CREDENTIALS"}` (401) | Wrong email or password. |
| `{"error":"BACKEND_BAD_RESPONSE","upstreamStatus":500}` (502) | The backend crashed and did not answer with JSON. Go back to step 3. |
| `{"error":"BACKEND_UNAVAILABLE"}` (503) | `BACKEND_URL` points at a host that does not answer. |
| `{"error":"BACKEND_URL_NOT_CONFIGURED"}` (503) | `BACKEND_URL` and `NEXT_PUBLIC_API_URL` are both empty on the frontend project. |
| `{"error":"BACKEND_MISCONFIGURED","missing":["JWT_SECRET"]}` (503) | `JWT_SECRET` is not set on the backend project. |

## Database: schema and admin user

Checked on 2026-10-14 against the production database: the schema is already applied and the OWNER user for `ADMIN_EMAIL` already exists and can log in. **Nothing needs to be run now.**

Only if you ever point the backend at a new, empty database, run these once from your machine. They change the production database, so run them deliberately:

```powershell
cd backend

# Creates/updates tables to match prisma/schema.prisma (uses DIRECT_URL)
node --env-file=../deploy.backend.env ../node_modules/prisma/build/index.js db push --schema=prisma/schema.prisma

# Creates the OWNER user from ADMIN_EMAIL / ADMIN_PASSWORD, plus default pages and cities
node --env-file=../deploy.backend.env --import tsx prisma/seed.ts
```

- `prisma migrate deploy` does **not** create the full schema in this repo. Use `db push`.
- Seed **overwrites the owner password** with `ADMIN_PASSWORD` every time it runs. Do not run it on every deploy.
- Login never reads `ADMIN_EMAIL` / `ADMIN_PASSWORD`; it checks the `User` table. Changing those variables in Vercel does not change the password.

## Known limitation: the worker cannot run on Vercel

`backend/workers/main.ts` is a long-running pg-boss worker. Vercel serverless functions cannot run it. While it is not running somewhere:

- order emails to the team and the customer stay queued,
- Meta Conversions API purchase and browser events stay queued,
- order status emails stay queued,
- the scheduled jobs (daily summary, tracking health check, job recovery, rate-limit cleanup) never run.

Orders are still saved and visible in the admin. To process the queue, run `npm run worker --workspace backend` on an always-on host (a small VPS, Railway, Render, Fly.io) with the same variables as `deploy.backend.env`.

## After you finish

Delete `deploy.backend.env` and `deploy.frontend.env` from your machine once both projects have their variables.
