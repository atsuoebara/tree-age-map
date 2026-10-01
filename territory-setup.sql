-- Runner's Rings Rings Territory: stage 1 backend.
-- Japan municipality territory, annual distance, opt-in, OFF by default.
-- Run once in Supabase SQL Editor after ranking-setup.sql.
-- Raw GPS is never exposed by public RPCs. Only a trusted service_role sync may write distances.

ALTER TABLE public.ranking_settings
  ADD COLUMN IF NOT EXISTS join_territory boolean NOT NULL DEFAULT false;

-- Keep the existing identity requirement aligned with the new opt-in.
ALTER TABLE public.ranking_settings
  DROP CONSTRAINT IF EXISTS opt_in_requires_identity;

ALTER TABLE public.ranking_settings
  ADD CONSTRAINT opt_in_requires_identity
  CHECK (
    NOT (join_distance OR join_explore OR join_nations OR join_territory)
    OR (ranking_display_name IS NOT NULL AND country IS NOT NULL)
  );

CREATE TABLE IF NOT EXISTS public.territory_run_municipality_distance (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id bigint NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  activity_year integer NOT NULL CHECK (activity_year BETWEEN 2026 AND 2100),
  municipality_code text NOT NULL CHECK (char_length(municipality_code) BETWEEN 1 AND 32),
  municipality_name text NOT NULL CHECK (char_length(municipality_name) BETWEEN 1 AND 256),
  prefecture_name text NOT NULL CHECK (char_length(prefecture_name) BETWEEN 1 AND 128),
  distance_km numeric NOT NULL CHECK (distance_km >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, municipality_code)
);

CREATE INDEX IF NOT EXISTS territory_year_city_user_idx
  ON public.territory_run_municipality_distance
  (activity_year, municipality_code, user_id);

ALTER TABLE public.territory_run_municipality_distance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.territory_run_municipality_distance FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.territory_run_municipality_distance TO service_role;

-- One row per municipality: current leader for the selected year.
CREATE OR REPLACE FUNCTION public.territory_leaders(p_year integer)
RETURNS TABLE (
  municipality_code text,
  municipality_name text,
  prefecture_name text,
  user_id uuid,
  ranking_display_name text,
  country text,
  show_flag boolean,
  km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH totals AS (
    SELECT
      d.municipality_code,
      min(d.municipality_name) AS municipality_name,
      min(d.prefecture_name) AS prefecture_name,
      d.user_id,
      round(sum(d.distance_km)::numeric, 2) AS km
    FROM public.territory_run_municipality_distance d
    JOIN public.ranking_settings s
      ON s.user_id = d.user_id
     AND s.join_territory
    WHERE d.activity_year = p_year
      AND p_year >= 2026
    GROUP BY d.municipality_code, d.user_id
  ),
  ranked AS (
    SELECT
      t.*,
      dense_rank() OVER (
        PARTITION BY t.municipality_code
        ORDER BY t.km DESC
      ) AS place
    FROM totals t
  )
  SELECT
    r.municipality_code,
    r.municipality_name,
    r.prefecture_name,
    r.user_id,
    s.ranking_display_name,
    s.country,
    s.show_flag,
    r.km
  FROM ranked r
  JOIN public.ranking_settings s
    ON s.user_id = r.user_id
   AND s.join_territory
  WHERE r.place = 1
  ORDER BY r.prefecture_name, r.municipality_name, s.ranking_display_name;
$$;

-- Top runners for a tapped municipality.
CREATE OR REPLACE FUNCTION public.territory_municipality_ranking(
  p_year integer,
  p_municipality_code text
)
RETURNS TABLE (
  place bigint,
  ranking_display_name text,
  country text,
  show_flag boolean,
  km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH totals AS (
    SELECT
      d.user_id,
      round(sum(d.distance_km)::numeric, 2) AS km
    FROM public.territory_run_municipality_distance d
    JOIN public.ranking_settings s
      ON s.user_id = d.user_id
     AND s.join_territory
    WHERE d.activity_year = p_year
      AND p_year >= 2026
      AND d.municipality_code = p_municipality_code
    GROUP BY d.user_id
  ),
  ranked AS (
    SELECT
      t.*,
      dense_rank() OVER (ORDER BY t.km DESC) AS place
    FROM totals t
  )
  SELECT
    r.place,
    s.ranking_display_name,
    s.country,
    s.show_flag,
    r.km
  FROM ranked r
  JOIN public.ranking_settings s
    ON s.user_id = r.user_id
   AND s.join_territory
  ORDER BY r.place, s.ranking_display_name
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.territory_leaders(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.territory_municipality_ranking(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.territory_leaders(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.territory_municipality_ranking(integer,text) TO anon, authenticated;
