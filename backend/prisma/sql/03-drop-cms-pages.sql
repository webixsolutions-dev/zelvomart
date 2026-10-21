-- 03 — Remove every CMS page (Admin → Pages is gone). A person runs this by hand; nothing runs it on deploy.
--
-- After this, the four policy pages (privacy-policy, terms-conditions, shipping-policy, refund_returns) show
-- the text from the code (frontend/storefront/lib/policies), and any other old page slug answers 404.
-- The table itself stays (the backend's GET /api/pages/:slug still reads it and now always answers 404).
-- It cannot be undone; copy anything you want to keep first.
--
-- Run in the Supabase SQL editor as the postgres role.

begin;

-- What is about to go (for the record in the editor output).
select slug, title, published, "updatedAt" from public."Page" order by slug;

delete from public."Page";

commit;

-- Check: must be 0.
select count(*) as pages_left from public."Page";
