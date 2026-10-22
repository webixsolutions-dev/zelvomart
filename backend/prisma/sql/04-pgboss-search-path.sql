-- Run by a person AFTER pg-boss has been installed by the launch worker.
-- Tested against an isolated in-memory PostgreSQL copy, never production.
-- pg-boss 10 signatures: create_queue(text, json), delete_queue(text).
-- Rollback: 04-pgboss-search-path-rollback.sql restores the default unset path.
-- Stop if another custom path exists: preserve it before making any change.
begin;

do $$
declare
  signature text;
  function_id oid;
  configured_path text;
begin
  foreach signature in array array['pgboss.create_queue(text,json)', 'pgboss.delete_queue(text)'] loop
    function_id := to_regprocedure(signature);
    if function_id is null then
      raise exception 'Missing function %. Deploy/start the worker first; no changes made.', signature;
    end if;
    select option into configured_path
      from pg_proc p, unnest(p.proconfig) as option
      where p.oid = function_id and option like 'search_path=%';
    if configured_path is not null and configured_path <> 'search_path=pgboss, pg_temp' then
      raise exception 'Unexpected configuration on %: %. Save the original path and review before applying.',
        signature, configured_path;
    end if;
  end loop;
end
$$;

alter function pgboss.create_queue(text, json) set search_path = pgboss, pg_temp;
alter function pgboss.delete_queue(text) set search_path = pgboss, pg_temp;

commit;

-- Both rows must contain search_path=pgboss, pg_temp.
select oid::regprocedure as function_signature, proconfig
from pg_proc
where oid in ('pgboss.create_queue(text,json)'::regprocedure, 'pgboss.delete_queue(text)'::regprocedure);
