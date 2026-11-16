-- ISOLATED P2 PROPOSAL ONLY. NEVER APPLY TO PRODUCTION SUPABASE.
-- This fixture is NOT wired to any workflow. It has NOT been SQL-executed.
-- Validity/role/expiry of JWT must be checked by an actual PostgREST server.
-- If both GUC representations are present and disagree, fail closed to NULL.
-- Malformed JSON/UUID causes a DB error, NOT an authenticated fallback.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $rings_now_uid$
  WITH raw_claims AS (
    SELECT
      NULLIF(current_setting('request.jwt.claim.sub', true), '') AS legacy_sub,
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub' AS json_sub
  )
  SELECT CASE
    WHEN legacy_sub IS NOT NULL
      AND json_sub IS NOT NULL
      AND legacy_sub <> json_sub THEN NULL::uuid
    ELSE COALESCE(legacy_sub, json_sub)::uuid
  END
  FROM raw_claims
$rings_now_uid$;
