-- SAFETY: READ-ONLY candidate gate, not an authorization for data deletion.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH matched AS MATERIALIZED (
 SELECT i.id target_id,s.id survivor_id,i.user_id owner,
        i.distance_km target_km,s.distance_km survivor_km
 FROM public.runs i
 JOIN public.runs s ON s.user_id=i.user_id
  AND s.source='strava' AND s.deleted_at IS NULL
  AND i.started_at IS NOT NULL AND i.started_at=s.started_at
  AND abs(i.distance_km-s.distance_km)<=greatest(0.5,least(i.distance_km,s.distance_km)*0.08)
 WHERE i.source='intervals' AND i.deleted_at IS NULL
  AND i.activity_date>=DATE '2026-11-01'
  AND i.activity_date<DATE '2026-12-01'
), summary AS (
 SELECT count(*) pairs,count(DISTINCT target_id) target_unique,
 count(DISTINCT survivor_id) survivor_unique,count(DISTINCT owner) owners,
 round(coalesce(sum(target_km),0)::numeric,6) target_km,
 round(coalesce(sum(survivor_km),0)::numeric,6) survivor_km
 FROM matched
), inbox AS (
 SELECT count(*) FILTER (WHERE state IS NULL OR state NOT IN ('saved','duplicate','ignored')) nonterminal
 FROM public.garmin_activity_inbox WHERE user_id IN(SELECT DISTINCT owner FROM matched)
), region AS (
 SELECT count(*) state_rows,
 count(*) FILTER (WHERE publication_enabled IS DISTINCT FROM false OR is_dirty IS DISTINCT FROM true) unsafe
 FROM rr_private.region_rings_refresh_state
), cache AS (SELECT count(*) candidates FROM rr_private.region_rings_public_candidate),
ids AS (SELECT target_id AS run_id FROM matched UNION ALL SELECT survivor_id FROM matched),
children AS (
 SELECT (SELECT count(*) FROM public.rings_today_run_region_distance WHERE run_id IN(SELECT run_id FROM ids)) today_rows,
 (SELECT count(*) FROM public.territory_run_municipality_distance WHERE run_id IN(SELECT run_id FROM ids)) municipality_rows,
 (SELECT count(*) FROM public.territory_run_region_distance WHERE run_id IN(SELECT run_id FROM ids)) world_rows,
 (SELECT count(*) FROM public.ranking_explore_verified WHERE run_id IN(SELECT run_id FROM ids)) explore_rows
)
SELECT s.*,c.today_rows,c.municipality_rows,c.world_rows,c.explore_rows,
 i.nonterminal AS garmin_nonterminal,r.state_rows,r.unsafe AS region_unsafe,
 cache.candidates AS region_candidates,
 CASE WHEN pairs=9 AND target_unique=9 AND survivor_unique=9 AND owners=1
  AND target_km=66.361996::numeric AND survivor_km=65.102340::numeric
  AND i.nonterminal=0 AND r.state_rows=1 AND r.unsafe=0
  AND cache.candidates=0
 THEN 'READONLY_SCREEN_OK_NOT_FREEZE_NOT_BACKUP_NOT_DELETE_AUTH'
 ELSE 'BLOCK' END AS gate
FROM summary s CROSS JOIN inbox i CROSS JOIN region r CROSS JOIN cache CROSS JOIN children c;
COMMIT;
