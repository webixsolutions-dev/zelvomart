Zelvomart clean build release

This project uses the separated architecture:
- frontend = Next.js storefront/admin UI
- backend = Express/Prisma/API

The frontend MUST NOT contain the old NextAuth/Prisma server implementation.

Expected frontend/app/api routes:
- admin-proxy/[...path]/route.ts
- admin-session/login/route.ts
- admin-session/logout/route.ts
- contact/route.ts
- revalidate/route.ts

Expected frontend/lib files do not include auth.ts, db.ts, order.ts, jobs.ts,
meta.ts, rate-limit.ts, sanitize.ts, storage.ts, or permissions.ts.

If you previously extracted a new ZIP on top of an older folder, run
CLEAN_STALE_FRONTEND.bat once or, preferably, extract this ZIP into a fresh
empty folder.

Recommended commands from project root:
  npm install
  npm run prisma:generate
  npm run build
