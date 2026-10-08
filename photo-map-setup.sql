-- Runner's Rings community map photos
-- Apply once in the Supabase SQL Editor. Pending images remain in a private bucket.
create table if not exists public.map_photos (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  storage_path text not null unique,
  caption text not null default '' check (char_length(caption) <= 160),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists map_photos_status_created_idx
  on public.map_photos(status, created_at desc);

alter table public.map_photos enable row level security;

revoke all on public.map_photos from anon, authenticated;
grant select (id, lat, lng, storage_path, caption, status, created_at)
  on public.map_photos to anon, authenticated;
grant insert (id, lat, lng, storage_path, caption, consent_at)
  on public.map_photos to authenticated;
grant update (status, reviewed_at)
  on public.map_photos to authenticated;

drop policy if exists "map photos readable by approved owner or reviewer" on public.map_photos;
create policy "map photos readable by approved owner or reviewer"
  on public.map_photos for select to anon, authenticated
  using (
    status = 'approved'
    or owner_id = (select auth.uid())
    or (select auth.uid()) = '386da875-298e-46b7-927d-0e02d02c409a'::uuid
  );

drop policy if exists "signed-in users submit pending map photos" on public.map_photos;
create policy "signed-in users submit pending map photos"
  on public.map_photos for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and storage_path = (select auth.uid())::text || '/' || id::text || '.jpg'
    and consent_at <= now() + interval '1 minute'
  );

drop policy if exists "designated reviewer decides map photo status" on public.map_photos;
create policy "designated reviewer decides map photo status"
  on public.map_photos for update to authenticated
  using ((select auth.uid()) = '386da875-298e-46b7-927d-0e02d02c409a'::uuid)
  with check (
    (select auth.uid()) = '386da875-298e-46b7-927d-0e02d02c409a'::uuid
    and status in ('approved','rejected')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('map-photos-private', 'map-photos-private', false, 12582912, array['image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload own map photo files" on storage.objects;
create policy "users upload own map photo files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'map-photos-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "approved owners and reviewer read map photo files" on storage.objects;
create policy "approved owners and reviewer read map photo files"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'map-photos-private'
    and exists (
      select 1 from public.map_photos p
      where p.storage_path = storage.objects.name
        and (
          p.status = 'approved'
          or (
            (select auth.uid()) is not null
            and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
          )
          or (select auth.uid()) = '386da875-298e-46b7-927d-0e02d02c409a'::uuid
        )
    )
  );

drop policy if exists "reviewer deletes rejected map photo files" on storage.objects;
create policy "reviewer deletes rejected map photo files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'map-photos-private'
    and (select auth.uid()) = '386da875-298e-46b7-927d-0e02d02c409a'::uuid
    and exists (
      select 1 from public.map_photos p
      where p.storage_path = storage.objects.name and p.status = 'rejected'
    )
  );
