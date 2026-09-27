-- Run ONCE in Supabase SQL Editor after existing ranking setup.
-- Adds optional public avatars without changing rankings, routes or nationality logic.
ALTER TABLE public.ranking_settings
 ADD COLUMN IF NOT EXISTS show_avatar boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.ranking_settings DROP CONSTRAINT IF EXISTS ranking_avatar_path_valid;
ALTER TABLE public.ranking_settings ADD CONSTRAINT ranking_avatar_path_valid
 CHECK (avatar_path IS NULL OR avatar_path ~ ('^ranking-avatars/' || user_id::text || '/[0-9a-f-]{36}[.]webp$'));
-- Public bucket: images are publicly addressable even when leaderboard visibility is OFF.
-- Disabling visibility hides them from ranking RPCs; removing replaces/deletes the file.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('ranking-avatars','ranking-avatars',true,1048576,ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=1048576,allowed_mime_types=ARRAY['image/webp'];
DROP POLICY IF EXISTS ranking_avatar_insert ON storage.objects;
CREATE POLICY ranking_avatar_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='ranking-avatars' AND (storage.foldername(name))[1]=auth.uid()::text AND name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}[.]webp$'));
DROP POLICY IF EXISTS ranking_avatar_delete ON storage.objects;
CREATE POLICY ranking_avatar_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='ranking-avatars' AND (storage.foldername(name))[1]=auth.uid()::text);
-- Recreate functions because their return row shapes gain avatar fields.
DROP FUNCTION IF EXISTS public.ranking_distance(integer);
CREATE FUNCTION public.ranking_distance(p_year integer)
RETURNS TABLE(ranking_display_name text,country text,show_flag boolean,km numeric,show_avatar boolean,avatar_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT s.ranking_display_name,s.country,s.show_flag,round(sum(r.distance_km::numeric),1) km,
 (s.show_avatar AND s.avatar_path IS NOT NULL) show_avatar,
 CASE WHEN s.show_avatar THEN s.avatar_path ELSE NULL END avatar_path
 FROM public.ranking_settings s JOIN public.runs r ON r.user_id=s.user_id
 WHERE s.join_distance AND r.activity_date>=make_date(p_year,1,1)
 AND r.activity_date<make_date(p_year+1,1,1) AND r.distance_km>0
 GROUP BY s.user_id,s.ranking_display_name,s.country,s.show_flag,s.show_avatar,s.avatar_path
 ORDER BY km DESC,s.ranking_display_name ASC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.ranking_distance(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_distance(integer) TO anon,authenticated;
DROP FUNCTION IF EXISTS public.ranking_explore(integer,text);
CREATE FUNCTION public.ranking_explore(p_year integer,p_country text)
RETURNS TABLE(ranking_display_name text,country text,show_flag boolean,show_regions boolean,regions bigint,region_names text[],show_avatar boolean,avatar_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH distinct_regions AS (
 SELECT v.user_id,v.run_country,v.region_code,min(v.region_name) region_name
 FROM public.ranking_explore_verified v JOIN public.ranking_settings s ON s.user_id=v.user_id AND s.join_explore
 WHERE v.activity_year=p_year AND v.run_country=upper(p_country)
 GROUP BY v.user_id,v.run_country,v.region_code)
 SELECT s.ranking_display_name,s.country,s.show_flag,s.show_regions,count(*) regions,
 CASE WHEN s.show_regions THEN array_agg(d.region_name ORDER BY d.region_name) ELSE ARRAY[]::text[] END region_names,
 (s.show_avatar AND s.avatar_path IS NOT NULL) show_avatar,
 CASE WHEN s.show_avatar THEN s.avatar_path ELSE NULL END avatar_path
 FROM distinct_regions d JOIN public.ranking_settings s ON s.user_id=d.user_id AND s.join_explore
 GROUP BY s.user_id,s.ranking_display_name,s.country,s.show_flag,s.show_regions,s.show_avatar,s.avatar_path
 ORDER BY regions DESC,s.ranking_display_name ASC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.ranking_explore(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_explore(integer,text) TO anon,authenticated;
