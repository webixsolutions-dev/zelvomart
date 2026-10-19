# Database migration policy

The configured legacy database has no established Prisma migration baseline.
Do not run `prisma migrate deploy`, `migrate reset`, or `db push` against that
database as a launch shortcut. This launch-readiness change adds no schema fields.

Until a verified baseline is recorded, use only reviewed, additive SQL scripts with
a backup and a transaction. The previously applied admin brief SQL is documented
in ADMIN-BRIEF-ROLLOUT.md. Never mark a historical migration as applied merely
because its filename exists: compare its tables, indexes, constraints and defaults
against the actual database first.

Before the next schema change:

1. Take a database backup and record the current schema without credentials.
2. Introspect the actual schema into a separate temporary Prisma schema.
3. Compare it with the repository schema, including custom columns added outside Prisma.
4. Generate and review a baseline SQL representation of the actual existing schema.
5. Test baseline resolution and the next additive migration on a restored copy.
6. Only then record the verified baseline in production and enable normal deployment migrations.

No baseline or production migration was applied during the 20 October local-only work.
