-- Mini LMS - Migration 0014: Audio Pembelajaran

create table if not exists public.material_audios (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  file_path text not null unique,
  duration_seconds numeric(10,2) check (duration_seconds is null or duration_seconds >= 0),
  transcript text check (transcript is null or char_length(transcript) <= 5000),
  order_index integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists material_audios_material_order_idx
  on public.material_audios (material_id, order_index);

alter table public.material_audios enable row level security;

drop policy if exists material_audios_admin_all on public.material_audios;
create policy material_audios_admin_all on public.material_audios
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists material_audios_student_select on public.material_audios;
create policy material_audios_student_select on public.material_audios
  for select to authenticated
  using (
    exists (
      select 1
      from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.enrollments e on e.class_id = m.class_id and e.student_id = auth.uid()
      where mat.id = material_audios.material_id
        and public.can_access_material(mat.id)
    )
  );

drop policy if exists material_audios_teacher_select on public.material_audios;
create policy material_audios_teacher_select on public.material_audios
  for select to authenticated
  using (
    exists (
      select 1
      from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      join public.profiles p on p.id = ta.teacher_id and p.role = 'teacher'
      where mat.id = material_audios.material_id and ta.teacher_id = auth.uid()
    )
  );

drop policy if exists material_audios_teacher_insert on public.material_audios;
create policy material_audios_teacher_insert on public.material_audios
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      join public.profiles p on p.id = ta.teacher_id and p.role = 'teacher'
      where mat.id = material_audios.material_id and ta.teacher_id = auth.uid()
    )
  );

drop policy if exists material_audios_teacher_update on public.material_audios;
create policy material_audios_teacher_update on public.material_audios
  for update to authenticated
  using (
    exists (
      select 1
      from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      join public.profiles p on p.id = ta.teacher_id and p.role = 'teacher'
      where mat.id = material_audios.material_id and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      join public.profiles p on p.id = ta.teacher_id and p.role = 'teacher'
      where mat.id = material_audios.material_id and ta.teacher_id = auth.uid()
    )
  );

drop policy if exists material_audios_teacher_delete on public.material_audios;
create policy material_audios_teacher_delete on public.material_audios
  for delete to authenticated
  using (
    exists (
      select 1
      from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      join public.profiles p on p.id = ta.teacher_id and p.role = 'teacher'
      where mat.id = material_audios.material_id and ta.teacher_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.material_audios to authenticated;
revoke all on public.material_audios from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'material-audio',
  'material-audio',
  false,
  10485760,
  array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path format: {material_id}/{random-uuid}.{allowed-extension}
drop policy if exists material_audio_storage_teacher_insert on storage.objects;
create policy material_audio_storage_teacher_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'material-audio'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp3|mp4|m4a|ogg)$'
    and exists (
      select 1
      from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      join public.profiles p on p.id = ta.teacher_id and p.role = 'teacher'
      where mat.id::text = split_part(name, '/', 1) and ta.teacher_id = auth.uid()
    )
  );

drop policy if exists material_audio_storage_teacher_delete on storage.objects;
create policy material_audio_storage_teacher_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'material-audio'
    and exists (
      select 1
      from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      join public.profiles p on p.id = ta.teacher_id and p.role = 'teacher'
      where mat.id::text = split_part(name, '/', 1) and ta.teacher_id = auth.uid()
    )
  );

-- This subquery runs with the requesting user's privileges, so material_audios RLS
-- filters locked materials and unregistered file paths before Storage can sign them.
drop policy if exists material_audio_storage_visible_read on storage.objects;
create policy material_audio_storage_visible_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'material-audio'
    and exists (
      select 1
      from public.material_audios ma
      where ma.file_path = storage.objects.name
    )
  );
