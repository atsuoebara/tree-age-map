-- Isolated PostgreSQL CI fixture. NO production Supabase connection.
-- Run from repository root with psql -X -v ON_ERROR_STOP=1:
-- psql "$TEST_DATABASE_URL" -f supabase/tests/garmin_race_rpc_setup.sql
-- psql "$TEST_DATABASE_URL" -f supabase/garmin-race-analysis-commit-rpc-review.sql
-- psql "$TEST_DATABASE_URL" -f supabase/tests/garmin_race_rpc_cases.sql
-- Entire fixture uses synthetic UUIDs and in-memory/ephemeral CI PostgreSQL.

DO $roles$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $roles$;

CREATE TABLE public.garmin_api_connections (
  user_id uuid PRIMARY KEY,
  garmin_user_id text NOT NULL,
  connection_version uuid NOT NULL,
  import_enabled boolean NOT NULL,
  permissions jsonb NOT NULL,
  permissions_checked_at timestamptz
);
CREATE TABLE public.garmin_activity_inbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  garmin_user_id text NOT NULL,
  connection_version uuid,
  state text NOT NULL,
  attempts integer NOT NULL,
  payload jsonb NOT NULL,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_date date,
  started_at timestamptz,
  distance_km double precision,
  name text,
  route jsonb,
  source text,
  source_external_id text,
  deleted_at timestamptz,
  UNIQUE (id,user_id)
);
CREATE UNIQUE INDEX runs_test_garmin_ext_id ON public.runs(user_id,source_external_id)
 WHERE source='garmin' AND source_external_id IS NOT NULL;
CREATE TABLE public.run_race_analysis (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  run_id bigint NOT NULL,
  analysis_version text NOT NULL,
  source_kind text NOT NULL,
  source_connection_version uuid NOT NULL,
  distance_basis text NOT NULL,
  time_basis text NOT NULL,
  sample_count integer NOT NULL,
  total_distance_m double precision NOT NULL,
  total_clock_elapsed_s double precision NOT NULL,
  segments jsonb NOT NULL,
  overall_flags jsonb NOT NULL,
  UNIQUE (user_id,run_id,analysis_version),
  FOREIGN KEY (run_id,user_id) REFERENCES public.runs(id,user_id) ON DELETE CASCADE
);

CREATE FUNCTION public.garmin_has_export(p_permissions jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce(p_permissions @> '["ACTIVITY_EXPORT"]'::jsonb,false)
$$;

INSERT INTO public.garmin_api_connections
(user_id,garmin_user_id,connection_version,import_enabled,permissions,permissions_checked_at)
VALUES ('00000000-0000-4000-8000-000000000001','ci-garmin',
        '00000000-0000-4000-8000-000000000002',true,
        '["ACTIVITY_EXPORT"]'::jsonb,now());
