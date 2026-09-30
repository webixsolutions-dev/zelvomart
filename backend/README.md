# Backend

This folder contains the non-UI backend/operations layer:

- `prisma/` — PostgreSQL schema and seed
- `workers/` — pg-boss background jobs (emails, Meta Purchase, daily summary, tracking health)
- `scripts/` — WordPress/WooCommerce migration, URL QA/export, backup/restore tools
- `migration/` — migration support files

Run backend commands from the project ROOT, not from this folder:

```bat
npm run prisma:generate
npm run db:push
npm run seed
npm run worker
```
