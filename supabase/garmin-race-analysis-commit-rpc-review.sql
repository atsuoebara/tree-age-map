-- AUDIT-ONLY. Requires run_race_analysis table and approved migration.
-- This 4-argument overload preserves the current 3-argument RPC unchanged.
-- No production apply. Service role ONLY. Must audit before activation.
-- Baseline: public.garmin_commit_activity(bigint,integer,jsonb) from
-- supabase/garmin-activity-reliability.sql (repo main on 2026-11-09).
-- F1: missing mandatory JSON keys MUST fail explicit validation (SQL NULL
-- otherwise propagates through ordinary <> expressions).\n-- Reviewer should compare every existing validation, lock, duplicate branch
-- and inbox completion against original; only optional analysis is new.
create or replace function public.garmin_commit_activity(p_id bigint,p_attempt integer,p_record jsonb,p_analysis_candidate jsonb) returns text
language plpgsql security invoker set search_path='' as $$
declare i public.garmin_activity_inbox%rowtype; c public.garmin_api_connections%rowtype;
  owner_id uuid; outcome text; ext text; start_at timestamptz; km double precision; indoor boolean; route_length integer; saved_run_id bigint; seg jsonb; m jsonb; metric_name text;
begin
  select user_id into owner_id from public.garmin_activity_inbox where id=p_id;
  if owner_id is null then return 'stale'; end if;
  select * into c from public.garmin_api_connections where user_id=owner_id for update;
  select * into i from public.garmin_activity_inbox where id=p_id for update;
  if i.state<>'processing' or i.attempts<>p_attempt then return 'stale'; end if;
  if c.user_id is null or not c.import_enabled or not public.garmin_has_export(c.permissions)
    or c.garmin_user_id<>i.garmin_user_id or c.connection_version is distinct from i.connection_version then
    outcome:='ignored';
  elsif p_record is null then outcome:='ignored';
  else
    if c.permissions_checked_at is null or c.permissions_checked_at<now()-interval '2 minutes' then
      raise exception 'permissions pending';
    end if;
    ext:=p_record->>'source_external_id'; start_at:=(p_record->>'started_at')::timestamptz; km:=(p_record->>'distance_km')::double precision;
    indoor:=coalesce((p_record->>'indoor')::boolean,false);
    route_length:=jsonb_array_length(p_record->'route');
    if ext not like 'garmin-api:%' or km<=0 or route_length is null
      or (indoor and route_length<>0) or (not indoor and route_length<2)
      then raise exception 'invalid record'; end if;
    -- Exact IDs include soft-deleted runs: redelivery must not resurrect user deletions.
    if exists(select 1 from public.runs r where r.user_id=owner_id and
      ((r.source='garmin' and r.source_external_id=ext) or
       (r.deleted_at is null and coalesce(r.source_external_id,'') not like 'garmin-api:%'
        and r.started_at between start_at-interval '2 minutes' and start_at+interval '2 minutes'
        and abs(r.distance_km-km)<=greatest(0.1,km*0.03)
        and (coalesce(jsonb_array_length(r.route),0)=0)=indoor))) then outcome:='duplicate';
    else
      insert into public.runs(user_id,activity_date,started_at,distance_km,name,route,source,source_external_id)
      values(owner_id,(p_record->>'activity_date')::date,start_at,km,left(p_record->>'name',200),p_record->'route','garmin',ext)
      on conflict(user_id,source_external_id) where source='garmin' and source_external_id is not null do nothing
      returning id into saved_run_id;
      if saved_run_id is not null then
        outcome:='saved';
        -- Optional analysis is never independently committed. Any failure in
        -- this nested PL/pgSQL subtransaction rolls back only analysis writes.
        -- The run and receipt must still be saved normally.
        if p_analysis_candidate is not null
           and jsonb_typeof(p_analysis_candidate)='object'
           and not indoor then
          begin
            if p_analysis_candidate->>'analysis_version' is distinct from 'garmin-activity-details-v1'
               or p_analysis_candidate->>'distance_basis' is distinct from 'device_cumulative_m'
               or p_analysis_candidate->>'time_basis' is distinct from 'clock_elapsed_seconds'
               or jsonb_typeof(p_analysis_candidate->'segments') is distinct from 'array'
               or jsonb_array_length(p_analysis_candidate->'segments') not between 1 and 251
               or jsonb_typeof(p_analysis_candidate->'quality_flags') is distinct from 'array'
               or p_analysis_candidate->'accepted_samples' is null
               or (p_analysis_candidate->>'accepted_samples')::integer not between 2 and 20000
               or p_analysis_candidate->'total_distance_m' is null
               or (p_analysis_candidate->>'total_distance_m')::double precision not between 0.001 and 250000
               or p_analysis_candidate->'total_clock_elapsed_s' is null
               or (p_analysis_candidate->>'total_clock_elapsed_s')::double precision < 0
               or pg_catalog.octet_length(p_analysis_candidate::text) > 1000000
              then raise exception 'analysis invalid';
            end if;
            -- Pin per-segment metric schema and coverage. No arbitrary client JSON.
            for seg in select value from jsonb_array_elements(p_analysis_candidate->'segments') loop
              if jsonb_typeof(seg) is distinct from 'object'
                 or jsonb_typeof(seg->'quality_flags') is distinct from 'array'
                 or jsonb_typeof(seg->'metrics') is distinct from 'object'
                 or (seg->>'segment_index')::integer not between 1 and 251
                 or (seg->>'distance_m')::double precision <= 0
                 or (seg->>'clock_elapsed_s')::double precision < 0
                 or seg->'segment_index' is null or seg->'distance_m' is null
                 or seg->'clock_elapsed_s' is null
                then raise exception 'segment invalid';
              end if;
              foreach metric_name in array array['heart_rate','cadence','power'] loop
                m:=seg->'metrics'->metric_name;
                if jsonb_typeof(m) is distinct from 'object'
                   or (m->>'aggregation_method') is distinct from 'distance_weighted_linear'
                   or (m->>'coverage_fraction')::double precision not between 0 and 1
                   or (m->>'covered_distance_m')::double precision < 0
                   or coalesce((m->>'covered_distance_m')::double precision
                               > (seg->>'distance_m')::double precision + 0.01,true)
                   or m->'source_field' is null or m->'raw_unit' is null
                   or m->'coverage_fraction' is null or m->'covered_distance_m' is null
                   or m->'mean_raw_value' is null
                   or (
                     (m->>'coverage_fraction')::double precision < 0.8
                     and jsonb_typeof(m->'mean_raw_value') is distinct from 'null'
                   )
                   or (
                     (m->>'coverage_fraction')::double precision >= 0.8
                     and jsonb_typeof(m->'mean_raw_value') is distinct from 'number'
                   )
                  then raise exception 'metric invalid';
                end if;
                if metric_name='heart_rate' and (m->>'source_field' is distinct from 'heartRate'
                    or m->>'raw_unit' is distinct from 'bpm') then raise exception 'unit invalid'; end if;
                if metric_name='cadence' and (m->>'source_field' is distinct from 'stepsPerMinute'
                    or m->>'raw_unit' is distinct from 'steps/minute as provided') then raise exception 'unit invalid'; end if;
                if metric_name='power' and (m->>'source_field' is distinct from 'powerInWatts'
                    or m->>'raw_unit' is distinct from 'W') then raise exception 'unit invalid'; end if;
              end loop;
            end loop;
            insert into public.run_race_analysis
              (user_id,run_id,analysis_version,source_kind,source_connection_version,
               distance_basis,time_basis,sample_count,total_distance_m,total_clock_elapsed_s,
               segments,overall_flags)
            values
              (owner_id,saved_run_id,'garmin-activity-details-v1','garmin_activity_details',c.connection_version,
               'device_cumulative_m','clock_elapsed_seconds',
               (p_analysis_candidate->>'accepted_samples')::integer,
               (p_analysis_candidate->>'total_distance_m')::double precision,
               (p_analysis_candidate->>'total_clock_elapsed_s')::double precision,
               p_analysis_candidate->'segments',p_analysis_candidate->'quality_flags')
            on conflict (user_id,run_id,analysis_version) do nothing;
          exception when others then
            -- Intentional fallback: invalid optional analysis must NOT
            -- turn an otherwise-valid saved run into an import failure.
            null;
          end;
        end if;
      else outcome:='duplicate'; end if;
    end if;
  end if;
  -- Run insert and receipt completion commit together; crashed invocations can safely retry.
  update public.garmin_activity_inbox set state=outcome,payload='{}'::jsonb,last_error=null,updated_at=clock_timestamp() where id=p_id;
  return outcome;
end $$;
revoke all on function public.garmin_commit_activity(bigint,integer,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.garmin_commit_activity(bigint,integer,jsonb,jsonb)
  to service_role;
-- NOTE: PostgREST may expose both overloads. Do not wire 4-arg from
-- receiver until approved schema, integration tests and Deno load tests.
