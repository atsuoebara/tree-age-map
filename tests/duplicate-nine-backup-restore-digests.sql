\set ON_ERROR_STOP on
SET TimeZone='UTC';
SET DateStyle='ISO, YMD';
SET IntervalStyle='postgres';
SET extra_float_digits=3;
-- Synthetic fixture ONLY: full-row SHA256 for each table; never run this as an output query for private production data.
SELECT 'runs' AS table_name,id::text AS private_key,
 encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') row_hash FROM fixture.runs t
UNION ALL SELECT 'today',run_id::text,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM fixture.rings_today_run_region_distance t
UNION ALL SELECT 'municipality',run_id::text,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM fixture.territory_run_municipality_distance t
UNION ALL SELECT 'world',run_id::text,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM fixture.territory_run_region_distance t
UNION ALL SELECT 'explore',run_id::text,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM fixture.ranking_explore_verified t
UNION ALL SELECT 'region_cache',singleton::text,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM fixture.region_rings_refresh_state t
UNION ALL SELECT 'fake_pgnet',run_id::text,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') FROM fixture.fake_pgnet_queue t
ORDER BY 1,2,3;
