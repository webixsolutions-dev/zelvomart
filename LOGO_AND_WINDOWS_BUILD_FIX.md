# Logo + Windows build cleanup fix

- Replaced generated Z/wordmark UI with the supplied Zelvomart PNG logo in storefront header/footer and admin login/sidebar/session/print areas.
- Added the supplied logo as `frontend/public/images/zelvomart-logo.png` with only transparent outer padding cropped.
- Added the same logo as the site icon.
- Removed `.next` from the automatic prebuild cleanup. On Windows/Turbopack, deleting `.next` during npm prebuild can fail with `ENOTEMPTY` or `EPERM`; Next.js manages this directory itself.
- Legacy source cleanup remains enabled for old NextAuth/Prisma frontend leftovers.
