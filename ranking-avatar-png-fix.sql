-- Allow Safari canvas fallback to PNG while retaining WebP support.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp','image/png'], file_size_limit = 1048576
WHERE id = 'ranking-avatars';

ALTER TABLE public.ranking_settings DROP CONSTRAINT IF EXISTS ranking_avatar_path_valid;
ALTER TABLE public.ranking_settings ADD CONSTRAINT ranking_avatar_path_valid
CHECK (avatar_path IS NULL OR avatar_path ~ ('^ranking-avatars/' || user_id::text || '/[0-9a-f-]{36}[.](webp|png)$'));

DROP POLICY IF EXISTS ranking_avatar_insert ON storage.objects;
CREATE POLICY ranking_avatar_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='ranking-avatars'
AND (storage.foldername(name))[1]=auth.uid()::text
AND name ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}[.](webp|png)$'));
