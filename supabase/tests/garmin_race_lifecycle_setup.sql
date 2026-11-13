-- Isolated lifecycle fixture for proposed schema, no production data.
DO $roles$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $roles$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.runs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid, source text, deleted_at timestamptz,
 UNIQUE(id,user_id)
);
CREATE TABLE public.garmin_api_connections(
 user_id uuid PRIMARY KEY, garmin_user_id text NOT NULL,
 connection_version uuid NOT NULL, import_enabled boolean NOT NULL,
 permissions jsonb NOT NULL,
 permissions_checked_at timestamptz
);
CREATE FUNCTION public.garmin_has_export(p_permissions jsonb) RETURNS boolean
 LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(p_permissions @> '["ACTIVITY_EXPORT"]'::jsonb,false)
$$;
GRANT SELECT ON public.runs TO authenticated;
GRANT UPDATE (deleted_at) ON public.runs TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
-- Actual production runs RLS has owner UPDATE/SELECT; emulate in disposable DB.
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_runs_select ON public.runs FOR SELECT TO authenticated
 USING (auth.uid() = user_id);
CREATE POLICY test_runs_update ON public.runs FOR UPDATE TO authenticated
 USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
