-- Isolated concurrency fixture. No production data or secrets.
-- Setup uses supabase/tests/garmin_race_rpc_setup.sql and 4-arg RPC.
INSERT INTO public.garmin_activity_inbox
(user_id,garmin_user_id,connection_version,state,attempts,payload)
VALUES ('00000000-0000-4000-8000-000000000001','ci-garmin',
        '00000000-0000-4000-8000-000000000002','processing',1,'{}'::jsonb);
