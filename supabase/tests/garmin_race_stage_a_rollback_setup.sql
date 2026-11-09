-- Minimal isolated PostgreSQL objects required to apply unchanged Stage A SQL.
-- This is a disposable synthetic CI database: no live Supabase credentials.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.runs (
  id bigint PRIMARY KEY,
  user_id uuid,
  source text,
  deleted_at timestamptz
);
CREATE TABLE public.garmin_api_connections (
  user_id uuid PRIMARY KEY,
  garmin_user_id text NOT NULL,
  connection_version uuid NOT NULL,
  import_enabled boolean NOT NULL,
  permissions jsonb NOT NULL
);
CREATE FUNCTION public.garmin_has_export(p_permissions jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p_permissions @> '["ACTIVITY_EXPORT"]'::jsonb,false)
$$;
INSERT INTO public.runs(id,user_id,source)
VALUES (900, '00000000-0000-4000-8000-000000000900','garmin');
