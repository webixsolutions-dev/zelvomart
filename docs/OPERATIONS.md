# Zelvomart operations guide

How the shop runs, what to watch, and what to do when something needs attention. It contains no secrets and no
values, only names. Keep the values in the hosting dashboards and your password manager.

## 1. The services and how they connect

```
Visitor ─► Storefront (Next.js, frontend/) ─► Backend API (Express, backend/) ─► Supabase Postgres
                 │                                   │                  └──► Cloudflare R2 (images, recordings)
                 └── home videos, product images ◄── Cloudflare R2         └──► Resend (emails)
cron-job.org ─► Backend /api/cron/jobs and /api/cron/daily
```

| Service | What it does |
|---|---|
| **Hosting** (Vercel today: two projects from this repo, `frontend` and `backend`, region `bom1` Mumbai) | Runs the storefront and the API. Each project builds only when its own folder (or `packages/`) changed. Both apps also run on a plain Node server (section 8). |
| **Supabase Postgres** | The only database: products, orders, customers, settings, job queue. The app connects through the Supabase pooler (`DATABASE_URL`); schema tools use the direct connection (`DIRECT_URL`). |
| **Cloudflare R2, bucket `zelvomart-media`** | Product and admin uploads (`S3_*` variables) and the home-page videos and posters (folder `videos/`). Served from the bucket's public URL, so these files cost the database nothing. |
| **Cloudflare R2, bucket `zelvomart-replays`** | Session recordings (`REPLAY_S3_BUCKET`). They are not stored in Postgres. |
| **Resend** | Sends every email: order alerts to the team, customer confirmations and status updates, the cart offer, the contact form, the daily summary. |
| **cron-job.org** | Calls the backend on a schedule: retries any job that did not go out at once, sends the cart offer, and runs the daily clean-up. |

## 2. Environment variables (names only)

Set them in each hosting project (or in a `.env` file on a server). Only names are listed here. A name with
`NEXT_PUBLIC_` is baked into the storefront at build time, so changing it needs a new build.

### Backend (`backend/`)

| Name | What it is for |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string used by the app. |
| `DIRECT_URL` | Direct (session) connection used by Prisma schema commands. |
| `DATABASE_POOL_MAX` | Optional. Most database connections per running copy (default 3 on Vercel, 10 on a server). |
| `DATABASE_IDLE_TIMEOUT_MS` | Optional. How long an unused connection stays open (default 60 s on Vercel, 5 min on a server). |
| `DATABASE_SSL`, `DATABASE_SSL_VERIFY`, `DATABASE_CA_CERT` | Optional TLS controls. Leave unset for Supabase (TLS is verified automatically). `DATABASE_SSL_VERIFY=false` is for emergencies only. |
| `FRONTEND_URL` | Storefront address(es), comma-separated. Allowed browser origins, **and the first one receives the "refresh these pages" calls** after admin saves, so put the live shop URL first. |
| `NEXT_PUBLIC_SITE_URL` | The public shop URL (used in emails and links). |
| `PORT` | Port on a plain server (default 4000). Not needed on Vercel. |
| `JWT_SECRET` (or `AUTH_SECRET`) | Signs admin and customer logins. |
| `REVALIDATION_SECRET` | Shared with the storefront; lets the backend refresh storefront pages after a save. |
| `STORE_PROXY_SECRET` | Shared with the storefront; lets the storefront pass the visitor's real IP (fair rate limits). |
| `JOB_MODE` | `cron` = jobs are sent instantly and retried by the cron routes (current setup). |
| `CRON_SECRET` | Password the cron service sends as `Authorization: Bearer …`. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Email sending. |
| `ORDERS_EMAIL_FROM`, `OFFERS_EMAIL_FROM` | Optional sender names for order and offer emails. |
| `ORDER_ALERT_RECIPIENTS`, `SUPPORT_EMAIL_TO`, `OFFERS_COPY_TO` | Who gets new-order alerts, contact-form mail, and hidden copies of offer emails (the admin setting wins over these). |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE` | R2 media bucket for uploads. |
| `LOCAL_UPLOAD_DIR` | Only when R2 is not configured: a folder on the server for uploads. |
| `REPLAY_S3_BUCKET`, `SESSION_REPLAY_RETENTION_DAYS` | R2 bucket for recordings and how many days to keep them (admin setting wins). |
| `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`, `META_GRAPH_VERSION`, `META_PAGE_ID`, `META_INSTAGRAM_ACCOUNT_ID`, `META_AD_ACCOUNT_ID`, `META_MARKETING_ACCESS_TOKEN` | Meta Pixel / Conversions API and Meta marketing tools. |
| `TIKTOK_PIXEL_ID`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_EVENTS_API_TOKEN`, `TIKTOK_TEST_EVENT_CODE` | TikTok events (off unless switched on). |
| `POSTEX_TRACKING_BASE_URL` | Courier tracking link used in emails. |
| `STORE_SESSION_DAYS`, `STORE_TIMEZONE`, `APP_ENV` | Customer login length (days), shop time zone, environment label. |
| `SENTRY_DSN` | Optional error monitoring. |
| `WORKER_DATABASE_URL`, `WORKER_BACKLOG_REVIEWED` | Only for the optional always-on worker (`compose.worker.yml`); not used in cron mode. |

### Storefront (`frontend/`)

| Name | What it is for |
|---|---|
| `BACKEND_URL` | Backend address used by the storefront server. |
| `NEXT_PUBLIC_API_URL` | Backend address used in the browser (requests go through the storefront's own `/api/store-proxy`). |
| `NEXT_PUBLIC_SITE_URL` | The public shop URL (canonical links, sitemaps, share images). |
| `REVALIDATION_SECRET` | Same value as the backend; protects `/api/revalidate`. |
| `STORE_PROXY_SECRET` | Same value as the backend. |
| `NEXT_PUBLIC_IMAGE_HOSTS` | Extra image hosts allowed for product photos (comma-separated). |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics. |
| `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_TIKTOK_PIXEL_ID` | Browser pixel IDs. |
| `NEXT_PUBLIC_SESSION_REPLAY_ENABLED` | Turns session recording on or off. |
| `NEXT_PUBLIC_HOME_VIDEO_BASE` | **Testing only.** Points the home videos at another folder. Leave it unset in production. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_RELEASE`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional error monitoring and source maps. |

Set by the host (never set them yourself): `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `NODE_ENV`, `NEXT_RUNTIME`.

## 3. Deploy and roll back

- **Deploy:** merge a pull request into `main` after CI is green ("Typecheck, tests, build"). Vercel builds the
  project(s) whose folder changed and switches traffic when the build succeeds. A failed build never replaces the
  live site.
- **Roll back:** Vercel → project → Deployments → pick the last good deployment → "Promote to Production"
  (instant, no rebuild). Then revert the bad change in GitHub so the next deploy does not bring it back.
- **Environment variable change:** save it in the project settings, then "Redeploy" that project. A
  `NEXT_PUBLIC_` change needs a storefront rebuild.
- **Database schema:** never changed by a deploy. Follow `deployment/DATABASE-MIGRATIONS.md`: backup first, test on
  a copy, then apply.

## 4. Cron (scheduled calls)

| Route | Method | Header | Interval | What it does |
|---|---|---|---|---|
| `/api/cron/jobs` | POST | `Authorization: Bearer <CRON_SECRET>` | **Every 5 minutes now.** Later 15–30 minutes, once instant sending has been reliable for a few weeks. | Retries order emails and Meta/TikTok events that did not go out at once (up to 25 per call, 20 s limit; a job stuck in "running" for 10 minutes is picked up again), then sends the 5% cart offer about an hour after a cart was left. An empty queue costs one small database query. |
| `/api/cron/daily` | GET or POST | same | Once a day | Removes old rate-limit rows, expired recordings, and jobs and events older than 30 days; sends the daily summary email. |

- Orders do not wait for the cron: their emails and events are sent right after the order is saved. The cron is
  the safety net.
- `backend/vercel.json` also schedules `/api/cron/daily` on Vercel. Use either that or cron-job.org for the daily
  call, not both, or the daily summary arrives twice.
- **Reading a run:** cron-job.org shows each response. `processed` is jobs handled in that run, `failed` is jobs
  that failed again (they retry later), and `remaining` is jobs still waiting after the run.
- **When the queue grows** (`remaining` above 0 on several runs in a row, or many failed jobs in Admin → Jobs):
  1. open Admin → Jobs and read the error on the failed rows;
  2. the usual causes are email (Resend key or sender domain), a Meta/TikTok token, or the database being
     unreachable;
  3. fix the cause; the next cron runs send the backlog automatically, 25 per call;
  4. if a large backlog has to clear faster, trigger the job once by hand in cron-job.org ("Run now") a few
     times. Do not shorten the schedule permanently.

## 5. Adding products and videos

- **Products:** Admin → Products (one at a time) or the CSV import (templates in `import-templates/`). Photos
  upload to R2 from the admin. Saving refreshes only the affected pages.
- **Home videos:**
  1. upload the `.mp4` (short, vertical, compressed for phones) and a `.jpg` poster of the first frame to the
     `zelvomart-media` bucket, folder `videos/`;
  2. add one row (title, file, poster) to `frontend/storefront/lib/home-videos.ts` and merge it.
  - Never commit video files to the repository.
  - File names with spaces work; they are URL-encoded automatically.

## 6. Watching usage: database egress and CPU

| What | Where to read it | Safe | Act when |
|---|---|---|---|
| Supabase egress (free plan: 5 GB/month) | Supabase → Project → Usage → Egress (mostly "Shared Pooler Egress") | under about 100 MB/day (≈3 GB/month) | above 150 MB/day for two days in a row, or 4 GB used before the month ends |
| Slow or heavy queries | Supabase → Database → Query performance (`pg_stat_statements`) | top query under 20% of total time | one query grows suddenly after a deploy (roll back, then investigate) |
| Vercel CPU (Hobby: 4 CPU-hours/month) | Vercel → Usage → function CPU (Active CPU) | under about 6 minutes/day | above 8 minutes/day (≈4 hours/month) |
| Vercel transfer and invocations | Vercel → Usage | under 70% of the monthly allowance by mid-month | 80% reached before day 20 |

If egress or CPU jumps:

- check Vercel → Logs for a bot hammering one URL (block it in Firewall);
- check that the cron runs every 5 minutes, not every minute;
- check that recordings still go to R2 (`REPLAY_S3_BUCKET` set; Admin → Session replays still plays new ones);
- roll back the last deploy if the jump started with it.

## 7. Vercel Hobby limits

The Hobby plan includes, per month:

- 4 CPU-hours of active function time;
- 10 GB of data transfer;
- 1 million function calls.

Going over can pause the team's projects for up to 30 days. Check the live numbers on the Usage page; they can
change. If a warning email arrives:

1. find the cause with section 6, fix it, and roll back if a deploy caused it;
2. lower the cost of traffic: keep the cron at 15–30 minutes, and block abusive bots in the Firewall;
3. if the team is paused, the fastest way back without waiting is the plain Node server in section 8 (the code
   runs unchanged).

## 8. Moving to a plain Node server (VPS)

Both apps run on any Linux server with Node 22. Nothing in the code needs Vercel: background work keeps running
in the same process, and the pool keeps connections open longer.

1. **Install:** Node 22, git, and a process manager (for example `pm2` or systemd). Clone the repo.
2. **Configure:** create `backend/.env` and `frontend/.env.local` with the variables in section 2, then:
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

## 9. Database backup and restore

- Supabase keeps daily backups on its side (see Database → Backups for what the current plan includes).
- Keep your own copy too: once a week, and always before any schema change or bulk edit, run
  `pg_dump --format=custom --no-owner "<DIRECT_URL>" > zelvomart-YYYY-MM-DD.dump` from a trusted computer. Store
  the file off the server.
- **Restore** into a new, empty database first (never over the live one):
  `pg_restore --no-owner --dbname "<new database URL>" zelvomart-YYYY-MM-DD.dump`. Check it, then point
  `DATABASE_URL`/`DIRECT_URL` at it only if you really need to switch.
- Never run imports, scripts or migrations against the live database without a fresh backup.

## 10. Weekly 5-minute health check

1. Open the shop on a phone: home, a category, a product; add to cart; open checkout (no order needed).
2. Admin → Orders: last week's orders came in; customers received confirmations (spot-check one).
3. Admin → Jobs: no failed jobs piling up. cron-job.org: last runs green, `remaining` is 0.
4. Supabase → Usage: egress on track (section 6).
5. Vercel → Usage: CPU, transfer and invocations under 70% for the point in the month.
6. Resend → Logs: no bounces or failures from the sender domain.
7. Make sure this week's database dump exists (section 9).
