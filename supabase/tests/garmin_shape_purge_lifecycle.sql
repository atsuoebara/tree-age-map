-- TEST ONLY: isolated probe_ci schema. Never apply to public/Supabase production.
\set ON_ERROR_STOP on
begin;
-- Separate fixtures: model a stored short-lived probe and the events that must erase it.
create table probe_ci.fake_connection (
  owner_ref text primary key, connection_version text not null,
  import_enabled boolean not null, activity_export boolean not null
);
create table probe_ci.fake_run (
  run_ref text primary key, owner_ref text not null references probe_ci.fake_connection(owner_ref) on delete cascade,
  deleted_at timestamptz
);
create table probe_ci.fake_probe_result (
  run_ref text primary key references probe_ci.fake_run(run_ref) on delete cascade,
  owner_ref text not null, connection_version text not null,
  counts jsonb not null
);
create function probe_ci.purge_connection() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='DELETE' then
    delete from probe_ci.fake_probe_result where owner_ref=old.owner_ref;
    return old;
  end if;
  if new.connection_version is distinct from old.connection_version or not new.import_enabled or not new.activity_export then
    delete from probe_ci.fake_probe_result where owner_ref=old.owner_ref;
  end if;
  return new;
end $$;
create trigger purge_connection before update of connection_version,import_enabled,activity_export or delete
on probe_ci.fake_connection for each row execute function probe_ci.purge_connection();
create function probe_ci.purge_soft_delete() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.deleted_at is not null and old.deleted_at is distinct from new.deleted_at then
    delete from probe_ci.fake_probe_result where run_ref=new.run_ref;
  end if;
  return new;
end $$;
create trigger purge_soft_delete after update of deleted_at
on probe_ci.fake_run for each row execute function probe_ci.purge_soft_delete();
insert into probe_ci.fake_connection values('o1','v1',true,true);
insert into probe_ci.fake_run values('r1','o1',null),('r2','o1',null);
insert into probe_ci.fake_probe_result values
('r1','o1','v1','{"activityCount":1,"sampleCount":9}'),
('r2','o1','v1','{"activityCount":1,"sampleCount":10}');
update probe_ci.fake_run set deleted_at=clock_timestamp() where run_ref='r1';
do $$ begin if (select count(*) from probe_ci.fake_probe_result)<>1 then raise exception 'soft delete purge failed'; end if; end $$;
update probe_ci.fake_connection set connection_version='v2' where owner_ref='o1';
do $$ begin if exists(select 1 from probe_ci.fake_probe_result) then raise exception 'connection version purge failed'; end if; end $$;
insert into probe_ci.fake_probe_result values('r2','o1','v2','{"activityCount":1,"sampleCount":10}');
update probe_ci.fake_connection set activity_export=false where owner_ref='o1';
do $$ begin if exists(select 1 from probe_ci.fake_probe_result) then raise exception 'permission revocation purge failed'; end if; end $$;
insert into probe_ci.fake_probe_result values('r2','o1','v2','{"activityCount":1,"sampleCount":10}');
update probe_ci.fake_connection set activity_export=true,import_enabled=false where owner_ref='o1';
do $$ begin if exists(select 1 from probe_ci.fake_probe_result) then raise exception 'disabled import purge failed'; end if; end $$;
update probe_ci.fake_connection set import_enabled=true where owner_ref='o1';
insert into probe_ci.fake_probe_result values('r2','o1','v2','{"activityCount":1,"sampleCount":10}');
delete from probe_ci.fake_run where run_ref='r2';
do $$ begin if exists(select 1 from probe_ci.fake_probe_result) then raise exception 'physical run deletion cascade failed'; end if; end $$;
insert into probe_ci.fake_run values('r3','o1',null);
insert into probe_ci.fake_probe_result values('r3','o1','v2','{"activityCount":1,"sampleCount":10}');
delete from probe_ci.fake_connection where owner_ref='o1';
do $$ begin if exists(select 1 from probe_ci.fake_probe_result) then raise exception 'disconnect purge failed'; end if; end $$;
rollback;
\echo 'Isolated probe lifecycle model: soft/physical run delete, version, permissions, disable, disconnect PASS'
