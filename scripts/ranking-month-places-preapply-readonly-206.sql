-- PR #206 / #205 pre-apply catalog check. READ ONLY; no user records returned.
-- STOP if missing_schema_columns <> 0, badge_dependency_ok is false,
-- or any month-place RPC unexpectedly already exists.
WITH req(tbl,col) AS (
 VALUES
 ('runs','user_id'),('runs','id'),('runs','deleted_at'),('runs','distance_km'),('runs','activity_date'),
 ('ranking_explore_verified','user_id'),('ranking_explore_verified','run_id'),
 ('ranking_explore_verified','region_name'),('ranking_explore_verified','region_code'),
 ('ranking_explore_verified','activity_year'),('ranking_explore_verified','run_country'),
 ('ranking_settings','user_id'),('ranking_settings','ranking_display_name'),
 ('ranking_settings','show_ranking_name'),('ranking_settings','show_flag'),
 ('ranking_settings','join_distance'),('ranking_settings','join_explore'),('ranking_settings','show_regions')
), schema_check AS (
 SELECT count(*) AS expected_columns,
 count(*) FILTER (WHERE c.column_name IS NULL) AS missing_schema_columns
 FROM req LEFT JOIN information_schema.columns c
   ON c.table_schema='public' AND c.table_name=req.tbl AND c.column_name=req.col
), existing_functions AS (
 SELECT count(*) AS existing_month_places
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('ranking_distance_month_places','ranking_explore_month_places','ranking_nations_month_places')
)
SELECT s.expected_columns,s.missing_schema_columns,
 to_regprocedure('public.runner_badge_codes(uuid)') IS NOT NULL AS badge_dependency_ok,
 f.existing_month_places,
 (s.missing_schema_columns=0
  AND to_regprocedure('public.runner_badge_codes(uuid)') IS NOT NULL
  AND f.existing_month_places=0) AS preflight_ok
FROM schema_check s CROSS JOIN existing_functions f;
