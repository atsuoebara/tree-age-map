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
-- Simulate Supabase's explicit named-role function default privileges.
-- Only this disposable local role is modified, never real Supabase's supabase_admin.
ALTER DEFAULT PRIVILEGES FOR ROLE rings_fixture IN SCHEMA public
 GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Prove the fixture actually creates an explicit 3-role ACL rather than merely
-- the PostgreSQL built-in PUBLIC EXECUTE grant.
CREATE FUNCTION public.rings_now_acl_probe() RETURNS integer
 LANGUAGE sql AS $probe$ SELECT 1 $probe$;
DO $check$ DECLARE acl text; BEGIN
 SELECT proacl::text INTO acl FROM pg_proc
 WHERE oid='public.rings_now_acl_probe()'::regprocedure;
 IF acl IS NULL OR
    NOT EXISTS (SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc
      WHERE oid='public.rings_now_acl_probe()'::regprocedure)) a
      JOIN pg_roles r ON r.oid=a.grantee
      WHERE r.rolname='anon' AND a.privilege_type='EXECUTE') OR
    NOT EXISTS (SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc
      WHERE oid='public.rings_now_acl_probe()'::regprocedure)) a
      JOIN pg_roles r ON r.oid=a.grantee
      WHERE r.rolname='authenticated' AND a.privilege_type='EXECUTE') OR
    NOT EXISTS (SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc
      WHERE oid='public.rings_now_acl_probe()'::regprocedure)) a
      JOIN pg_roles r ON r.oid=a.grantee
      WHERE r.rolname='service_role' AND a.privilege_type='EXECUTE')
 THEN RAISE EXCEPTION 'explicit-role default grants not reproduced: %', acl; END IF;
END $check$;
DROP FUNCTION public.rings_now_acl_probe();

-- The checked-in candidate SQL is loaded verbatim in the workflow, next.
