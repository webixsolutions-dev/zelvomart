# Database SQL scripts

Reviewed SQL that a person runs by hand in the Supabase SQL editor. Nothing here runs on deploy.

## 01 — Lock the public schema (audit C1)

`01-lock-public-schema.sql` removes every grant the Supabase API roles (`anon`, `authenticated`) hold on the
`public` and `pgboss` schemas, stops new tables from inheriting them, and turns on Row-Level Security for
every table with no policies. The app is not affected: it uses Prisma over a direct connection as the
table owner, and owners bypass RLS. Nothing in the repository calls the Supabase REST/GraphQL Data API.

Steps:

1. **Back up first.** Supabase → Database → Backups (Pro), or `pg_dump` of the database.
2. **Staging first.** Run the script on a copy or a Supabase branch, then open the storefront, place a test
   order and log in to the admin.
3. **Production.** Supabase → SQL Editor → paste `01-lock-public-schema.sql` → Run.
   - Run it as the same role `DATABASE_URL` uses (the SQL editor's default `postgres` role).
   - If it stops with "not owned by …", nothing was changed. Fix the ownership it names, then run it again.
   - The last query must show `rls_off = 0` and `anon_grants = 0`.
4. **Data API.** Supabase → Settings → Data API: remove `public` from the exposed schemas, or turn the
   Data API off (nothing uses it).
5. **Check from outside.** Call `GET https://<project>.supabase.co/rest/v1/User` with the anon key. It must
   answer 401 or "permission denied".
6. **Check the app.** Storefront pages, checkout, admin login and an admin save must all still work.
7. **Check the advisor.** Supabase → Advisors → Security must show no `rls_disabled_in_public` errors.
8. **Rotate what was exposed:**
   - Change the admin password.
   - Delete every `StoreSession` row, so customers sign in again.
   - Rotate `JWT_SECRET` on go-live day.

Rollback: `01-rollback.sql` restores the previous grants and turns RLS off again. Use it only if the lock
broke something; it re-opens the exposure.

Both scripts were tested on a local Postgres with `anon` and `authenticated` roles:

- After the lock, the anon role gets "permission denied" and the API still answers 200.
- The rollback restores the previous state, and the lock runs again cleanly afterwards.
- With a table owned by another role, the lock stops before making any change.

## 02 — Purge old session recordings (audit C4)

`02-purge-old-replays.sql` deletes **every** row of `SessionReplayChunk` and `SessionReplay`, clears
`Order.replaySessionId` (orders themselves stay), then runs `VACUUM FULL` on both tables so the disk space is
returned. Recordings are written only to the private R2 bucket from this release, so nothing in the app needs
the old rows. It cannot be undone.

Steps:

1. Deploy the backend with this release first (so no new inline recordings are written).
2. Supabase → SQL Editor → paste the file → Run, as the `postgres` role, in a quiet hour.
   - If the editor refuses `VACUUM` ("cannot run inside a transaction block"), run the two `vacuum full`
     lines on their own.
3. The last query must show `chunks_left = 0` and `sessions_left = 0`. Supabase → Reports → Database size
   should drop by about 600 MB.

Tested on a copy of the local database: 500 seeded chunks and their session removed, order links cleared,
the chunk table back to 40 kB.

## 03 — Remove the CMS pages (Admin → Pages removed)

`03-drop-cms-pages.sql` deletes every row of `Page`. Admin → Pages and its API are gone in this release, and
the policy pages now take their text from code (`frontend/storefront/lib/policies`). Until this runs, a policy
row still in the table is shown instead of the code version; afterwards the code version always shows (within
10 minutes, the storefront cache). Old CMS slugs already answer 404 from this release.

Steps: deploy this release, then Supabase → SQL Editor → paste the file → Run. The first query lists the pages
being removed (copy anything you want to keep); the last must show `pages_left = 0`. Then open
`/privacy-policy/`, `/terms-conditions/`, `/shipping-policy/` and `/refund_returns/` once.

Tested on a copy of the local database.
