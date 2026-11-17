-- Issue #205: independent monthly ranks. Not applied to Supabase by this commit.
-- Existing annual/monthly-addition RPCs are deliberately untouched.
-- Ranking membership is computed before disclosure; only public fields are returned.
CREATE FUNCTION public.ranking_distance_month_places(p_year integer, p_month integer)
RETURNS TABLE(place bigint, ranking_display_name text, country text, show_flag boolean,
              badge_codes text[], km numeric, month_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH totals AS (
    SELECT r.user_id,round(sum(r.distance_km::numeric),1) AS monthly_km
    FROM public.runs r
    WHERE r.user_id IS NOT NULL AND r.deleted_at IS NULL AND r.distance_km>0
      AND r.activity_date>=make_date(p_year,p_month,1)
      AND r.activity_date<(make_date(p_year,p_month,1)+interval '1 month')
    GROUP BY r.user_id
  ), ranked AS (
    SELECT t.*,row_number() OVER (ORDER BY t.monthly_km DESC,t.user_id) AS place
    FROM totals t
  )
  SELECT r.place,
    CASE WHEN coalesce(s.show_ranking_name,false) AND nullif(btrim(s.ranking_display_name),'') IS NOT NULL
      THEN s.ranking_display_name ELSE NULL END,
    CASE WHEN coalesce(s.show_flag,false) THEN s.country ELSE NULL END,
    coalesce(s.show_flag,false),public.runner_badge_codes(r.user_id),
    CASE WHEN coalesce(s.join_distance,false) THEN r.monthly_km ELSE NULL END,
    CASE WHEN coalesce(s.join_distance,false) THEN r.monthly_km ELSE NULL END
  FROM ranked r LEFT JOIN public.ranking_settings s ON s.user_id=r.user_id
  ORDER BY r.place LIMIT 100;
$function$;
REVOKE ALL ON FUNCTION public.ranking_distance_month_places(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_distance_month_places(integer,integer) TO anon,authenticated;

-- EXPLORE: a new region is credited to its earliest valid saved activity date
-- *within the selected year*, consistent with existing month_regions semantics.
CREATE FUNCTION public.ranking_explore_month_places(p_year integer,p_country text,p_month integer)
RETURNS TABLE(place bigint, ranking_display_name text,country text,show_flag boolean,
              show_regions boolean,region_names text[],badge_codes text[],regions bigint,month_regions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH first_regions AS (
    SELECT v.user_id,v.region_code,min(v.region_name) AS region_name,
           min(r.activity_date) AS first_date
    FROM public.ranking_explore_verified v
    JOIN public.runs r ON r.id=v.run_id AND r.user_id=v.user_id
    WHERE v.activity_year=p_year AND v.run_country=upper(p_country)
      AND r.deleted_at IS NULL AND r.activity_date>=make_date(p_year,1,1)
      AND r.activity_date<make_date(p_year+1,1,1)
    GROUP BY v.user_id,v.region_code
  ), totals AS (
    SELECT user_id,count(*) AS month_regions,
           array_agg(region_name ORDER BY region_name) AS region_names
    FROM first_regions
    WHERE first_date>=make_date(p_year,p_month,1)
      AND first_date<(make_date(p_year,p_month,1)+interval '1 month')
    GROUP BY user_id
  ), ranked AS (
    SELECT t.*,row_number() OVER (ORDER BY t.month_regions DESC,t.user_id) AS place
    FROM totals t
  )
  SELECT r.place,
    CASE WHEN coalesce(s.show_ranking_name,false) AND nullif(btrim(s.ranking_display_name),'') IS NOT NULL
      THEN s.ranking_display_name ELSE NULL END,
    CASE WHEN coalesce(s.show_flag,false) THEN s.country ELSE NULL END,
    coalesce(s.show_flag,false),coalesce(s.show_regions,false),
    CASE WHEN coalesce(s.show_regions,false) AND coalesce(s.join_explore,false)
      THEN r.region_names ELSE ARRAY[]::text[] END,
    public.runner_badge_codes(r.user_id),
    CASE WHEN coalesce(s.join_explore,false) THEN r.month_regions ELSE NULL END,
    CASE WHEN coalesce(s.join_explore,false) THEN r.month_regions ELSE NULL END
  FROM ranked r LEFT JOIN public.ranking_settings s ON s.user_id=r.user_id
  ORDER BY r.place LIMIT 100;
$function$;
REVOKE ALL ON FUNCTION public.ranking_explore_month_places(integer,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_explore_month_places(integer,text,integer) TO anon,authenticated;

-- Only consenting users (join_nations) contribute to monthly nation totals.
CREATE FUNCTION public.ranking_nations_month_places(p_year integer,p_month integer)
RETURNS TABLE(place bigint,country text,participants bigint,km numeric,month_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH per_runner AS (
    SELECT s.user_id,s.country,sum(r.distance_km::numeric) AS month_distance
    FROM public.ranking_settings s
    JOIN public.runs r ON r.user_id=s.user_id
    WHERE s.join_nations IS TRUE AND s.country ~ '^[A-Z]{2}$'
      AND r.deleted_at IS NULL AND r.distance_km>0
      AND r.activity_date>=make_date(p_year,p_month,1)
      AND r.activity_date<(make_date(p_year,p_month,1)+interval '1 month')
    GROUP BY s.user_id,s.country
  ), per_country AS (
    SELECT p.country,count(*) AS participants,round(sum(p.month_distance),1) AS month_km
    FROM per_runner p GROUP BY p.country
  )
  SELECT row_number() OVER (ORDER BY p.month_km DESC,p.country) AS place,
         p.country,p.participants,p.month_km AS km,p.month_km
  FROM per_country p ORDER BY place;
$function$;
REVOKE ALL ON FUNCTION public.ranking_nations_month_places(integer,integer) FROM PUBLIC;
-- PRIVACY HOLD (Issue #205): never grant this granular country/month numeric RPC to public roles.
-- Re-evaluation requires separate B-1-compatible privacy policy and explicit approval.
REVOKE ALL ON FUNCTION public.ranking_nations_month_places(integer,integer) FROM anon,authenticated;
