# Admin authentication/session update

- Removed authenticator/TOTP/2FA from the admin login flow and Users & Roles UI.
- Admin login now uses email + password only.
- The frontend exchanges successful backend login credentials for an 8-hour HttpOnly, SameSite=Lax admin session cookie.
- Authenticated admin API calls are proxied server-side through `/api/admin-proxy/*`; the backend JWT is no longer stored/read from browser localStorage.
- `/admin` and `/admin/*` are protected by Next.js 16 `proxy.ts`; without a current session cookie the request is redirected to `/admin/login` before the dashboard route renders.
- `AdminShell` validates `/api/auth/me` before rendering any admin page, preventing the previous dashboard flash/UNAUTHORIZED state when a stale or invalid session exists.
- Expired/invalid API sessions automatically clear the cookie and return the user to `/admin/login`.
- Sign out clears the HttpOnly session and cached admin data.
- Backend role/permission checks remain in place for every protected admin API.
- Legacy Prisma 2FA columns are intentionally left in the database schema for compatibility; they are no longer used by authentication or exposed in admin UI.
