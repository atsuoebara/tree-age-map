-- Garmin optional race analysis — REVIEW ONLY, NOT APPLIED.
-- Migration requires independent audit, isolated transactional tests and explicit rollout approval.
-- Read model: owner only. Write path must be service_role via revised atomic commit RPC.
-- The source Garmin run remains in public.runs even if analysis is purged.
BEGIN;

-- Composite FK blocks attaching somebody else's run (existing runs.id is bigint PK).
CREATE UNIQUE INDEX IF NOT EXISTS runs_id_user_id_race_analysis_uq
  ON public.runs (id, user_id);

CREATE TABLE public.run_race_analysis (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  run_id bigint NOT NULL,
  analysis_version text NOT NULL CHECK (analysis_version = 'garmin-activity-details-v1'),
  source_kind text NOT NULL CHECK (source_kind = 'garmin_activity_details'),
  source_connection_version uuid NOT NULL,
  distance_basis text NOT NULL CHECK (distance_basis = 'device_cumulative_m'),
  time_basis text NOT NULL CHECK (time_basis = 'clock_elapsed_seconds'),
  sample_count integer NOT NULL CHECK (sample_count BETWEEN 2 AND 20000),
  total_distance_m double precision NOT NULL CHECK (total_distance_m > 0 AND total_distance_m <= 250000),
  total_clock_elapsed_s double precision NOT NULL CHECK (total_clock_elapsed_s >= 0),
  segments jsonb NOT NULL CHECK (jsonb_typeof(segments) = 'array' AND jsonb_array_length(segments) BETWEEN 1 AND 251),
  overall_flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(overall_flags) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT run_race_analysis_run_owner_fk FOREIGN KEY (run_id, user_id)
    REFERENCES public.runs (id, user_id) ON DELETE CASCADE,
  CONSTRAINT run_race_analysis_one_version UNIQUE (user_id, run_id, analysis_version)
);
CREATE INDEX run_race_analysis_owner_idx ON public.run_race_analysis (user_id, run_id);
ALTER TABLE public.run_race_analysis ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.run_race_analysis FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.run_race_analysis_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.run_race_analysis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.run_race_analysis TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.run_race_analysis_id_seq TO service_role;

-- Defense in depth: an owner must have an active, matching export-authorized connection,
-- and the canonical Garmin run must still be present and nondeleted.
CREATE POLICY run_race_analysis_owner_read ON public.run_race_analysis
FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.runs r WHERE r.id=run_id AND r.user_id=user_id
      AND r.deleted_at IS NULL AND r.source='garmin'
  )
  AND EXISTS (
    SELECT 1 FROM public.garmin_api_connections c
    WHERE c.user_id=run_race_analysis.user_id
      AND c.connection_version=run_race_analysis.source_connection_version
      AND c.import_enabled AND public.garmin_has_export(c.permissions)
  )
);
-- CAUTION: garmin_api_connections is intentionally not client-readable.
-- The EXISTS may evaluate to false for authenticated roles due to its RLS.
-- This read policy is a *proposal* and MUST be verified against actual privileges.
-- If inaccessible, replace with a hardened security-definer helper in a private schema,
-- with no public data exposure; do not grant authenticated SELECT on connections.

-- Purge analysis on any soft delete or any physical DELETE of runs (FK cascade).
CREATE FUNCTION public.purge_race_analysis_on_soft_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    DELETE FROM public.run_race_analysis a WHERE a.run_id = NEW.id AND a.user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.purge_race_analysis_on_soft_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER purge_race_analysis_on_soft_delete
AFTER UPDATE OF deleted_at ON public.runs
FOR EACH ROW EXECUTE FUNCTION public.purge_race_analysis_on_soft_delete();

-- Purge on local disconnect / changed registration / disabled intake / lost export.
-- Never trust a webhook hint alone: existing permission reconciliation is authoritative.
CREATE FUNCTION public.purge_race_analysis_on_garmin_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM public.run_race_analysis WHERE user_id=OLD.user_id AND source_kind='garmin_activity_details';
    RETURN OLD;
  END IF;
  IF NEW.garmin_user_id IS DISTINCT FROM OLD.garmin_user_id
     OR NEW.connection_version IS DISTINCT FROM OLD.connection_version
     OR NOT NEW.import_enabled OR NOT public.garmin_has_export(NEW.permissions) THEN
    DELETE FROM public.run_race_analysis WHERE user_id=OLD.user_id AND source_kind='garmin_activity_details';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.purge_race_analysis_on_garmin_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER purge_race_analysis_on_garmin_change
AFTER DELETE OR UPDATE OF garmin_user_id, connection_version, import_enabled, permissions
ON public.garmin_api_connections
FOR EACH ROW EXECUTE FUNCTION public.purge_race_analysis_on_garmin_change();

COMMIT;

-- BLOCKERS before applying:
-- [ ] User-driven soft-delete runs UPDATE uses authenticated role: that role
--     cannot DELETE run_race_analysis, so this SECURITY INVOKER trigger will fail.
--     Must replace with privately owned SECURITY DEFINER trigger, strict search_path,
--     constrained row selection and permissions audit before any migration.
-- [ ] Same applies when Garmin connection role lacks child-table DELETE privileges.
-- [ ] RLS owner SELECT must be tested with actual authenticated user.
-- [ ] Atomic revised garmin_commit_activity (p_analysis_candidate) absent.
-- [ ] Account deletion tree and concurrency suite not yet demonstrated.
-- [ ] Deno load and batch tests not yet demonstrated.
