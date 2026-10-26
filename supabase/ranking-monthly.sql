-- Additive RPCs preserve existing annual membership, ordering and disclosure.
-- Month refers to saved activity_date within p_year, without timestamp conversion.
CREATE OR REPLACE FUNCTION public.ranking_distance_monthly(p_year integer, p_month integer)
 RETURNS TABLE(place bigint, ranking_display_name text, country text, show_flag boolean, badge_codes text[], km numeric, month_km numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH totals AS (
    SELECT r.user_id,round(sum(r.distance_km::numeric),1) AS private_km,
      round(coalesce(sum(r.distance_km::numeric) FILTER (WHERE extract(month FROM r.activity_date)=p_month),0),1) AS month_km
    FROM public.runs r
    WHERE r.user_id IS NOT NULL
      AND r.activity_date>=make_date(p_year,1,1)
      AND r.activity_date<make_date(p_year+1,1,1)
      AND r.distance_km>0 AND r.deleted_at IS NULL
    GROUP BY r.user_id
  ), ranked AS (
    SELECT t.*,row_number() OVER (ORDER BY t.private_km DESC,t.user_id) AS place
    FROM totals t
  )
  SELECT r.place,
         CASE WHEN coalesce(s.show_ranking_name,false) AND nullif(btrim(s.ranking_display_name),'') IS NOT NULL
              THEN s.ranking_display_name ELSE NULL END,
         CASE WHEN coalesce(s.show_flag,false) THEN s.country ELSE NULL END,
         coalesce(s.show_flag,false),
         public.runner_badge_codes(r.user_id),
         CASE WHEN coalesce(s.join_distance,false) THEN r.private_km ELSE NULL END,
         CASE WHEN coalesce(s.join_distance,false) THEN r.month_km ELSE NULL END
  FROM ranked r LEFT JOIN public.ranking_settings s ON s.user_id=r.user_id
  ORDER BY r.place LIMIT 100;
$function$
;
REVOKE ALL ON FUNCTION public.ranking_distance_monthly(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_distance_monthly(integer,integer) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.ranking_explore_monthly(p_year integer, p_country text, p_month integer)
 RETURNS TABLE(place bigint, ranking_display_name text, country text, show_flag boolean, show_regions boolean, region_names text[], badge_codes text[], regions bigint, month_regions bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH distinct_regions AS (
    SELECT v.user_id,v.run_country,v.region_code,min(v.region_name) AS region_name,
      min((SELECT r.activity_date FROM public.runs r WHERE r.id=v.run_id AND r.user_id=v.user_id AND r.deleted_at IS NULL AND extract(year FROM r.activity_date)=p_year)) AS first_date
    FROM public.ranking_explore_verified v
    WHERE v.activity_year=p_year AND v.run_country=upper(p_country)
    GROUP BY v.user_id,v.run_country,v.region_code
  ), totals AS (
    SELECT d.user_id,d.run_country,count(*) AS private_region_count,
           count(*) FILTER (WHERE extract(month FROM d.first_date)=p_month) AS month_regions,
           array_agg(d.region_name ORDER BY d.region_name) AS region_names
    FROM distinct_regions d GROUP BY d.user_id,d.run_country
  ), ranked AS (
    SELECT t.*,row_number() OVER (ORDER BY t.private_region_count DESC,t.user_id) AS place
    FROM totals t
  )
  SELECT r.place,
         CASE WHEN coalesce(s.show_ranking_name,false) AND nullif(btrim(s.ranking_display_name),'') IS NOT NULL
              THEN s.ranking_display_name ELSE NULL END,
         CASE WHEN coalesce(s.show_flag,false) THEN s.country ELSE NULL END,
         coalesce(s.show_flag,false),coalesce(s.show_regions,false),
         CASE WHEN coalesce(s.show_regions,false) THEN r.region_names ELSE ARRAY[]::text[] END,
         public.runner_badge_codes(r.user_id),
         CASE WHEN coalesce(s.join_explore,false) THEN r.private_region_count ELSE NULL END,
         CASE WHEN coalesce(s.join_explore,false) THEN r.month_regions ELSE NULL END
  FROM ranked r LEFT JOIN public.ranking_settings s ON s.user_id=r.user_id
  ORDER BY r.place LIMIT 100;
$function$
;
REVOKE ALL ON FUNCTION public.ranking_explore_monthly(integer,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_explore_monthly(integer,text,integer) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.ranking_nations_monthly(p_year integer, p_month integer)
 RETURNS TABLE(place bigint, country text, participants bigint, km numeric, month_km numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH runner_totals AS (
    SELECT s.user_id,s.country,sum(r.distance_km::numeric) AS km,
      coalesce(sum(r.distance_km::numeric) FILTER (WHERE s.join_nations IS TRUE AND extract(month FROM r.activity_date)=p_month),0) AS month_km
    FROM public.ranking_settings s JOIN public.runs r ON r.user_id=s.user_id
    WHERE s.country IS NOT NULL
      AND r.activity_date>=make_date(p_year,1,1)
      AND r.activity_date<make_date(p_year+1,1,1)
      AND r.distance_km>0 AND r.deleted_at IS NULL
    GROUP BY s.user_id,s.country
  )
  SELECT row_number() OVER (ORDER BY sum(km) DESC,country ASC) AS place,
         country,count(*) AS participants,round(sum(km),1) AS km,round(sum(month_km),1) AS month_km
  FROM runner_totals GROUP BY country ORDER BY sum(km) DESC,country ASC;
$function$
;
REVOKE ALL ON FUNCTION public.ranking_nations_monthly(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_nations_monthly(integer,integer) TO anon,authenticated;
