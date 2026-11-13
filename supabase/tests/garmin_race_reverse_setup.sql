-- Disposable PostgreSQL only: expand lifecycle fixture to support actual 4-arg RPC.
ALTER TABLE public.runs ADD COLUMN activity_date date, ADD COLUMN started_at timestamptz,
 ADD COLUMN distance_km double precision, ADD COLUMN name text,
 ADD COLUMN route jsonb, ADD COLUMN source_external_id text;
CREATE UNIQUE INDEX runs_test_garmin_external_id ON public.runs(user_id,source_external_id)
 WHERE source='garmin' AND source_external_id IS NOT NULL;
CREATE TABLE public.garmin_activity_inbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL,
 garmin_user_id text NOT NULL,
 connection_version uuid,
 state text NOT NULL,
 attempts integer NOT NULL,
 payload jsonb NOT NULL,
 last_error text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.garmin_api_connections
(user_id,garmin_user_id,connection_version,import_enabled,permissions,permissions_checked_at)
VALUES ('00000000-0000-4000-8000-000000000001','ci-garmin',
 '00000000-0000-4000-8000-000000000002',true,'["ACTIVITY_EXPORT"]'::jsonb,now());
INSERT INTO public.garmin_activity_inbox
(user_id,garmin_user_id,connection_version,state,attempts,payload)
VALUES ('00000000-0000-4000-8000-000000000001','ci-garmin',
 '00000000-0000-4000-8000-000000000002','processing',1,'{}'::jsonb);
