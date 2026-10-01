# Vercel + Supabase database connection

The previous Vercel failure was not a Prisma generation or TypeScript problem. Prisma Client generated successfully, then Vercel failed while prerendering because the configured `DATABASE_URL` used Supabase's direct database hostname (`db.<project-ref>.supabase.co:5432`). That endpoint is IPv6 by default, while Vercel requires an IPv4-compatible connection route.

## Vercel environment variable

In Supabase open **Connect** and copy the **Transaction pooler / Supavisor** URI. Put that exact URI in Vercel as `DATABASE_URL`. It normally uses port **6543** and a username shaped like `postgres.<project-ref>`.

For Prisma serverless traffic, append `?pgbouncer=true&connection_limit=1` if the copied URI has no query string. If it already has query parameters, append with `&`. URL-encode special characters in the password (for example `#` becomes `%23`).

Do **not** expose this as `NEXT_PUBLIC_DATABASE_URL`.

## Build behavior

Public database-backed pages are now forced dynamic, so `next build` no longer needs live catalog/page queries. The sitemap also falls back to core static URLs if the database is temporarily unavailable during build. Runtime requests still require a working `DATABASE_URL`.

## Local migrations

For schema changes, use Supabase's **Session pooler** (port 5432) or direct connection from an IPv6-capable machine. Transaction pooler is intended for serverless runtime traffic.
