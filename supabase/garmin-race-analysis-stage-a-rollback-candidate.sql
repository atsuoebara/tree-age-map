-- Runner's Rings / Garmin optional analysis: STAGE A ROLLBACK CANDIDATE ONLY.
-- REVIEW ONLY. DO NOT EXECUTE ON PRODUCTION without separate Atsuo approval.
-- Scope: undo ONLY the exact additions from Stage A. Fail closed if analysis
-- contains ANY rows or if later Stage B has installed the 4-argument RPC.
-- This script cannot substitute for independently verified backup/recovery.
-- One connection, psql -X -v ON_ERROR_STOP=1 -f <approved-file>.
BEGIN;

-- Constrain waiting on concurrent live writers; do not let an unbounded rollback
-- hold locks. Timeouts are local to this transaction, not global defaults.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

-- All guards run BEFORE any DROP, in this same transaction.
DO $guard$
DECLARE
  r oid;
  cols text[];
BEGIN
  IF to_regclass('public.run_race_analysis') IS NULL THEN
    RAISE EXCEPTION 'STOP: Stage A analysis table is missing';
  END IF;
  IF to_regclass('public.runs_id_user_id_race_analysis_uq') IS NULL THEN
    RAISE EXCEPTION 'STOP: Stage A composite index is missing';
  END IF;
  IF to_regprocedure('public.garmin_commit_activity(bigint,integer,jsonb,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: Stage B four-argument RPC exists: do not use Stage A-only rollback';
  END IF;
  IF to_regprocedure('public.purge_race_analysis_on_soft_delete()') IS NULL
     OR to_regprocedure('public.purge_race_analysis_on_garmin_change()') IS NULL THEN
    RAISE EXCEPTION 'STOP: Stage A trigger function is absent';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.runs'::regclass
      AND tgname='purge_race_analysis_on_soft_delete'
      AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.garmin_api_connections'::regclass
      AND tgname='purge_race_analysis_on_garmin_change'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STOP: expected Stage A trigger is absent';
  END IF;
  SELECT array_agg(a.attname ORDER BY a.attname) INTO cols
  FROM pg_attribute a
  WHERE a.attrelid='public.run_race_analysis'::regclass
    AND a.attnum>0 AND NOT a.attisdropped;
  IF cols IS DISTINCT FROM ARRAY[
    'analysis_version','created_at','distance_basis','id','overall_flags',
    'run_id','sample_count','segments','source_connection_version',
    'source_kind','time_basis','total_clock_elapsed_s','total_distance_m','user_id'
  ]::text[] THEN
    RAISE EXCEPTION 'STOP: analysis table column set differs from Stage A; inspect later changes';
  END IF;
  -- This lock prevents concurrent inserts between checking for data and
  -- removing the relation; the guard is absolute, even for one test row.
  EXECUTE 'LOCK TABLE public.run_race_analysis IN ACCESS EXCLUSIVE MODE';
  IF EXISTS (SELECT 1 FROM public.run_race_analysis LIMIT 1) THEN
    RAISE EXCEPTION 'STOP: analysis table contains data; preserve user analysis and redesign rollback';
  END IF;
END
$guard$;

-- RESTRICT deliberately refuses to erase later dependent objects.
DROP TRIGGER purge_race_analysis_on_soft_delete ON public.runs;
DROP TRIGGER purge_race_analysis_on_garmin_change ON public.garmin_api_connections;
DROP FUNCTION public.purge_race_analysis_on_soft_delete() RESTRICT;
DROP FUNCTION public.purge_race_analysis_on_garmin_change() RESTRICT;
DROP TABLE public.run_race_analysis RESTRICT;
DROP INDEX public.runs_id_user_id_race_analysis_uq RESTRICT;
COMMIT;
