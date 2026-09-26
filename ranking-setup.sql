-- Run once in Supabase SQL Editor. Rankings are opt-in, OFF by default.
create table if not exists public.ranking_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 ranking_display_name text check (char_length(ranking_display_name) between 1 and 32),
 country text check (country ~ '^[A-Z]{2}$'),
 join_distance boolean not null default false,
 join_explore boolean not null default false,
 join_nations boolean not null default false,
 show_flag boolean not null default false,
 show_regions boolean not null default false,
 updated_at timestamptz not null default now(),
 constraint opt_in_requires_identity check (not (join_distance or join_explore or join_nations) or (ranking_display_name is not null and country is not null))
);
alter table public.ranking_settings enable row level security;
revoke all on public.ranking_settings from anon;
grant select,insert,update on public.ranking_settings to authenticated;
drop policy if exists ranking_owner_read on public.ranking_settings;
create policy ranking_owner_read on public.ranking_settings for select to authenticated using (auth.uid()=user_id);
drop policy if exists ranking_owner_insert on public.ranking_settings;
create policy ranking_owner_insert on public.ranking_settings for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists ranking_owner_update on public.ranking_settings;
create policy ranking_owner_update on public.ranking_settings for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
-- Only safe aggregated data is returned. No routes or individual private runs exposed.
create or replace function public.ranking_distance(p_year integer)
returns table(ranking_display_name text,country text,show_flag boolean,km numeric)
language sql security definer set search_path=public as $$
 select s.ranking_display_name,s.country,s.show_flag,round(sum(r.distance_km::numeric),1) as km
 from public.ranking_settings s join public.runs r on r.user_id=s.user_id
 where s.join_distance and r.activity_date>=make_date(p_year,1,1) and r.activity_date<make_date(p_year+1,1,1)
 and r.distance_km>0
 group by s.user_id,s.ranking_display_name,s.country,s.show_flag
 order by km desc,s.ranking_display_name asc limit 100;
$$;
create or replace function public.ranking_nations(p_year integer)
returns table(country text,participants bigint,km numeric)
language sql security definer set search_path=public as $$
 with runner_totals as (
 select s.user_id,s.country,sum(r.distance_km::numeric) km
 from public.ranking_settings s join public.runs r on r.user_id=s.user_id
 where s.join_nations and r.activity_date>=make_date(p_year,1,1) and r.activity_date<make_date(p_year+1,1,1) and r.distance_km>0
 group by s.user_id,s.country)
 select country,count(*) participants,round(sum(km),1) km from runner_totals group by country order by km desc,country asc;
$$;
revoke all on function public.ranking_distance(integer) from public;
revoke all on function public.ranking_nations(integer) from public;
grant execute on function public.ranking_distance(integer) to anon,authenticated;
grant execute on function public.ranking_nations(integer) to anon,authenticated;
