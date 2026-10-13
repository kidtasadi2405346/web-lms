-- Tahap 2: Tabel modules dan materials beserta RLS

create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  description text,
  order_index int not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index modules_class_subject_idx on public.modules (class_id, subject_id);

create table public.materials (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules (id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  content     text, -- Konten Rich Text (HTML dari TipTap)
  video_url   text, -- URL Video (YouTube atau Google Drive)
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

create index materials_module_id_idx on public.materials (module_id);

-- RLS
alter table public.modules   enable row level security;
alter table public.materials enable row level security;

-- ==============================================================================
-- POLICIES: modules
-- ==============================================================================

-- Admin memiliki akses penuh ke modules
create policy modules_admin_all on public.modules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Guru boleh melihat modul pada kelas yang diajarnya
create policy modules_teacher_select on public.modules
  for select to authenticated
  using (public.teaches_class(class_id));

-- Guru boleh menambah modul jika ditugaskan di kelas dan mapel terkait
create policy modules_teacher_insert on public.modules
  for insert to authenticated
  with check (
    exists (
      select 1 from public.teacher_assignments
      where teacher_id = auth.uid()
        and class_id = modules.class_id
        and subject_id = modules.subject_id
    )
  );

-- Guru boleh mengubah modul jika ditugaskan di kelas dan mapel terkait
create policy modules_teacher_update on public.modules
  for update to authenticated
  using (
    exists (
      select 1 from public.teacher_assignments
      where teacher_id = auth.uid()
        and class_id = modules.class_id
        and subject_id = modules.subject_id
    )
  )
  with check (
    exists (
      select 1 from public.teacher_assignments
      where teacher_id = auth.uid()
        and class_id = modules.class_id
        and subject_id = modules.subject_id
    )
  );

-- Guru boleh menghapus modul jika ditugaskan di kelas dan mapel terkait
create policy modules_teacher_delete on public.modules
  for delete to authenticated
  using (
    exists (
      select 1 from public.teacher_assignments
      where teacher_id = auth.uid()
        and class_id = modules.class_id
        and subject_id = modules.subject_id
    )
  );

-- Siswa boleh melihat modul pada kelas tempat ia terdaftar
create policy modules_student_select on public.modules
  for select to authenticated
  using (class_id = public.my_class_id());


-- ==============================================================================
-- POLICIES: materials
-- ==============================================================================

-- Admin memiliki akses penuh ke materials
create policy materials_admin_all on public.materials
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Guru boleh melihat materi di modul yang diajarnya
create policy materials_teacher_select on public.materials
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where m.id = materials.module_id and ta.teacher_id = auth.uid()
    )
  );

-- Guru boleh menambah materi di modul yang diajarnya
create policy materials_teacher_insert on public.materials
  for insert to authenticated
  with check (
    exists (
      select 1 from public.modules m
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where m.id = materials.module_id and ta.teacher_id = auth.uid()
    )
  );

-- Guru boleh mengubah materi di modul yang diajarnya
create policy materials_teacher_update on public.materials
  for update to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where m.id = materials.module_id and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.modules m
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where m.id = materials.module_id and ta.teacher_id = auth.uid()
    )
  );

-- Guru boleh menghapus materi di modul yang diajarnya
create policy materials_teacher_delete on public.materials
  for delete to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where m.id = materials.module_id and ta.teacher_id = auth.uid()
    )
  );

-- Siswa boleh melihat materi di modul kelasnya
create policy materials_student_select on public.materials
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      where m.id = materials.module_id and m.class_id = public.my_class_id()
    )
  );
