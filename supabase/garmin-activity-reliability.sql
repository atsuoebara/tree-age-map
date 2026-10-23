-- Apply after garmin-activity-inbox.sql. No credential literals in this file.
-- All RPCs are service-only SECURITY INVOKER. Lock order: connection, then inbox.
alter table public.garmin_api_connections
  add column if not exists import_enabled boolean not null default true,
  add column if not exists connection_version uuid not null default gen_random_uuid(),
  add column if not exists permissions_checked_at timestamptz,
  add column if not exists permissions_retry_at timestamptz not null default now();
alter table public.garmin_activity_inbox add column if not exists connection_version uuid;
update public.garmin_activity_inbox i set connection_version=c.connection_version
from public.garmin_api_connections c where i.user_id=c.user_id and i.garmin_user_id=c.garmin_user_id and i.connection_version is null;
create index if not exists garmin_activity_inbox_owner_idx on public.garmin_activity_inbox(user_id);

create or replace function public.garmin_has_export(p_permissions jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
  select coalesce((case when jsonb_typeof(p_permissions)='array' then p_permissions
    else p_permissions->'permissions' end) @> '["ACTIVITY_EXPORT"]'::jsonb,false)
$$;
revoke all on function public.garmin_has_export(jsonb) from public,anon,authenticated;
grant execute on function public.garmin_has_export(jsonb) to service_role;

create or replace function public.garmin_cancel_queue() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='DELETE' or new.garmin_user_id is distinct from old.garmin_user_id
    or new.connection_version is distinct from old.connection_version
    or not new.import_enabled or not public.garmin_has_export(new.permissions) then
    update public.garmin_activity_inbox set
      state=case when state in ('pending','retry','processing') then 'ignored' else state end,
      payload='{}'::jsonb, last_error=null, updated_at=clock_timestamp()
    where user_id=old.user_id;
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.garmin_cancel_queue() from public,anon,authenticated;
grant execute on function public.garmin_cancel_queue() to service_role;
drop trigger if exists garmin_cancel_queue on public.garmin_api_connections;
create trigger garmin_cancel_queue before delete or update of import_enabled,permissions,connection_version,garmin_user_id
on public.garmin_api_connections for each row execute function public.garmin_cancel_queue();

create or replace function public.garmin_receive_details(p_details jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare d jsonb; c public.garmin_api_connections%rowtype; n integer:=0;
begin
  if jsonb_typeof(p_details)<>'array' or jsonb_array_length(p_details)>100 then raise exception 'invalid batch'; end if;
  for d in select value from jsonb_array_elements(p_details) loop
    if coalesce(jsonb_typeof(d->'userId'),'null')<>'string' or coalesce(jsonb_typeof(d->'summaryId'),'null')<>'string'
      or length(d->>'userId') not between 1 and 256 or length(d->>'summaryId') not between 1 and 256
      or coalesce(jsonb_typeof(d->'summary'),'null')<>'object' then raise exception 'invalid detail'; end if;
    -- Ambiguous Garmin identities are never routed to an arbitrary account.
    if (select count(*) from public.garmin_api_connections where garmin_user_id=d->>'userId')<>1 then continue; end if;
    select * into c from public.garmin_api_connections where garmin_user_id=d->>'userId' for update;
    if not found or not c.import_enabled or not public.garmin_has_export(c.permissions) then continue; end if;
    insert into public.garmin_activity_inbox(user_id,garmin_user_id,summary_id,payload,connection_version)
      values(c.user_id,c.garmin_user_id,d->>'summaryId',d,c.connection_version)
      on conflict(user_id,summary_id) do nothing;
    n:=n+1;
  end loop;
  return n;
end $$;
revoke all on function public.garmin_receive_details(jsonb) from public,anon,authenticated;
grant execute on function public.garmin_receive_details(jsonb) to service_role;

create or replace function public.garmin_invalidate_permissions(p_user_ids text[]) returns void
language sql security invoker set search_path='' as $$
  update public.garmin_api_connections set permissions_checked_at=null,permissions_retry_at=now()
  where garmin_user_id=any(p_user_ids)
$$;
revoke all on function public.garmin_invalidate_permissions(text[]) from public,anon,authenticated;
grant execute on function public.garmin_invalidate_permissions(text[]) to service_role;

create or replace function public.garmin_commit_activity(p_id bigint,p_attempt integer,p_record jsonb) returns text
language plpgsql security invoker set search_path='' as $$
declare i public.garmin_activity_inbox%rowtype; c public.garmin_api_connections%rowtype;
  owner_id uuid; outcome text; ext text; start_at timestamptz; km double precision; indoor boolean; route_length integer;
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
      on conflict(user_id,source_external_id) where source='garmin' and source_external_id is not null do nothing;
      if found then outcome:='saved'; else outcome:='duplicate'; end if;
    end if;
  end if;
  -- Run insert and receipt completion commit together; crashed invocations can safely retry.
  update public.garmin_activity_inbox set state=outcome,payload='{}'::jsonb,last_error=null,updated_at=clock_timestamp() where id=p_id;
  return outcome;
end $$;
revoke all on function public.garmin_commit_activity(bigint,integer,jsonb) from public,anon,authenticated;
grant execute on function public.garmin_commit_activity(bigint,integer,jsonb) to service_role;

-- Vault access is confined to a non-exposed schema and an exact service-only predicate.
create schema if not exists garmin_private;
revoke all on schema garmin_private from public,anon,authenticated;
grant usage on schema garmin_private to service_role;
create or replace function garmin_private.check_drain_token(p_token text) returns boolean
language sql security definer set search_path='' as $$
  select length(p_token)=64 and exists(select 1 from vault.decrypted_secrets
    where name='garmin_activity_drain_token'
    and extensions.digest(decrypted_secret,'sha256')=extensions.digest(p_token,'sha256'))
$$;
revoke all on function garmin_private.check_drain_token(text) from public,anon,authenticated;
grant execute on function garmin_private.check_drain_token(text) to service_role;
create or replace function public.garmin_check_drain_token(p_token text) returns boolean
language sql security invoker set search_path='' as $$select garmin_private.check_drain_token(p_token)$$;
revoke all on function public.garmin_check_drain_token(text) from public,anon,authenticated;
grant execute on function public.garmin_check_drain_token(text) to service_role;

create table if not exists garmin_private.worker_lease (
  id boolean primary key default true check(id), token uuid, expires_at timestamptz not null default '-infinity'
);
alter table garmin_private.worker_lease enable row level security;
revoke all on garmin_private.worker_lease from public,anon,authenticated;
grant select,insert,update on garmin_private.worker_lease to service_role;
insert into garmin_private.worker_lease(id) values(true) on conflict do nothing;
create or replace function public.garmin_worker_lease(p_token uuid,p_release boolean default false) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
  if p_release then
    update garmin_private.worker_lease set expires_at='-infinity',token=null where id and token=p_token;
  else
    update garmin_private.worker_lease set expires_at=now()+interval '5 minutes',token=p_token where id and expires_at<now();
  end if;
  return found;
end $$;
revoke all on function public.garmin_worker_lease(uuid,boolean) from public,anon,authenticated;
grant execute on function public.garmin_worker_lease(uuid,boolean) to service_role;

do $$begin
  if not exists(select 1 from vault.secrets where name='garmin_activity_drain_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'garmin_activity_drain_token','Garmin retry worker only');
  end if;
end $$;

create extension if not exists pg_cron;
-- Only this fixed endpoint is contacted. No service_role, client secret or TOKEN KEY in cron.
select cron.schedule('garmin-activity-retry','*/2 * * * *',$job$
  select net.http_post(
    url:='https://fhwvntpzwyenendhcgbw.supabase.co/functions/v1/garmin-activity-push/drain',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
      (select decrypted_secret from vault.decrypted_secrets where name='garmin_activity_drain_token')),
    body:='{}'::jsonb,timeout_milliseconds:=10000);
$job$);
