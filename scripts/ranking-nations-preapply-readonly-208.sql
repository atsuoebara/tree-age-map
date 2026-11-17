-- PR #208 pre-apply verification ONLY. SELECT, no writes.
-- STOP if any *_ok field is false or no row is returned.
-- The expected hash is from the 2026-11-17 approved read-only preflight.
-- Recheck immediately BEFORE any separately authorized DB operation.
WITH target AS (
 SELECT p.oid, p.proowner, p.prosecdef,p.provolatile,p.proconfig,p.proacl,
        pg_get_function_identity_arguments(p.oid) AS identity_args,
        pg_get_function_result(p.oid) AS result_signature,
        pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
   AND p.proname='ranking_nations_monthly'
   AND pg_get_function_identity_arguments(p.oid)='p_year integer, p_month integer'
)
SELECT
 md5(definition) AS definition_md5,
 (md5(definition)='a7c4bf3f7944f2d1c3bb872d79f406b4') AS expected_definition_ok,
 (pg_get_userbyid(proowner)='postgres') AS owner_ok,
 (prosecdef AND provolatile='s' AND proconfig @> ARRAY['search_path=""']::text[]) AS security_contract_ok,
 (result_signature='TABLE(place bigint, country text, participants bigint, km numeric, month_km numeric)') AS signature_ok,
 (has_function_privilege('anon',oid,'EXECUTE') AND has_function_privilege('authenticated',oid,'EXECUTE')
  AND NOT has_function_privilege('public',oid,'EXECUTE')) AS grants_ok,
 (position('round(sum(month_km),1) AS month_km' IN definition)>0) AS old_month_output_still_present
FROM target;
