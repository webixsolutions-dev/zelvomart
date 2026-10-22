-- Restores the default mutable path that existed before 04 was applied.
-- This reopens the security-advisor warning. Does not delete functions or jobs.
-- Apply only to the pg-boss 10 functions changed by 04-pgboss-search-path.sql.
begin;
alter function pgboss.create_queue(text, json) reset search_path;
alter function pgboss.delete_queue(text) reset search_path;
commit;
