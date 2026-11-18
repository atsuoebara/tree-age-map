-- Duplicate-nine non-identifying preflight ONLY, 2026-11-19.
-- READ-ONLY SELECT. NO FREEZE AND NO APPROVAL TO DELETE.
-- Must be run against a consistent live database snapshot, no user/run IDs/route data output.
-- Source-pair screen is a CANDIDATE CHECK, not exhaustive GPS verification.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH candidate AS MATERIALIZED (
 SELECT i.id target_id,s.id survivor_id,i.user_id owner,
        i.distance_km target_km,s.distance_km survivor_km
 FROM public.runs i
 JOIN public.runs s ON s.user_id=i.user_id AND s.source='strava'
  AND s.deleted_at IS NULL AND i.started_at IS NOT NULL AND s.started_at=i.started_at
  AND abs(i.distance_km-s.distance_km)<=greatest(0.5,least(i.distance_km,s.distance_km)*0.08)
 WHERE i.source='intervals' AND i.deleted_at IS NULL
   AND i.activity_date>=date '2026-11-01' AND i.activity_date<date '2026-12-01'
),
owners AS (SELECT DISTINCT owner FROM candidate),
inbox AS (
 SELECT count(*) FILTER(WHERE state IS NULL OR state NOT IN ('saved','duplicate','ignored')) nonterminal_count
 FROM public.garmin_activity_inbox WHERE user_id IN (SELECT owner FROM owners)
),
source_groups AS (
 SELECT 'intervals' kind,count(*)::bigint n,
        round(coalesce(sum(target_km),0)::numeric,6) km
 FROM candidate
 UNION ALL
 SELECT 'strava',count(*)::bigint,round(coalesce(sum(survivor_km),0)::numeric,6)
 FROM candidate
),
ids AS (SELECT target_id run_id FROM candidate UNION ALL SELECT survivor_id FROM candidate),
children AS (
 SELECT 'today' kind,count(*)::bigint n FROM public.rings_today_run_region_distance WHERE run_id IN(SELECT run_id FROM ids)
 UNION ALL SELECT 'territory_municipality',count(*)::bigint FROM public.territory_run_municipality_distance WHERE run_id IN(SELECT run_id FROM ids)
 UNION ALL SELECT 'territory_world',count(*)::bigint FROM public.territory_run_region_distance WHERE run_id IN(SELECT run_id FROM ids)
 UNION ALL SELECT 'explore',count(*)::bigint FROM public.ranking_explore_verified WHERE run_id IN(SELECT run_id FROM ids)
),
region AS (
 SELECT count(*) rows_total, count(*) FILTER(WHERE publication_enabled OR is_dirty IS DISTINCT FROM true) unsafe_count
 FROM rr_private.region_rings_refresh_state
),
cache AS (SELECT count(*) n FROM rr_private.region_rings_public_candidate)
SELECT
 (SELECT count(*) FROM candidate) AS candidate_pairs,
 (SELECT count(DISTINCT target_id) FROM candidate) AS distinct_targets,
 (SELECT count(DISTINCT survivor_id) FROM candidate) AS distinct_survivors,
 (SELECT count(*) FROM owners) AS candidate_owners,
 (SELECT km FROM source_groups WHERE kind='intervals') AS target_km,
 (SELECT km FROM source_groups WHERE kind='strava') AS survivor_km,
 (SELECT n FROM children WHERE kind='today') AS today_children,
 (SELECT n FROM children WHERE kind='territory_municipality') AS municipality_children,
 (SELECT n FROM children WHERE kind='territory_world') AS world_children,
 (SELECT n FROM children WHERE kind='explore') AS explore_children,
 (SELECT nonterminal_count FROM inbox) AS owner_garmin_nonterminal,
 (SELECT rows_total FROM region) AS region_state_rows,
 (SELECT unsafe_count FROM region) AS region_state_unsafe,
 (SELECT n FROM cache) AS region_cache_candidates,
 CASE WHEN (SELECT count(*) FROM candidate)=9
 AND (SELECT count(DISTINCT target_id) FROM candidate)=9
 AND (SELECT count(DISTINCT survivor_id) FROM candidate)=9
 AND (SELECT count(*) FROM owners)=1
 AND (SELECT nonterminal_count FROM inbox)=0
 AND (SELECT rows_total FROM region)=1
 AND (SELECT unsafe_count FROM region)=0
 AND (SELECT n FROM cache)=0
 THEN 'PRELIMINARY_READONLY_OK_NOT_FREEZE'
 ELSE 'BLOCK' END AS result;
COMMIT;
