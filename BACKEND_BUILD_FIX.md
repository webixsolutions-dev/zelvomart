# Backend build fix

- Backend no longer imports any code from `frontend/`.
- Worker imports now point to `backend/src/lib/*`.
- WordPress migration storage import now points to `backend/src/lib/storage`.
- Vercel/production TypeScript build compiles only `src/` and `api/`; scripts, workers and seed remain runnable through `tsx` scripts but cannot break the web API deployment build.
- Express route parameters are normalized to strings before passing to Prisma.
- Local declaration added for `sanitize-html`.
- Prisma seed JSON value is explicitly typed.

## Vercel Backend Project
Set Root Directory to `backend`.
Build Command: `npm run build`

Required environment variables:
- `DATABASE_URL`
- `DIRECT_URL`
- `FRONTEND_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

After deployment verify `/api/health` returns `{ "ok": true }`.
