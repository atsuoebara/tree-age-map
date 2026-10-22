-- Transactional integration tests. Always ROLLBACK. Synthetic account and runs never persist.
begin;
do $test$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); receipt bigint; d jsonb; rec jsonb; n integer;
begin
  insert into auth.users(id) values(u);
  -- Exercise actual Edge Function privileges, not the migration owner's privileges.
  execute 'set local role service_role';
  insert into public.garmin_api_connections(user_id,garmin_user_id,tokens_ciphertext,permissions,connection_version,permissions_checked_at)
  values(u,'test-'||u,'test-only-not-real-tokens','{"permissions":["ACTIVITY_EXPORT"]}',v,now());
  d:=jsonb_build_object('userId','test-'||u,'summaryId','one','activityId',1,'summary','{"activityType":"RUNNING"}'::jsonb);
  rec:='{"activity_date":"2026-10-22","started_at":"2026-10-22T00:00:00Z","distance_km":5,"name":"transactional test","route":[[35,139],[35.1,139.1]],"source_external_id":"garmin-api:transaction-test-1"}';
  perform public.garmin_receive_details(jsonb_build_array(d));
  perform public.garmin_receive_details(jsonb_build_array(d));
  select count(*) into n from public.garmin_activity_inbox where user_id=u;
  if n<>1 then raise exception 'redelivery created duplicate receipt'; end if;
  select id into receipt from public.garmin_activity_inbox where user_id=u;
  update public.garmin_activity_inbox set state='processing',attempts=1 where id=receipt;
  if public.garmin_commit_activity(receipt,2,rec)<>'stale' then raise exception 'stale attempt accepted'; end if;
  if public.garmin_commit_activity(receipt,1,rec)<>'saved' then raise exception 'run not saved'; end if;
  if (select payload from public.garmin_activity_inbox where id=receipt)<>'{}'::jsonb then raise exception 'GPS retained after processing'; end if;
  -- Same activity ID, different summary: exactly one run.
  perform public.garmin_receive_details(jsonb_build_array(d||'{"summaryId":"two"}'));
  select id into receipt from public.garmin_activity_inbox where user_id=u and summary_id='two';
  update public.garmin_activity_inbox set state='processing',attempts=1 where id=receipt;
  if public.garmin_commit_activity(receipt,1,rec)<>'duplicate' then raise exception 'activity id duplicate accepted'; end if;
  -- A soft-deleted run must not be resurrected by a provider retry.
  update public.runs set deleted_at=now() where user_id=u;
  perform public.garmin_receive_details(jsonb_build_array(d||'{"summaryId":"deleted"}'));
  select id into receipt from public.garmin_activity_inbox where user_id=u and summary_id='deleted';
  update public.garmin_activity_inbox set state='processing',attempts=1 where id=receipt;
  if public.garmin_commit_activity(receipt,1,rec)<>'duplicate' then raise exception 'deleted activity resurrected'; end if;
  -- Same distance/day but distinct Garmin ID survives.
  perform public.garmin_receive_details(jsonb_build_array(d||'{"summaryId":"three"}'));
  select id into receipt from public.garmin_activity_inbox where user_id=u and summary_id='three';
  update public.garmin_activity_inbox set state='processing',attempts=1 where id=receipt;
  if public.garmin_commit_activity(receipt,1,rec||'{"source_external_id":"garmin-api:transaction-test-2"}')<>'saved' then raise exception 'distinct run lost'; end if;
  -- Cross-source equivalence needs a matching start time, not date/distance alone.
  insert into public.runs(user_id,activity_date,started_at,distance_km,name,route,source)
  values(u,'2026-10-22','2026-10-22T01:00:00Z',5,'test Strava','[[35,139],[35.1,139.1]]','strava');
  perform public.garmin_receive_details(jsonb_build_array(d||'{"summaryId":"cross"}'));
  select id into receipt from public.garmin_activity_inbox where user_id=u and summary_id='cross';
  update public.garmin_activity_inbox set state='processing',attempts=1 where id=receipt;
  if public.garmin_commit_activity(receipt,1,rec||'{"source_external_id":"garmin-api:transaction-test-3","started_at":"2026-10-22T01:00:30Z"}')<>'duplicate' then raise exception 'cross-source duplicate accepted'; end if;
  -- Connection replacement invalidates queued receipts and strips raw payload.
  perform public.garmin_receive_details(jsonb_build_array(d||'{"summaryId":"old-registration"}'));
  select id into receipt from public.garmin_activity_inbox where user_id=u and summary_id='old-registration';
  update public.garmin_activity_inbox set state='processing',attempts=1 where id=receipt;
  update public.garmin_api_connections set connection_version=gen_random_uuid() where user_id=u;
  if public.garmin_commit_activity(receipt,1,rec)<>'stale' then raise exception 'old registration processed'; end if;
  -- Removing permission cancels queued work. No activity can be received without export permission.
  perform public.garmin_receive_details(jsonb_build_array(d||'{"summaryId":"revoked"}'));
  update public.garmin_api_connections set permissions='{"permissions":[]}' where user_id=u;
  if exists(select 1 from public.garmin_activity_inbox where user_id=u and state in ('pending','retry','processing')) then raise exception 'revocation left queued work'; end if;
  perform public.garmin_receive_details(jsonb_build_array(d||'{"summaryId":"after-revoke"}'));
  if exists(select 1 from public.garmin_activity_inbox where user_id=u and summary_id='after-revoke') then raise exception 'unpermitted receipt accepted'; end if;
  -- Local disconnect blocks intake even while the remote revocation is unavailable.
  update public.garmin_api_connections set permissions='["ACTIVITY_EXPORT"]',import_enabled=false where user_id=u;
  perform public.garmin_receive_details(jsonb_build_array(d||'{"summaryId":"after-disconnect"}'));
  if exists(select 1 from public.garmin_activity_inbox where user_id=u and summary_id='after-disconnect') then raise exception 'disconnected receipt accepted'; end if;
  delete from public.garmin_api_connections where user_id=u;
  if exists(select 1 from public.garmin_activity_inbox where user_id=u and payload<>'{}'::jsonb) then raise exception 'disconnect retained payload'; end if;
  if has_function_privilege('anon','public.garmin_commit_activity(bigint,integer,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.garmin_receive_details(jsonb)','EXECUTE')
     or has_function_privilege('anon','public.garmin_check_drain_token(text)','EXECUTE') then raise exception 'RPC exposed to clients'; end if;
end $test$;
select 'passed: receipt/run idempotency, fenced attempts, soft delete, distinct runs, cross-source match, reconnect, permissions, disconnect, RPC grants (rolled back)' as integration_result;
rollback;
