# Admin cache / loading update

- Added an in-memory stale-while-revalidate cache for admin API data.
- Cached admin pages render immediately when revisited instead of showing the Loading card again.
- Admin API requests are deduplicated while one request is already in flight.
- Cache is fresh for 90 seconds; stale data remains visible while it refreshes quietly in the background.
- Sidebar hover/focus prefetches the corresponding admin API route before navigation.
- Removed the blocking "Loading admin portal…" screen. Saved admin user details render the shell immediately while `/api/auth/me` validates in the background.
- Dashboard, Tracking and Reports render a zero-state immediately on the very first visit instead of a blocking loader.
- Removed the full `location.reload()` after creating a product; product data now refreshes in place.
- Admin data cache is cleared on sign-in/sign-out so one admin session cannot reuse another session's in-memory data.

Important: authenticated admin responses are intentionally **not CDN cached**. Admin caching is client-side memory caching so private order/customer/admin data is not stored in a public CDN cache.

Build-fix: canonical cache module is useAdminData.tsx; duplicate .ts removed.
