alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists theme text not null default 'system',
  add column if not exists audio_enabled boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_username_check,
  add constraint profiles_username_check
    check (
      username is null or (
        username = lower(username)
        and username ~ '^[a-z0-9][a-z0-9._-]{2,23}$'
      )
    ),
  drop constraint if exists profiles_theme_check,
  add constraint profiles_theme_check
    check (theme in ('light', 'dark', 'system'));

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

drop policy if exists profiles_update_own_preferences on public.profiles;
create policy profiles_update_own_preferences on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (username, avatar_url, theme, audio_enabled)
  on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_public_read on storage.objects;
create policy profile_avatars_public_read on storage.objects
  for select to public
  using (bucket_id = 'profile-avatars');

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
