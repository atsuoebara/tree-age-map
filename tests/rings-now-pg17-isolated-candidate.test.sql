-- SYNTHETIC ONLY; local ephemeral PG17 container. No real accounts/records.
\set ON_ERROR_STOP on
-- Candidate must exist after the verbatim PR #152 SQL has been loaded.
DO $a$ BEGIN
 IF to_regprocedure('public.rings_now_snapshot_candidate_v01()') IS NULL THEN
  RAISE EXCEPTION 'candidate function absent';
 END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.rings_now_snapshot_candidate_v01()'::regprocedure)
 THEN RAISE EXCEPTION 'candidate unexpectedly SECURITY DEFINER'; END IF;
 IF has_function_privilege('anon','public.rings_now_snapshot_candidate_v01()','EXECUTE')
 OR has_function_privilege('service_role','public.rings_now_snapshot_candidate_v01()','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.rings_now_snapshot_candidate_v01()','EXECUTE')
 THEN RAISE EXCEPTION 'effective ACL differs from expected'; END IF;
 -- Confirm named-role grants (not only PUBLIC) were removed in raw proacl.
 IF EXISTS (
   SELECT 1
   FROM aclexplode((SELECT proacl FROM pg_proc
     WHERE oid='public.rings_now_snapshot_candidate_v01()'::regprocedure)) a
   LEFT JOIN pg_roles r ON r.oid=a.grantee
   WHERE a.privilege_type='EXECUTE' AND
         (a.grantee=0 OR r.rolname IN ('anon','service_role'))
 ) THEN RAISE EXCEPTION 'PUBLIC, anon or service_role explicit EXECUTE leaked in proacl'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc
     WHERE oid='public.rings_now_snapshot_candidate_v01()'::regprocedure)) a
   JOIN pg_roles r ON r.oid=a.grantee
   WHERE r.rolname='authenticated' AND a.privilege_type='EXECUTE'
 ) THEN RAISE EXCEPTION 'authenticated explicit EXECUTE absent in proacl'; END IF;
 IF (SELECT NOT relrowsecurity FROM pg_class WHERE oid='public.runs'::regclass)
 THEN RAISE EXCEPTION 'RLS disabled'; END IF;
END $a$;

-- anon has table SELECT but no SELECT policy; both must stay true.
SET ROLE anon;
DO $a$ BEGIN
 IF (SELECT count(*) FROM public.runs) <> 0 THEN
  RAISE EXCEPTION 'anon unexpectedly saw rows'; END IF;
END $a$;
RESET ROLE;

-- Place unrelated-owner and soft-deleted records alongside a valid synthetic run.
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES
 ('123e4567-e89b-42d3-a456-426614174000','2026-11-15',5.3,'2026-11-15T08:01:02.123456+09:00'),
 ('123e4567-e89b-42d3-a456-426614174001','2026-11-15',8.1,'2026-11-15T08:11:02Z');
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at,deleted_at)
VALUES ('123e4567-e89b-42d3-a456-426614174000','2026-11-14',3.2,'2026-11-14T05:00Z','2026-11-15T05:00Z');

-- Supabase-style claim is SIMULATED via session config, NOT a verified JWT.
SET ROLE authenticated;
DO $a$ DECLARE o jsonb; a jsonb; BEGIN
 o:=public.rings_now_snapshot_candidate_v01();
 IF o <> '{"status":"blocked","reason":"unauthenticated"}'::jsonb
 THEN RAISE EXCEPTION 'missing JWT claim must block'; END IF;
END $a$;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174000',false);
DO $a$ DECLARE o jsonb; r jsonb; BEGIN
 o:=public.rings_now_snapshot_candidate_v01();
 IF o->>'status'<>'candidate_snapshot' OR jsonb_array_length(o->'rows')<>1
 THEN RAISE EXCEPTION 'owner snapshot size incorrect'; END IF;
 r:=o->'rows'->0;
 IF (SELECT count(*) FROM jsonb_object_keys(r))<>6 OR r ? 'route'
 OR r->>'user_id'<>'123e4567-e89b-42d3-a456-426614174000'
 OR r->>'started_at' IS NULL
 THEN RAISE EXCEPTION 'six-key owner row contract invalid'; END IF;
END $a$;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174001',false);
DO $a$ DECLARE o jsonb; BEGIN
 o:=public.rings_now_snapshot_candidate_v01();
 IF o->>'status'<>'candidate_snapshot' OR jsonb_array_length(o->'rows')<>1
 OR o->'rows'->0->>'user_id'<>'123e4567-e89b-42d3-a456-426614174001'
 THEN RAISE EXCEPTION 'owner B isolation violated'; END IF;
END $a$;
RESET ROLE;

-- Missing required field rejects the entire output without a rows key.
UPDATE public.runs SET started_at=NULL
 WHERE user_id='123e4567-e89b-42d3-a456-426614174000' AND deleted_at IS NULL;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174000',false);
DO $a$ DECLARE o jsonb; BEGIN
 o:=public.rings_now_snapshot_candidate_v01();
 IF o<>'{"status":"blocked","reason":"missing_required_fields"}'::jsonb
 THEN RAISE EXCEPTION 'NULL must fully block without rows'; END IF;
END $a$;
RESET ROLE;

TRUNCATE public.runs RESTART IDENTITY;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174000',false);
DO $a$ DECLARE o jsonb; BEGIN
 o:=public.rings_now_snapshot_candidate_v01();
 IF o<>'{"status":"candidate_snapshot","rows":[]}'::jsonb
 THEN RAISE EXCEPTION 'zero-run result wrong'; END IF;
END $a$;
RESET ROLE;

-- Create 1000 synthetic records: success; create 1001: full block.
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
SELECT '123e4567-e89b-42d3-a456-426614174000'::uuid,
 '2026-11-15'::date,5.0,'2026-11-15T00:00:00Z'::timestamptz
 FROM generate_series(1,1000);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174000',false);
DO $a$ DECLARE o jsonb; BEGIN
 o:=public.rings_now_snapshot_candidate_v01();
 IF o->>'status'<>'candidate_snapshot' OR jsonb_array_length(o->'rows')<>1000
 THEN RAISE EXCEPTION 'exactly 1000 rows must be allowed'; END IF;
END $a$;
RESET ROLE;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('123e4567-e89b-42d3-a456-426614174000','2026-11-15',5,'2026-11-15T00:00Z');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174000',false);
DO $a$ DECLARE o jsonb; BEGIN
 o:=public.rings_now_snapshot_candidate_v01();
 IF o<>'{"status":"blocked","reason":"too_many_rows"}'::jsonb
 THEN RAISE EXCEPTION '1001 rows must fully block'; END IF;
END $a$;
RESET ROLE;
-- too_many_rows must take priority even when sampled has a NULL.
UPDATE public.runs SET started_at=NULL WHERE id=1;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174000',false);
DO $a$ BEGIN
 IF public.rings_now_snapshot_candidate_v01()<>'{"status":"blocked","reason":"too_many_rows"}'::jsonb
 THEN RAISE EXCEPTION 'wrong 1001/NULL priority'; END IF;
END $a$;
RESET ROLE;
\echo 'PASS: synthetic PG17 candidate, INVOKER, ACL, RLS, 0/1/1000/1001 and NULL block'
