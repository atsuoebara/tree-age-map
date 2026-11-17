-- Candidate only. Do not apply without independent audit + explicit Atsuo approval.
-- Same function signature and annual ordering; monthly national delta is always NULL.
-- This is a proposal for replacing the existing publicly executable RPC, NOT a change to data.
-- Deploy this DB protection BEFORE any UI-only concealment; hiding HTML alone leaves API exposed.
-- Existing public responses / previously saved snapshots cannot be retracted retroactively.
CREATE OR REPLACE FUNCTION public.ranking_nations_monthly(p_year integer, p_month integer)
 RETURNS TABLE(place bigint, country text, participants bigint, km numeric, month_km numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH runner_totals AS (
    SELECT s.user_id,s.country,sum(r.distance_km::numeric) AS km
    FROM public.ranking_settings s JOIN public.runs r ON r.user_id=s.user_id
    WHERE s.country IS NOT NULL
      AND r.activity_date>=make_date(p_year,1,1)
      AND r.activity_date<make_date(p_year+1,1,1)
      AND r.distance_km>0 AND r.deleted_at IS NULL
    GROUP BY s.user_id,s.country
  )
  SELECT row_number() OVER (ORDER BY sum(km) DESC,country ASC) AS place,
         country,count(*) AS participants,round(sum(km),1) AS km,NULL::numeric AS month_km
  FROM runner_totals GROUP BY country ORDER BY sum(km) DESC,country ASC;
$function$
;
REVOKE ALL ON FUNCTION public.ranking_nations_monthly(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_nations_monthly(integer,integer) TO anon,authenticated;

