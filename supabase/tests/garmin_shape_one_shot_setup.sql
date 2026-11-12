-- TEST-ONLY isolated PostgreSQL fixture; NEVER apply to Supabase production.
\set ON_ERROR_STOP on
begin;
create schema if not exists probe_ci;
create table probe_ci.one_shot (
 id integer primary key check(id=1),
 owner_ref text not null,
 connection_version text not null,
 activated_at timestamptz not null,
 expires_at timestamptz not null,
 state text not null check(state in ('eligible','claimed','finished','revoked')),
 claim_token uuid,
 result_counts jsonb,
 check(expires_at>activated_at)
);
create or replace function probe_ci.claim(p_owner text,p_version text,p_token uuid)
returns boolean language plpgsql as $$
declare taken integer;
begin
 update probe_ci.one_shot
 set state='claimed',claim_token=p_token
 where id=1 and owner_ref=p_owner and connection_version=p_version
   and state='eligible'
   and clock_timestamp() >= activated_at
   and clock_timestamp() < expires_at
 returning 1 into taken;
 return found;
end $$;
create or replace function probe_ci.finish(p_owner text,p_version text,p_token uuid,p_counts jsonb)
returns boolean language plpgsql as $$
declare taken integer;
begin
 -- Only fixed aggregate counts accepted. No arbitrary raw body or identifiers.
 if p_counts is null or jsonb_typeof(p_counts)<>'object'
   or (select count(*) from jsonb_object_keys(p_counts))<>2
   or not (p_counts ? 'activityCount' and p_counts ? 'sampleCount')
   or jsonb_typeof(p_counts->'activityCount')<>'number'
   or jsonb_typeof(p_counts->'sampleCount')<>'number'
   or (p_counts->>'activityCount')::numeric not between 1 and 100
   or (p_counts->>'sampleCount')::numeric not between 0 and 20000
 then return false; end if;
 update probe_ci.one_shot
 set state='finished',result_counts=p_counts
 where id=1 and owner_ref=p_owner and connection_version=p_version
   and claim_token=p_token and state='claimed'
   and clock_timestamp()<expires_at
 returning 1 into taken;
 return found;
end $$;
create or replace function probe_ci.revoke(p_owner text,p_version text)
returns boolean language plpgsql as $$
declare taken integer;
begin
 update probe_ci.one_shot
 set state='revoked', result_counts=null, claim_token=null,
     connection_version='revoked-generation'
 where id=1 and owner_ref=p_owner and connection_version=p_version
   and state in ('eligible','claimed','finished')
 returning 1 into taken;
 return found;
end $$;
insert into probe_ci.one_shot(id,owner_ref,connection_version,activated_at,expires_at,state)
values(1,'synthetic-owner','synthetic-v1',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '2 minutes','eligible');
commit;
