-- SYNTHETIC POSTGRESQL 17 ONLY. NEVER RUN AGAINST SUPABASE / PRODUCTION.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $f$
 SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid
$f$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
CREATE TABLE public.runs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid,
 activity_date date,
 distance_km double precision,
 started_at timestamptz,
 deleted_at timestamptz,
 strava_id text
);
CREATE UNIQUE INDEX runs_user_strava_unique ON public.runs(user_id,strava_id);
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own runs" ON public.runs FOR SELECT TO authenticated
 USING (auth.uid() = user_id);
GRANT SELECT ON public.runs TO anon,authenticated,service_role;
-- The checked-in candidate SQL is loaded verbatim in the workflow, next.
