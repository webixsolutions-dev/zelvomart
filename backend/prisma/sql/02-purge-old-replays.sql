-- 02 — Purge every stored session recording (audit C4). A person runs this by hand; nothing runs it on deploy.
--
-- Why: SessionReplayChunk held ~595 MB of inline jsonb events and pushed the database over its plan limit.
-- From this release recordings are written only to the private R2 bucket, so the old rows are not needed.
-- This deletes ALL recordings (not only old ones) and cannot be undone. Back up first if you want them.
--
-- Run in the Supabase SQL editor as the postgres role, in a quiet hour. VACUUM FULL locks both tables while
-- it runs (seconds to a few minutes); recording requests during that time fail quietly, orders are not affected.

set statement_timeout = 0;
set lock_timeout = '30s';

begin;

-- Orders keep their data; only the link to a recording that no longer exists is cleared.
update public."Order" set "replaySessionId" = null where "replaySessionId" is not null;

-- Chunks first (they reference the sessions), then the sessions.
delete from public."SessionReplayChunk";
delete from public."SessionReplay";

commit;

-- Gives the freed disk space back. Must run outside a transaction: run these two lines on their own
-- if your SQL editor wraps everything in one transaction.
vacuum full public."SessionReplayChunk";
vacuum full public."SessionReplay";

-- Check: both counts 0, and the table sizes are now small.
select
  (select count(*) from public."SessionReplayChunk") as chunks_left,
  (select count(*) from public."SessionReplay") as sessions_left,
  pg_size_pretty(pg_total_relation_size('public."SessionReplayChunk"')) as chunk_table_size,
  pg_size_pretty(pg_database_size(current_database())) as database_size;
