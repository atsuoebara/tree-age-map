'use strict';
// Dormant isolated H2 SQL preparation ONLY. No DB connection or invocation.
// Input UUIDs MUST originate from independent GoTrue H1 signin observations.
// Do not execute outside a separately approved run-owned disposable DB.
const assert=require('node:assert/strict');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function buildH2IsolatedSeedSql({ownerA,ownerB}={}){
 assert.match(ownerA||'',UUID,'GoTrue A UUID required');
 assert.match(ownerB||'',UUID,'GoTrue B UUID required');
 assert.notEqual(ownerA.toLowerCase(),ownerB.toLowerCase(),'independent H1 owners required');
 // Both UUIDs are syntactically safe inside SQL literals; never accept raw
 // SQL fragments or caller-selected role/schema/table/function names.
 const a=ownerA.toLowerCase(),b=ownerB.toLowerCase();
 const sql=String.raw`\set ON_ERROR_STOP on
-- RUN-OWNED, DISPOSABLE PostgreSQL ONLY. NOT SUPABASE / PRODUCTION.
-- Must run AFTER canonical isolated schema, authenticator, RPC + H1.
BEGIN;
DO $preflight$
BEGIN
 IF to_regclass('public.runs') IS NULL THEN
  RAISE EXCEPTION 'H2_NO_ISOLATED_RUNS_TABLE';
 END IF;
 IF to_regprocedure('public.rings_now_snapshot_candidate_v01()') IS NULL THEN
  RAISE EXCEPTION 'H2_NO_CANDIDATE_RPC';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_class
  WHERE oid='public.runs'::regclass AND relrowsecurity AND relforcerowsecurity
 ) THEN
  RAISE EXCEPTION 'H2_RLS_NOT_FORCED';
 END IF;
 IF EXISTS (SELECT 1 FROM public.runs) THEN
  RAISE EXCEPTION 'H2_REQUIRES_EMPTY_DISPOSABLE_TABLE';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='p2_h2_no_rpc') THEN
  RAISE EXCEPTION 'H2_DENIED_ROLE_ALREADY_EXISTS';
 END IF;
 IF has_function_privilege('anon',
  'public.rings_now_snapshot_candidate_v01()', 'EXECUTE') THEN
  RAISE EXCEPTION 'H2_ANON_RPC_EXECUTE_PRESENT';
 END IF;
END
$preflight$;
-- Only a NOLOGIN, NOINHERIT isolated role, not authenticated/service_role.
CREATE ROLE p2_h2_no_rpc NOLOGIN NOINHERIT;
GRANT p2_h2_no_rpc TO authenticator;
GRANT USAGE ON SCHEMA public TO p2_h2_no_rpc;
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01()
 FROM p2_h2_no_rpc;
-- One durable row per H1-issued UUID; foreign A must not see B.
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES
 ('${a}'::uuid,DATE '2026-11-18',5.0,
  TIMESTAMPTZ '2026-11-18 00:00:00+00'),
 ('${b}'::uuid,DATE '2026-11-18',6.0,
  TIMESTAMPTZ '2026-11-18 01:00:00+00');
DO $checks$
BEGIN
 IF (SELECT count(*) FROM public.runs WHERE user_id='${a}'::uuid)<>1
    OR (SELECT count(*) FROM public.runs WHERE user_id='${b}'::uuid)<>1
    OR (SELECT count(*) FROM public.runs)<>2 THEN
  RAISE EXCEPTION 'H2_AB_SEED_COUNTS_INVALID';
 END IF;
 IF NOT pg_has_role('authenticator','p2_h2_no_rpc','MEMBER') THEN
  RAISE EXCEPTION 'H2_ROLE_NOT_SWITCHABLE';
 END IF;
 IF has_function_privilege('p2_h2_no_rpc',
  'public.rings_now_snapshot_candidate_v01()', 'EXECUTE') THEN
  RAISE EXCEPTION 'H2_ROLE_HAS_RPC_EXECUTE';
 END IF;
 IF NOT has_schema_privilege('p2_h2_no_rpc','public','USAGE') THEN
  RAISE EXCEPTION 'H2_ROLE_HAS_NO_SCHEMA_USAGE';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles
  WHERE rolname='p2_h2_no_rpc' AND (rolcanlogin OR rolinherit OR rolbypassrls)) THEN
  RAISE EXCEPTION 'H2_ROLE_PRIVILEGES_UNSAFE';
 END IF;
END
$checks$;
COMMIT;
`;
 assert.ok(Buffer.byteLength(sql,'utf8')<8192,'H2 bounded SQL only');
 return sql;
}
module.exports={buildH2IsolatedSeedSql};
