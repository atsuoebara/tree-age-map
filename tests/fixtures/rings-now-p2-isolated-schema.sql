-- SYNTHETIC ISOLATED POSTGRES ONLY. NOT FOR PRODUCTION. NOT EXECUTED.
-- PostgREST authenticates JWT, switches to authenticated, and sets request.jwt.claim.sub.
-- This is a test approximation, not a replacement for hosted Supabase auth.
BEGIN;
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
SET search_path = '' AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE public.runs (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 activity_date date,
 distance_km numeric,
 started_at timestamptz,
 deleted_at timestamptz
);
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs FORCE ROW LEVEL SECURITY;
CREATE POLICY p2_owner_read ON public.runs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON TABLE public.runs FROM PUBLIC, anon, service_role;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT SELECT ON public.runs TO authenticated;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
COMMIT;
-- Runner must create login authenticator role with NOINHERIT and grant membership,
-- apply original candidate SQL only after checking its immutable Git blob/hash,
-- and test actual effective privileges. Do not create users in production.
