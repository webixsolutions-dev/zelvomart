-- 01-rollback.sql  — undoes 01-lock-public-schema.sql
--
-- Puts back the Supabase defaults that were in place before: full grants to anon and authenticated
-- on everything in "public" (and pg-boss), and Row-Level Security off on every public table.
-- Use only if the lock broke something; it re-opens the Data API exposure described in audit finding C1.
-- Run as the same role as DATABASE_URL.

begin;

grant all on all tables    in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;

alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I disable row level security', t.tablename);
  end loop;
end
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'pgboss') then
    execute 'grant usage on schema pgboss to anon, authenticated';
    execute 'grant all on all tables in schema pgboss to anon, authenticated';
    execute 'grant all on all sequences in schema pgboss to anon, authenticated';
    execute 'grant all on all functions in schema pgboss to anon, authenticated';
  end if;
end
$$;

commit;
