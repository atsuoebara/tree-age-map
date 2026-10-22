-- Separate from the existing Connect IQ garmin_connections table and all Strava tables.
create table public.garmin_api_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  garmin_user_id text not null unique,
  tokens_ciphertext text not null,
  permissions jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.garmin_api_connections enable row level security;
revoke all on public.garmin_api_connections from public, anon, authenticated;
grant select, insert, update, delete on public.garmin_api_connections to service_role;
