# Vercel / Supabase runtime DB fix

The previous deployment reached Supabase successfully but timed out because DATABASE_URL used `connection_limit=1` while the Next.js render tree performs several database reads in parallel.

Use these Vercel environment variables (replace credentials):

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=30"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@POOLER_HOST:5432/postgres"
```

This build also marks DB-backed storefront/admin routes as dynamic so `next build` does not query production data while generating static pages. `DIRECT_URL` is reserved for Prisma schema/migration commands.
