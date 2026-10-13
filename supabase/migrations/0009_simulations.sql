-- ==============================================================================
-- Tahap 5: Simulasi Interaktif Versi 1 (Tipe Embed)
-- Tabel simulations, check constraint tipe 'embed', dan RLS ketat berbasis
-- can_access_material (untuk siswa) dan teacher_assignments (untuk guru).
-- ==============================================================================

create table if not exists public.simulations (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.materials (id) on delete cascade,
  title        text not null,
  type         text not null default 'embed' check (type in ('embed')),
  config       jsonb not null default '{}'::jsonb,
  order_index  int not null default 0,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),

  -- Pastikan untuk tipe embed config berisi url yang valid (non-empty string)
  constraint simulations_embed_config_check check (
    jsonb_typeof(config) = 'object' and
    (config ? 'url') and
    jsonb_typeof(config->'url') = 'string' and
    length(trim(config->>'url')) > 0
  )
);

-- Indeks performa
create index if not exists simulations_material_idx on public.simulations (material_id);
create index if not exists simulations_material_order_idx on public.simulations (material_id, order_index);

-- Aktifkan RLS
alter table public.simulations enable row level security;

-- ==============================================================================
-- POLICIES: simulations
-- ==============================================================================

-- 1. Admin memiliki akses penuh (CRUD)
create policy simulations_admin_all on public.simulations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Siswa hanya dapat membaca simulasi jika can_access_material bernilai true
-- (Tidak bisa membaca simulasi pada materi yang terkunci)
create policy simulations_student_select on public.simulations
  for select to authenticated
  using (
    public.can_access_material(material_id)
  );

-- 3. Guru hanya dapat melihat simulasi pada kelas dan mapel yang ditugaskan padanya
create policy simulations_teacher_select on public.simulations
  for select to authenticated
  using (
    exists (
      select 1 from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where mat.id = simulations.material_id and ta.teacher_id = auth.uid()
    )
  );

-- 4. Guru hanya dapat menambah simulasi pada kelas dan mapel miliknya
create policy simulations_teacher_insert on public.simulations
  for insert to authenticated
  with check (
    exists (
      select 1 from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where mat.id = simulations.material_id and ta.teacher_id = auth.uid()
    )
  );

-- 5. Guru hanya dapat mengubah simulasi pada kelas dan mapel miliknya
create policy simulations_teacher_update on public.simulations
  for update to authenticated
  using (
    exists (
      select 1 from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where mat.id = simulations.material_id and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where mat.id = simulations.material_id and ta.teacher_id = auth.uid()
    )
  );

-- 6. Guru hanya dapat menghapus simulasi pada kelas dan mapel miliknya
create policy simulations_teacher_delete on public.simulations
  for delete to authenticated
  using (
    exists (
      select 1 from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where mat.id = simulations.material_id and ta.teacher_id = auth.uid()
    )
  );

-- (Catatan: Siswa tidak memiliki policy insert/update/delete, sehingga otomatis ditolak)
