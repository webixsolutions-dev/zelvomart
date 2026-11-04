# Zelvomart operations guide

How the shop runs, what to watch, and what to do when something needs attention. It contains no secrets and no
values except public addresses. Keep secret values in the hosting dashboards and your password manager.

## 1. Architecture today

```
Visitor ─► Cloudflare DNS ─► Vercel: storefront (Next.js, frontend/) ─► Vercel: backend API (Express, backend/)
                                     │                                        ├──► Supabase Postgres (Mumbai)      
                                     └── images, videos ◄── media.zelvomart.com├──► Cloudflare R2 (uploads, recordings)
                                         (Cloudflare R2 + CDN cache)          └──► Resend (emails)
Supabase pg_cron ─► backend /api/cron/jobs    Vercel cron ─► backend /api/cron/daily
```

| Service | What it does |
|---|---|
| **GitHub** (`webixsolutions-dev/zelvomart`) | The code. Merging into `main` deploys both projects. CI ("Typecheck, tests, build") must be green first. |
| **Vercel**, team `zelvomart` (Hobby plan today) | Two projects from this repo, both in region `bom1` (Mumbai): `zelvomart-storefront` (`frontend/`, domains `zelvomart.com` → 308 → `www.zelvomart.com`) and `zelvomart-backend` (`backend/`, public URL `zelvomart-backend-eta.vercel.app`). |
| **Supabase Postgres**, project `zelvomart-mumbai` (`wegjtgsoeuljakogduwu`, `ap-south-1` Mumbai, Free plan) | The only database: products, orders, customers, settings, job queue. Moved from Sydney on 4 Nov 2026 (section 10). The app logs in as role `zelvomart_app` (owns the tables) through the pooler `aws-0-ap-south-1.pooler.supabase.com`: `DATABASE_URL` = port 6543 (transaction), `DIRECT_URL` = port 5432 (session). The "Direct connection" host is IPv6-only on the Free plan, and the backend connects over IPv4, so do not use it. It also runs the 5-minute cron (section 7). |
| **Cloudflare** (Free plan) | DNS for `zelvomart.com` (section 2), R2 storage and the CDN in front of `media.zelvomart.com` (section 3). |
| **Hostinger** | Domain registration and the mailbox only. Nameservers point to Cloudflare. |
| **Resend** | Sends every email: order alerts to the team, customer confirmations and status updates, the cart offer, the contact form, the daily summary. |
| **Supabase pg_cron** (inside the Mumbai database) | Calls `/api/cron/jobs` every 5 minutes: retries anything that did not go out at once and sends the cart offer (section 7). Replaced cron-job.org on 4 Nov 2026, after cron-job.org had stopped reaching the backend. |

## 2. DNS (Cloudflare)

Nameservers are at Cloudflare; registration stays at Hostinger. There are **15 records**, copied one by one from
Hostinger, and **every one is "DNS only" (grey cloud)**. Never switch a record to "Proxied" (orange): Vercel
issues its own certificates, and mail records must never be proxied.

| # | Type | Name | Points to / content | Used by |
|---|---|---|---|---|
| 1 | A | `@` | `216.198.79.1` | Vercel (apex, redirects to www) |
| 2 | CNAME | `www` | Vercel's target, as shown in Vercel → storefront → Domains | Vercel (the shop) |
| 3 | CNAME | `hostingermail-a._domainkey` | Hostinger DKIM | Mailbox signing |
| 4 | CNAME | `hostingermail-b._domainkey` | Hostinger DKIM | Mailbox signing |
| 5 | CNAME | `hostingermail-c._domainkey` | Hostinger DKIM | Mailbox signing |
| 6 | CNAME | `autoconfig` | Hostinger | Mail app set-up |
| 7 | CNAME | `autodiscover` | Hostinger | Mail app set-up |
| 8 | (as copied) | `rsend` | Resend | Sending domain for Resend |
| 9 | (as copied) | `send` | Resend | Sending domain for Resend |
| 10 | MX | `@` | `mx1` (Hostinger), priority 5 | Incoming mail |
| 11 | MX | `@` | `mx2` (Hostinger), priority 10 | Incoming mail |
| 12 | TXT | `@` | SPF (`v=spf1 …`) | Who may send mail for the domain |
| 13 | TXT | `_dmarc` | DMARC (`v=DMARC1; …`) | Mail policy |
| 14 | TXT | `_vercel` | Vercel verification | Domain ownership in Vercel |
| 15 | TXT | `_vercel` | Vercel verification | Domain ownership in Vercel |

**Do not touch MX, SPF, DKIM, DMARC, `rsend` or `send`.** Changing or deleting one of them breaks the mailbox or
order emails, often silently.

**Adding a record:** Cloudflare → `zelvomart.com` → DNS → Records → Add record: choose the type, the name (without
`.zelvomart.com`), the content, TTL "Auto", and set **Proxy status to "DNS only"** before saving. Note the change
and the reason in this file.

**DNSSEC is off.** If someone turns it on in Cloudflare, the DS record Cloudflare shows must also be added at the
registrar (Hostinger → Domains → DNSSEC). Without the DS record at Hostinger the whole domain stops resolving.

## 3. Media

- **`https://media.zelvomart.com`** is the custom domain of the R2 bucket `zelvomart-media` (APAC). Cloudflare
  caches it. It serves the same keys as before: `/products/<hash>.webp`, `/videos/<name>.mp4` and posters.
- The database still stores full URLs on the old public host
  `https://pub-6861daa0380241a2acc38cd5ca85b301.r2.dev` (product images, descriptions). The storefront and the
  catalog feeds rewrite them to `NEXT_PUBLIC_MEDIA_BASE_URL` when they read them (`packages/media`). The database is
  never changed.
- Uploads already set `Cache-Control: public, max-age=31536000, immutable`. New uploads use `S3_PUBLIC_BASE_URL`;
  once that is set to `https://media.zelvomart.com`, new products get the media domain directly.
- Session recordings live in the separate private bucket `REPLAY_S3_BUCKET` and are never public.
- **Keep the old `r2.dev` public URL enabled** until the "Later" step below.

**Later (after at least a week of clean production):** search the HTML of home, shop, a category, a product, the
sitemaps and the product JSON-LD for `r2.dev`. Only when nothing references it any more: Cloudflare → R2 →
`zelvomart-media` → Settings → Public Development URL → Disable. If anything breaks, enable it again (same URL).

## 4. Watching usage and the limits runbook

### Vercel Hobby limits (per month, whole team)

| Limit | Allowance | Where to read it |
|---|---|---|
| Active CPU (functions) | 4 CPU-hours | Vercel → team `zelvomart` → Usage → Functions |
| Fast Origin Transfer | 10 GB | Usage → Networking |
| Function invocations | 1,000,000 | Usage → Functions |
| ISR writes | 200,000 | Usage → ISR |

- **Going over any limit pauses the whole team (both projects) for up to 30 days.** Check the live numbers on the
  Usage page; Vercel can change them.
- **Hobby is for non-commercial use.** Move to Pro before running ads or any real sales push.

| When | Do this |
|---|---|
| Any limit at 50% before day 15 | Look for the cause: Vercel → Logs (a bot hammering one URL → block it in Firewall), cron every 5 minutes not every minute, a deploy that started the jump (roll back). |
| 75% | Fix the cause the same day. Cron down to 15–30 minutes if the job queue is calm. Plan the Pro upgrade. |
| 90% or a warning email | Upgrade to Pro now (owner decision) or move to a plain server (section 11). Do not wait for the pause. |
| Paused | Fastest way back: Pro upgrade, or the plain Node server (section 11, code runs unchanged). |

### Other usage

| What | Where | Safe | Act when |
|---|---|---|---|
| Supabase egress (free plan: 5 GB/month) | Supabase → Usage → Egress | under about 100 MB/day | above 150 MB/day two days in a row |
| Slow or heavy queries | Supabase → Database → Query performance (`pg_stat_statements`) | top query under 20% of total time | one query grows suddenly after a deploy |
| Cloudflare | Cloudflare → `zelvomart.com` → Analytics; R2 → `zelvomart-media` → Metrics | cache hit ratio for media high | many uncached media requests, or R2 class-A/B operations rising fast |

## 5. Environment variables (names only)

Set them in each Vercel project (or a `.env` file on a server). A `NEXT_PUBLIC_` name is baked into the storefront at
build time, so changing it needs a redeploy.

### Backend project (`zelvomart-backend`, folder `backend/`)

| Name | What it is for |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string used by the app. |
| `DIRECT_URL` | Direct (session) connection used by Prisma schema commands. |
| `DATABASE_POOL_MAX` | Optional. Most database connections per running copy (default 3 on Vercel, 10 on a server). |
| `DATABASE_IDLE_TIMEOUT_MS` | Optional. How long an unused connection stays open (default 60 s on Vercel, 5 min on a server). |
| `DATABASE_SSL`, `DATABASE_SSL_VERIFY`, `DATABASE_CA_CERT` | Optional TLS controls. Leave unset for Supabase (TLS is verified automatically). `DATABASE_SSL_VERIFY=false` is for emergencies only. |
| `FRONTEND_URL` | Storefront address(es), comma-separated. Allowed browser origins, **and the first one receives the "refresh these pages" calls** after admin saves, so put the live shop URL first. |
| `NEXT_PUBLIC_SITE_URL` | The public shop URL (emails, links). Its host is also the only host where Meta/TikTok server events are sent (see "What changes at cutover" below). |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | Media domain (`https://media.zelvomart.com`). Stored old-host image URLs are printed with it in the catalog feeds. Falls back to `S3_PUBLIC_BASE_URL`. |
| `PORT` | Port on a plain server (default 4000). Not needed on Vercel. |
| `JWT_SECRET` (or `AUTH_SECRET`) | Signs admin and customer logins. |
| `REVALIDATION_SECRET` | Shared with the storefront; lets the backend refresh storefront pages after a save. |
| `STORE_PROXY_SECRET` | Shared with the storefront; lets the storefront pass the visitor's real IP (fair rate limits). |
| `JOB_MODE` | `cron` = jobs are sent instantly and retried by the cron routes (current setup); `worker` = the always-on worker sends them. If it is missing, the backend uses `cron` on Vercel and `worker` elsewhere, and logs one `[jobs] JOB_MODE is not set` warning at start. Always set it explicitly. |
| `CRON_SECRET` | Password the cron sends as `Authorization: Bearer …`. A copy lives in the Supabase Vault as `zelvomart_cron_secret`; when you change one, change the other (section 7). |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Email sending. |
| `ORDERS_EMAIL_FROM`, `OFFERS_EMAIL_FROM` | Optional sender names for order and offer emails. |
| `ORDER_ALERT_RECIPIENTS`, `SUPPORT_EMAIL_TO`, `OFFERS_COPY_TO` | Who gets new-order alerts, contact-form mail, and hidden copies of offer emails (the admin setting wins over these). |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE` | R2 media bucket for uploads. |
| `LOCAL_UPLOAD_DIR` | Only when R2 is not configured: a folder on the server for uploads. |
| `REPLAY_S3_BUCKET`, `SESSION_REPLAY_RETENTION_DAYS` | R2 bucket for recordings and how many days to keep them: 14 (admin setting wins; anything above 14 is treated as 14, because the R2 lifecycle rule deletes the files after 14 days). |
| `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`, `META_GRAPH_VERSION`, `META_PAGE_ID`, `META_INSTAGRAM_ACCOUNT_ID`, `META_AD_ACCOUNT_ID`, `META_MARKETING_ACCESS_TOKEN` | Meta Pixel / Conversions API and Meta marketing tools. |
| `TIKTOK_PIXEL_ID`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_EVENTS_API_TOKEN`, `TIKTOK_TEST_EVENT_CODE` | TikTok events (off unless switched on). |
| `POSTEX_TRACKING_BASE_URL` | Courier tracking link used in emails. |
| `APP_ENV` | `production` only on the live shop. Meta/TikTok server events (and, through the store bootstrap, the browser pixels) run only when it is `production`. |
| `STORE_SESSION_DAYS`, `STORE_TIMEZONE` | Customer login length (days), shop time zone. |
| `SENTRY_DSN` | Optional error monitoring. |
| `WORKER_DATABASE_URL`, `WORKER_BACKLOG_REVIEWED` | Only for the optional always-on worker (`compose.worker.yml`); not used in cron mode. |

### Storefront project (`zelvomart-storefront`, folder `frontend/`)

| Name | What it is for |
|---|---|
| `BACKEND_URL` | Backend address used by the storefront server. |
| `NEXT_PUBLIC_API_URL` | Backend address used in the browser (requests go through the storefront's own `/api/store-proxy`). |
| `NEXT_PUBLIC_SITE_URL` | The public shop URL (canonical links, sitemaps, share images). Meta/TikTok pixels load only on exactly this host. |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | Media domain (`https://media.zelvomart.com`). Product images, descriptions, sitemaps, JSON-LD, share images and home videos use it. Unset = the old `r2.dev` host. |
| `APP_ENV` | Optional here. If set, it decides whether the pixels may load (`production` only); if unset, the backend's `APP_ENV` decides. |
| `REVALIDATION_SECRET` | Same value as the backend; protects `/api/revalidate`. |
| `STORE_PROXY_SECRET` | Same value as the backend. |
| `NEXT_PUBLIC_IMAGE_HOSTS` | Extra image hosts allowed for product photos (comma-separated). |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics. |
| `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_TIKTOK_PIXEL_ID` | Browser pixel IDs. |
| `NEXT_PUBLIC_SESSION_REPLAY_ENABLED` | Turns session recording on or off. |
| `NEXT_PUBLIC_SESSION_REPLAY_SAMPLE_RATE` | Share of visits recorded, 0 to 1 (default `0.25`). |
| `NEXT_PUBLIC_HOME_VIDEO_BASE` | Optional override for the home videos folder. Unset = `<NEXT_PUBLIC_MEDIA_BASE_URL>/videos/`. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_RELEASE`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional error monitoring and source maps. |

Set by the host (never set them yourself): `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `NODE_ENV`, `NEXT_RUNTIME`.

### What changes at cutover (owner, with an explicit "yes")

1. Both projects: `NEXT_PUBLIC_MEDIA_BASE_URL=https://media.zelvomart.com`.
2. Both projects: `NEXT_PUBLIC_SITE_URL=https://www.zelvomart.com`.
3. Backend: `FRONTEND_URL` = the www and apex origins (live shop first, without the vercel.app one).
4. Backend: `APP_ENV=production` (and the storefront's own `APP_ENV`, if it has one).
5. Redeploy both projects. Check canonical, `og:url`, the sitemap and robots on the live domain.
6. Later, owner decision: backend `S3_PUBLIC_BASE_URL=https://media.zelvomart.com`.

## 6. Deploy and roll back

- **Deploy:** merge a pull request into `main` after CI is green ("Typecheck, tests, build"). Vercel builds the
  project(s) whose folder changed and switches traffic when the build succeeds. A failed build never replaces the
  live site.
- **Roll back:** Vercel → project → Deployments → pick the last good deployment → "Promote to Production"
  (instant, no rebuild). Then revert the bad change in GitHub so the next deploy does not bring it back.
- **Environment variable change:** save it in the project settings, then "Redeploy" that project. A
  `NEXT_PUBLIC_` change needs a storefront rebuild.
- **Database schema:** never changed by a deploy. Follow `deployment/DATABASE-MIGRATIONS.md`: backup first, test on
  a copy, then apply.

## 7. Cron (scheduled calls)

| URL | Method | Auth header | Interval | What it does | Answers |
|---|---|---|---|---|---|
| `https://<backend>/api/cron/jobs` | POST | `Authorization: Bearer <CRON_SECRET>` | every 5 minutes (Supabase pg_cron job `zelvomart-jobs-every-5-min`) | Retries order emails and Meta/TikTok events that did not go out at once (up to 25 per call), then sends the 5% cart offer about an hour after a cart was left. | 200 with `processed`, `failed`, `remaining`; **409** if `JOB_MODE` is not `cron` (checked first); **401** on a wrong or missing secret (503 if `CRON_SECRET` is not set at all). |
| `https://<backend>/api/cron/daily` | GET or POST | same | **Vercel cron, daily at 00:00 UTC** (`backend/vercel.json`) | Removes old rate-limit rows, expired recordings, and jobs and events older than 30 days; sends the daily summary email. | 200; 401 on a wrong secret. |

- `<backend>` is `zelvomart-backend-eta.vercel.app` today. The 5-minute call is made by the database itself:
  pg_cron runs `select zm_ops.call_backend_cron('/api/cron/jobs')`, which reads the key from the Vault
  (`zelvomart_cron_secret`) and posts with pg_net. After a backend URL change, update the URL inside
  `zm_ops.call_backend_cron`. After changing `CRON_SECRET` in Vercel, update the Vault secret
  (`select vault.update_secret((select id from vault.secrets where name = 'zelvomart_cron_secret'), '<new key>');`)
  and redeploy the backend.
- **Check the cron** (Supabase → SQL editor): `select id, status_code, left(content::text, 200), error_msg, created
  from net._http_response order by id desc limit 5;` Every 5 minutes there should be a 200 with `remaining` 0.
  Run it by hand with `select zm_ops.call_backend_cron('/api/cron/jobs');`.
- Cost of an empty `/api/cron/jobs` run: one function call and one small database query. Every 5 minutes is about
  8,600 calls a month, under 1% of the Hobby invocation allowance.
- Do not also call `/api/cron/daily` from pg_cron, or the daily summary arrives twice.
- Orders do not wait for the cron: their emails and events go out right after the order is saved.
- **Stuck jobs:** Admin → Tracking shows a red warning when jobs are still QUEUED after 15 minutes. The cron is not
  calling `/api/cron/jobs`, or `JOB_MODE` is not `cron`.
- **When the queue grows** (`remaining` above 0 on several runs, or failed rows in Admin → Jobs): read the error on
  the failed rows (usually Resend, a Meta/TikTok token, or the database), fix it, and the next runs clear the
  backlog 25 per call. For a large backlog, run `select zm_ops.call_backend_cron('/api/cron/jobs');` a few times; do
  not shorten the schedule.

## 8. Adding products and videos

- **Products:** Admin → Products (one at a time) or the CSV import (`import-templates/`). Photos upload to R2.
  Saving refreshes only the affected pages.
- **Home videos:** upload the `.mp4` (short, vertical, compressed) and a `.jpg` poster to `zelvomart-media`, folder
  `videos/`; add one row to `frontend/storefront/lib/home-videos.ts` and merge it. Never commit video files.

## 9. Session recordings

- `NEXT_PUBLIC_SESSION_REPLAY_SAMPLE_RATE` (default 0.25) of visits are recorded; `/admin` never is.
- A recording ends after 10 minutes, or once the tab has been hidden for more than a minute.
- Recordings stay un-masked (owner decision) and are kept 14 days: the R2 lifecycle rule on `zelvomart-replays` deletes `replays/` files after 14 days, and the daily cleanup deletes the matching rows at the same age (`backend/src/lib/replay-retention.ts`; admin setting Tracking → Retention Window, capped at 14).

## 10. Database

### Backup and restore

- The Free plan has **no automatic backups** you can restore yourself, so your own weekly copy is the backup.
- Keep your own copy too: once a week, and always before any schema change or bulk edit, run
  `pg_dump --format=custom --no-owner "<DIRECT_URL>" > zelvomart-YYYY-MM-DD.dump` from a trusted computer. Store
  the file off the server.
- **Restore** into a new, empty database first (never over the live one):
  `pg_restore --no-owner --dbname "<new database URL>" zelvomart-YYYY-MM-DD.dump`. Check it, then point
  `DATABASE_URL`/`DIRECT_URL` at it only if you really need to switch.
- Never run imports, scripts or migrations against the live database without a fresh backup.


### Applying a schema change (migration file)

The live database has no `_prisma_migrations` history table (its schema was built from `schema.prisma`, not with
`migrate`), so `npx prisma migrate deploy` would try to run every old migration and fail. Apply one new migration
file at a time, after a backup, from `backend/` with `DIRECT_URL` pointing at the live database:

`npx prisma db execute --file prisma/migrations/<folder>/migration.sql --schema prisma/schema.prisma`

Then check that nothing is left: `npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel
prisma/schema.prisma --script` should print "This is an empty migration". The same SQL can also be pasted into
Supabase → SQL editor. Each migration file names its rollback at the top.

### Move to Mumbai: done on 4 Nov 2026

- **What was done:**
  - created `zelvomart-mumbai` (Free plan);
  - built the schema from `prisma/schema.prisma`, with the same lock-down as `prisma/sql/01-lock-public-schema.sql`;
  - copied all 29 public tables straight from Sydney over a temporary read-only link;
  - checked that row counts and a content checksum matched on every table (2,045 rows);
  - switched `DATABASE_URL`/`DIRECT_URL` and redeployed;
  - confirmed nothing was written to Sydney after the final copy;
  - placed test order ZM-10017, whose emails went out;
  - removed the temporary link and login.
- **Not copied:** the old `pgboss` schema, legacy worker history. pg-boss recreates it if worker mode is ever used.
- **Rollback until 11 Nov 2026:** the Sydney project `hablwjnkprkisnfvkmca` is untouched. The fastest way back is
  Vercel → `zelvomart-backend` → Deployments → promote `dpl_3Yaupx5VWQwJmVtYQ6JpWux8gWd5` (built with the Sydney
  connection strings). After a rollback, copy any orders taken in Mumbai back by hand. After 11 Nov, pause or
  delete the Sydney project.

### How the move was planned (for reference)

Functions run in Mumbai (`bom1`) while the database is in Sydney, so every query crosses the ocean. Moving it to
Supabase `ap-south-1` (Mumbai) removes that delay.

1. Create a new Supabase project in region `ap-south-1` (same plan). Save its connection strings in the password
   manager.
2. From a trusted computer, dump the old project (direct connection):
   `pg_dump --schema=public --no-owner --no-privileges -Fc "<old DIRECT_URL>" > zelvomart-move.dump`
3. Restore into the new project: `pg_restore --no-owner --no-privileges --dbname "<new DIRECT_URL>" zelvomart-move.dump`
4. Compare row counts table by table (Product, Order, OrderItem, Customer, Setting, Category, City, Job, Review);
   they must match.
5. With `DIRECT_URL` pointing at the new project, run `npx prisma migrate deploy` in `backend/` (it should report
   nothing to apply).
6. **Short order freeze** (announce 10 minutes): turn on maintenance or pause checkout, take a final dump and
   restore of only what changed if any orders arrived after step 2 (or repeat steps 2–4).
7. The owner sets on the backend project, with his "yes":
   - `DATABASE_URL` = new project's **transaction pooler**, port **6543**, with `?pgbouncer=true`;
   - `DIRECT_URL` = new project's direct/session connection.
8. Redeploy the backend.
9. Smoke test: home, a product, add to cart, a real test order, admin login, Admin → Jobs (the order's jobs leave
   QUEUED), emails arrive.
10. Keep the old project untouched for 7 days as the rollback (switch the two variables back and redeploy). Then
    pause or delete it.

## 11. Moving to a plain Node server (VPS)

Both apps run on any Linux server with Node 22. Nothing in the code needs Vercel: background work keeps running
in the same process, and the pool keeps connections open longer.

1. **Install:** Node 22, git, and a process manager (for example `pm2` or systemd). Clone the repo.
2. **Configure:** create `backend/.env` and `frontend/.env.local` with the variables in section 5, then:
   - backend: `PORT=4000` and `JOB_MODE=cron`;
   - storefront: `BACKEND_URL=http://127.0.0.1:4000`;
   - `FRONTEND_URL` and `NEXT_PUBLIC_SITE_URL`: the public `https://` shop address.
3. **Build:** `npm ci`, then `npm run build:backend`, then `npm run build:frontend`.
4. **Start:**
   - backend: `node backend/dist/src/server.js` (or `npm start --workspace backend`), listening on port 4000;
   - storefront: `npm start --workspace frontend -- -p 3000`, listening on port 3000.
5. **Web server:** put Nginx or Caddy in front (free HTTPS certificate). Send the shop domain to port 3000. The
   API may stay private on 127.0.0.1:4000 because the storefront proxies browser calls; if a public API host
   is needed, send it to port 4000.
6. **Cron:** use system cron instead of cron-job.org (or keep cron-job.org pointing at the new address):
   - `*/5 * * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:4000/api/cron/jobs`
   - `10 0 * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:4000/api/cron/daily`
   - Remove the Vercel daily cron (or pause the Vercel project) so it does not run twice.
7. **DNS switch checklist:**
   - lower the DNS TTL to 5 minutes a day before;
   - test the server on its IP or a test subdomain (home, product, add to cart, test order, admin login);
   - point the `A`/`AAAA` records of `zelvomart.com` and `www` at the server;
   - watch a real order arrive with its emails;
   - keep Vercel untouched for a week as the fallback, then raise the TTL again.
8. **Updates:** `git pull && npm ci && npm run build:backend && npm run build:frontend`, then restart both
   processes.

## 12. Weekly health checklist (about 10 minutes)

1. **Vercel → Usage:** CPU, Fast Origin Transfer, invocations and ISR writes under 50% for the point in the month
   (section 4).
2. **Supabase:** Usage → egress on track; Database → Query performance → the top queries look normal.
3. **Cloudflare:** Analytics for `zelvomart.com` and R2 metrics for `zelvomart-media` look normal; no DNS record
   changed by accident (all 15 still grey cloud).
4. **Jobs:** Admin → Tracking shows no stuck-jobs warning; Admin → Jobs has no failed rows piling up; the cron
   check in section 7 shows 200s with `remaining` 0.
5. **Mail test:** send a mail to and from the zelvomart mailbox; check Resend → Logs for bounces or failures.
6. **Backups:** this week's database dump exists (section 10).
7. Open the shop on a phone: home, a category, a product, add to cart, open checkout.
