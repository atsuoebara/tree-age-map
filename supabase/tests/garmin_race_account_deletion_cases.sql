-- C4 account deletion strategy: ISOLATED synthetic PostgreSQL 16 ONLY.
-- Not a migration or production cleanup script.
-- Uses only fictional accounts and simplified FK-consistent replicas to show
-- why auth-first deletion fails and a carefully ordered cleanup can succeed.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.garmin_api_connections(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 import_enabled boolean NOT NULL DEFAULT true,
 permissions jsonb NOT NULL DEFAULT '["ACTIVITY_EXPORT"]'::jsonb
);
CREATE TABLE public.garmin_activity_inbox(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending'
);
CREATE TABLE public.runs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid REFERENCES auth.users(id), -- NO ACTION in live database
 source text NOT NULL
);
CREATE TABLE public.run_race_analysis(
 run_id bigint REFERENCES public.runs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL
);
CREATE TABLE public.territory_run_region_distance(
 run_id bigint REFERENCES public.runs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
-- Live backup has a user_id but no FK to auth.users.
CREATE TABLE public.runs_duplicate_backup_20260828(
 user_id uuid NOT NULL,
 note text NOT NULL
);
-- Likewise, rings_today_run_region_distance has user_id but no FK to auth.users.
CREATE TABLE public.rings_today_run_region_distance(
 run_id bigint REFERENCES public.runs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL
);
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000003');
INSERT INTO public.garmin_api_connections(user_id) VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000003');
INSERT INTO public.garmin_activity_inbox(user_id) VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000003');
INSERT INTO public.runs(user_id,source) VALUES
 ('00000000-0000-4000-8000-000000000001','garmin'),
 ('00000000-0000-4000-8000-000000000003','garmin');
INSERT INTO public.run_race_analysis(run_id,user_id)
 SELECT id,user_id FROM public.runs;
INSERT INTO public.territory_run_region_distance(run_id,user_id)
 SELECT id,user_id FROM public.runs;
INSERT INTO public.rings_today_run_region_distance(run_id,user_id)
 SELECT id,user_id FROM public.runs;
INSERT INTO public.runs_duplicate_backup_20260828(user_id,note) VALUES
 ('00000000-0000-4000-8000-000000000001','synthetic A'),
 ('00000000-0000-4000-8000-000000000003','synthetic B');

DO $test$
DECLARE
 a uuid := '00000000-0000-4000-8000-000000000001';
 b uuid := '00000000-0000-4000-8000-000000000003';
 n int;
 blocked boolean := false;
BEGIN
 -- Unsafe auth-first attempt: FK refuses deletion because runs still exists.
 BEGIN
   DELETE FROM auth.users WHERE id=a;
 EXCEPTION WHEN foreign_key_violation THEN
   blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'auth-first delete unexpectedly passed'; END IF;
 RAISE NOTICE 'PASS auth-first delete blocked by runs NO ACTION FK';

 -- Another unsafe path: remove runs and auth but omit non-FK backup cleanup.
 -- Demonstrate residual copies even though the account is gone.
 UPDATE public.garmin_api_connections
  SET import_enabled=false, permissions='[]'::jsonb WHERE user_id=a;
 DELETE FROM public.garmin_activity_inbox WHERE user_id=a;
 DELETE FROM public.garmin_api_connections WHERE user_id=a;
 DELETE FROM public.runs WHERE user_id=a;
 DELETE FROM auth.users WHERE id=a;
 SELECT count(*) INTO n FROM public.runs_duplicate_backup_20260828 WHERE user_id=a;
 IF n<>1 THEN RAISE EXCEPTION 'expected residual orphan backup'; END IF;
 RAISE NOTICE 'PASS auth deleted but non-FK backup remains unless explicitly purged';
 -- Clean residual in the hypothetical ordered strategy.
 DELETE FROM public.runs_duplicate_backup_20260828 WHERE user_id=a;
 SELECT count(*) INTO n FROM public.run_race_analysis WHERE user_id=a;
 IF n<>0 THEN RAISE EXCEPTION 'analysis survived runs physical delete'; END IF;
 SELECT count(*) INTO n FROM public.rings_today_run_region_distance WHERE user_id=a;
 IF n<>0 THEN RAISE EXCEPTION 'derived run distance survived runs delete'; END IF;
 SELECT count(*) INTO n FROM public.garmin_activity_inbox WHERE user_id=a;
 IF n<>0 THEN RAISE EXCEPTION 'inbox survived deletion'; END IF;
 RAISE NOTICE 'PASS A ordered account cleanup: canonical, analysis and backup absent';

 -- No collateral deletion of other account.
 SELECT count(*) INTO n FROM auth.users WHERE id=b;
 IF n<>1 THEN RAISE EXCEPTION 'other user deleted'; END IF;
 SELECT count(*) INTO n FROM public.run_race_analysis WHERE user_id=b;
 IF n<>1 THEN RAISE EXCEPTION 'other account analysis lost'; END IF;
 SELECT count(*) INTO n FROM public.runs_duplicate_backup_20260828 WHERE user_id=b;
 IF n<>1 THEN RAISE EXCEPTION 'other account backup lost'; END IF;
 RAISE NOTICE 'PASS B remains untouched';
END $test$;
ROLLBACK;
-- No persistent test data: even CI fixture ends in ROLLBACK.
