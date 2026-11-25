-- Rings Now P2 isolated fixture V2 CANDIDATE. NOT RUN / NOT FOR PRODUCTION.
-- NOT wired to any workflow, real PostgREST or Supabase.
-- A future disposable PostgreSQL-only runner must inspect its own exact HEAD.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;
-- Read candidate auth.uid() directly; do not copy/paste a substitute.
-- \ir resolves relative to this fixture file (tests/fixtures).
\ir ../rings-now-p2-auth-uid-guc-CANDIDATE.sql
CREATE TABLE public.runs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL,
 activity_date date,
 distance_km double precision,
 started_at timestamptz,
 deleted_at timestamptz
);
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs FORCE ROW LEVEL SECURITY;
CREATE POLICY p2_owner_read ON public.runs FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()));
-- Explicit ACL must run AFTER creating/replacing auth.uid().
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON TABLE public.runs FROM PUBLIC, anon, service_role;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT SELECT ON TABLE public.runs TO authenticated;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
-- Match the production auth.jwt() definition observed in metadata-only review.
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$function$;
REVOKE ALL ON FUNCTION auth.jwt() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;
COMMIT;
-- Future isolated runtime MUST verify effective privileges, inherited roles,
-- auth.uid() output for actual signed JWT, and 1000/1001 row snapshots.
-- Never treat static checks as evidence of SQL execution.
