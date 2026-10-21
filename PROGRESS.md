# Progress

Work from the 21 October 2026 audit, done in batches, one branch each. Finding IDs (C1, H5, …) refer to the
audit report kept outside this repository.

## Batch 1: security (branch `fix/security-batch-1`)

| Item | Status | Notes |
|---|---|---|
| C1: lock the public schema (SQL + rollback) | Done (files only) | `backend/prisma/sql/`. Not run on any Supabase project: a person runs it, steps in the README there. |
| H5: admin 2FA, session checks, token lifetime, seed, env names | In progress | |
| K5: database TLS verification | To do | |
| Zod validation on admin product, category, page and redirect writes | To do | |

### Left for a person (not code)
- Run `01-lock-public-schema.sql`, staging first.
- Remove `public` from the Supabase Data API exposed schemas.
