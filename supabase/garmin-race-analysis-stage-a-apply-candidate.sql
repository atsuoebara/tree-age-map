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

-- Defense in depth: allow only authenticated owner and nondeleted Garmin run.
-- Connection/permission changes purge analyses transactionally in dedicated trigger.
-- Avoid SELECT on private garmin_api_connections in authenticated RLS policy.
CREATE POLICY run_race_analysis_owner_read ON public.run_race_analysis
FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.runs r WHERE r.id=run_id AND r.user_id=user_id
      AND r.deleted_at IS NULL AND r.source='garmin'
  )
);

-- Purge analysis on any soft delete or any physical DELETE of runs (FK cascade).
-- SECURITY DEFINER is necessary: authenticated users can soft-delete their own
-- runs but have no DELETE grant on analysis table. Migration ownership must be
-- the tightly controlled database owner (not anon/authenticated/service_role).
-- No SQL parameters; deletions are scoped exclusively to trigger OLD/NEW rows.
CREATE FUNCTION public.purge_race_analysis_on_soft_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
-- The function executes with tightly controlled owner privileges and no
-- arguments; never grants browser users DELETE rights on analysis.
-- Never trust a webhook hint alone: existing permission reconciliation is authoritative.
CREATE FUNCTION public.purge_race_analysis_on_garmin_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
-- [ ] SECURITY DEFINER function owners and EXECUTE privilege must be audited:
--     postgres/migration owner only, not untrusted roles; no arbitrary parameters.
-- [ ] Existing soft-delete UPDATE privileges and trigger rights need rollback-only tests.
-- [ ] RLS owner SELECT must be tested with actual authenticated user.
-- [ ] Revocation cleanup must be tested with actual connection update path.
-- [ ] Four-argument commit RPC exists as an unaudited, un-applied PR file; end-to-end integration remains blocked.
-- [ ] Account deletion tree and concurrency suite not yet demonstrated.
-- [ ] Deno isolated synthetic batch sizes measured; production Deno load/ACK not demonstrated.
