-- 01-lock-public-schema.sql  (audit finding C1)
--
-- Closes the Supabase Data API door on every table in "public":
--   1. revokes every privilege the public roles (anon, authenticated) hold on tables, sequences and functions;
--   2. stops future tables from inheriting those grants (default privileges);
--   3. turns Row-Level Security on for every table, with NO policies for anon/authenticated (defence in depth);
--   4. does the same for the pg-boss schema, if it exists.
--
-- Nothing in this repository uses the Supabase REST/GraphQL Data API: all access is Prisma over a direct
-- Postgres connection, and Prisma connects as the role that owns the tables. Table owners bypass RLS
-- (FORCE ROW LEVEL SECURITY is deliberately NOT used), so the storefront, admin and worker keep working.
--
-- RUN IT AS THE SAME ROLE AS DATABASE_URL (normally "postgres") — in the Supabase SQL editor that is the default.
-- The first block refuses to continue if any table is owned by another role, because RLS would then lock Prisma out.
-- Run on a staging copy first. Rollback: 01-rollback.sql.

begin;

-- 0. Safety checks: stop before changing anything if this would lock the app out.
do $$
declare
  foreign_owned text;
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'Run this as the database owner role (the DATABASE_URL user), not as %', current_user;
  end if;

  select string_agg(format('%I (owner %I)', tablename, tableowner), ', ')
    into foreign_owned
    from pg_tables
   where schemaname = 'public'
     and tableowner <> current_user;

  if foreign_owned is not null then
    raise exception 'These public tables are not owned by %: %. Run as their owner, or change ownership first; RLS would otherwise block Prisma.', current_user, foreign_owned;
  end if;
end
$$;

-- 1. Remove every privilege the public API roles hold today.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- 2. New tables, sequences and functions created later get no grants either
--    (for objects created by this role, which is the role Prisma uses).
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- 3. Row-Level Security on every public table, no policies for the API roles.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end
$$;

-- 4. The job queue's own schema: never reachable by the API roles.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'pgboss') then
    execute 'revoke all on schema pgboss from anon, authenticated';
    execute 'revoke all on all tables in schema pgboss from anon, authenticated';
    execute 'revoke all on all sequences in schema pgboss from anon, authenticated';
    execute 'revoke all on all functions in schema pgboss from anon, authenticated';
  end if;
end
$$;

commit;

-- 5. Check (read-only). Expected: rls_off = 0 and anon_grants = 0.
select
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) as rls_off,
  (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated')) as anon_grants;
