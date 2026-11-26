#!/bin/bash
# Disposable container only. Fixed synthetic owner; no external connection.
set -euo pipefail
export PGCONNECT_TIMEOUT=2
# Local Unix socket only; never inherit a remote database host.
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGDATABASE PGUSER PGOPTIONS
export PGHOST=/var/run/postgresql
psql_cmd=(psql -X -q -v ON_ERROR_STOP=1 -U postgres -d rings_now_v03_isolated)
writer=''
trap 'if [[ -n "$writer" ]]; then kill "$writer" 2>/dev/null || :; wait "$writer" 2>/dev/null || :; fi' EXIT
# The previous boundary fixture must have rolled back.
"${psql_cmd[@]}" <<'SQL'
DO $check$
BEGIN
 IF EXISTS (SELECT 1 FROM public.runs) THEN RAISE EXCEPTION 'V03_CONCURRENT_REQUIRES_EMPTY'; END IF;
END $check$;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
SELECT '00000000-0000-4000-8000-000000000001'::uuid,DATE '2026-11-17',5,now()-interval '1 hour'
FROM generate_series(1,100);
SQL
# One writer session owns an advisory lock during the entire update series.
# Each UPDATE commits as a unit. The reader must observe both whole states.
(
 printf 'SELECT pg_advisory_lock(730025);\n'
 for ((i=0;i<40;i++)); do
  value=$((5+i%2))
  printf "UPDATE public.runs SET distance_km=%d WHERE user_id='00000000-0000-4000-8000-000000000001';\nSELECT pg_sleep(0.10);\n" "$value"
 done
 printf 'SELECT pg_advisory_unlock(730025);\n'
) | "${psql_cmd[@]}" >/dev/null &
writer=$!
"${psql_cmd[@]}" <<'SQL'
SET statement_timeout='8s';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000000001','role','authenticated','exp',extract(epoch FROM clock_timestamp())+60)::text,false);
DO $probe$
DECLARE p jsonb; lo numeric; hi numeric; seen5 boolean:=false; seen6 boolean:=false; locked boolean:=false;
BEGIN
 FOR i IN 1..50 LOOP
  IF NOT pg_try_advisory_lock(730025) THEN locked:=true; EXIT; END IF;
  PERFORM pg_advisory_unlock(730025);
  PERFORM pg_sleep(0.02);
 END LOOP;
 IF NOT locked THEN RAISE EXCEPTION 'V03_WRITER_NOT_OBSERVED'; END IF;
 FOR i IN 1..50 LOOP
  IF pg_try_advisory_lock(730025) THEN
   PERFORM pg_advisory_unlock(730025);
   RAISE EXCEPTION 'V03_WRITER_ENDED_EARLY';
  END IF;
  p:=public.rings_now_snapshot_candidate_v03();
  IF p->>'status' IS DISTINCT FROM 'candidate_snapshot'
   OR jsonb_array_length(p->'rows') IS DISTINCT FROM 100
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'rows') r WHERE r->>'user_id' IS DISTINCT FROM '00000000-0000-4000-8000-000000000001')
  THEN RAISE EXCEPTION 'V03_CONCURRENT_SHAPE'; END IF;
  SELECT min((r->>'distance_km')::numeric),max((r->>'distance_km')::numeric)
   INTO lo,hi FROM jsonb_array_elements(p->'rows') r;
  IF lo IS NULL OR hi IS NULL OR lo<>hi OR lo NOT IN (5,6) THEN
   RAISE EXCEPTION 'V03_CONCURRENT_MIXED_STATE';
  END IF;
  seen5:=seen5 OR lo=5; seen6:=seen6 OR lo=6;
  PERFORM pg_sleep(0.03);
 END LOOP;
 IF NOT seen5 OR NOT seen6 THEN RAISE EXCEPTION 'V03_NO_STATE_TRANSITION'; END IF;
END $probe$;
SQL
wait "$writer"
writer=''
"${psql_cmd[@]}" <<'SQL'
DELETE FROM public.runs WHERE user_id='00000000-0000-4000-8000-000000000001';
DO $check$
BEGIN
 IF EXISTS (SELECT 1 FROM public.runs) THEN RAISE EXCEPTION 'V03_CONCURRENT_CLEANUP_FAILED'; END IF;
END $check$;
SQL
printf 'V03_CONCURRENT_CLI_REPORTED_NOT_PROOF\n'
