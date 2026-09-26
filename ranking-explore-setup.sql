-- Rings Ranking EXPLORE: stage 1 (safe storage + read-only leaderboard).
-- Run after ranking-setup.sql. No existing runs or rankings are changed.
-- Only a trusted server-side importer (service_role) may write verified regions.
CREATE TABLE IF NOT EXISTS public.ranking_explore_verified (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_year integer NOT NULL CHECK (activity_year BETWEEN 2000 AND 2100),
  run_id bigint NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  run_country text NOT NULL CHECK (run_country ~ '^[A-Z]{2}$'),
  region_code text NOT NULL CHECK (char_length(region_code) BETWEEN 1 AND 128),
  region_name text NOT NULL CHECK (char_length(region_name) BETWEEN 1 AND 256),
  PRIMARY KEY (run_id, run_country, region_code)
);
CREATE INDEX IF NOT EXISTS ranking_explore_lookup
  ON public.ranking_explore_verified (activity_year, run_country, user_id, region_code);
ALTER TABLE public.ranking_explore_verified ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ranking_explore_verified FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ranking_explore_verified TO service_role;
-- Read leaderboard only for users who independently opted into EXPLORE.
CREATE OR REPLACE FUNCTION public.ranking_explore(p_year integer, p_country text)
RETURNS TABLE (ranking_display_name text, country text, show_flag boolean,
               show_regions boolean, regions bigint, region_names text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH distinct_regions AS (
    SELECT v.user_id, v.run_country, v.region_code,
           min(v.region_name) AS region_name
    FROM public.ranking_explore_verified v
    JOIN public.ranking_settings s ON s.user_id = v.user_id AND s.join_explore
    WHERE v.activity_year = p_year AND v.run_country = upper(p_country)
    GROUP BY v.user_id, v.run_country, v.region_code
  )
  SELECT s.ranking_display_name, s.country, s.show_flag, s.show_regions,
         count(*) AS regions,
         CASE WHEN s.show_regions THEN array_agg(d.region_name ORDER BY d.region_name)
              ELSE ARRAY[]::text[] END AS region_names
  FROM distinct_regions d
  JOIN public.ranking_settings s ON s.user_id = d.user_id AND s.join_explore
  GROUP BY s.user_id, s.ranking_display_name, s.country, s.show_flag, s.show_regions
  ORDER BY regions DESC, s.ranking_display_name ASC
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.ranking_explore(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_explore(integer,text) TO anon, authenticated;
