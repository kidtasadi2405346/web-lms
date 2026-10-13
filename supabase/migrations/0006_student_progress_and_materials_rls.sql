-- Tahap 3: Progres Belajar Siswa, Fungsi can_access_material, dan Penguncian RLS Materials

-- 1. Tabel pencatatan materi yang diselesaikan siswa
create table if public.material_completions is not exists (
  student_id   uuid not null references public.profiles (id) on delete cascade,
  material_id  uuid not null references public.materials (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, material_id)
);

-- Note: Postgres create table if not exists syntax:
create table if not exists public.material_completions (
  student_id   uuid not null references public.profiles (id) on delete cascade,
  material_id  uuid not null references public.materials (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, material_id)
);

create index if not exists material_completions_student_idx on public.material_completions (student_id);
create index if not exists material_completions_material_idx on public.material_completions (material_id);

alter table public.material_completions enable row level security;

-- Policies untuk material_completions:
create policy material_completions_admin_all on public.material_completions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy material_completions_teacher_select on public.material_completions
  for select to authenticated
  using (public.teaches_student(student_id));

create policy material_completions_student_select on public.material_completions
  for select to authenticated
  using (student_id = auth.uid());

create policy material_completions_student_insert on public.material_completions
  for insert to authenticated
  with check (student_id = auth.uid());

create policy material_completions_student_delete on public.material_completions
  for delete to authenticated
  using (student_id = auth.uid());

-- 2. Fungsi can_access_material
-- Memeriksa apakah user berhak membuka materi ini.
-- Untuk siswa: harus terdaftar di kelas dan semua materi sebelumnya di modul ini sudah selesai.
create or replace function public.can_access_material(p_material_id uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role             text;
  v_module_id        uuid;
  v_class_id         uuid;
  v_order_idx        int;
  v_prev_uncompleted int;
begin
  -- Ambil role user aktif
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    return false;
  end if;

  -- Admin selalu memiliki akses
  if v_role = 'admin' then
    return true;
  end if;

  -- Ambil modul dan kelas dari materi ini
  select m.module_id, mod.class_id, m.order_index
  into v_module_id, v_class_id, v_order_idx
  from public.materials m
  join public.modules mod on mod.id = m.module_id
  where m.id = p_material_id;

  if v_module_id is null then
    return false;
  end if;

  -- Guru: boleh jika mengajar di kelas ini
  if v_role = 'teacher' then
    return public.teaches_class(v_class_id);
  end if;

  -- Siswa:
  if v_role = 'student' then
    -- Pastikan siswa terdaftar di kelas modul ini
    if not exists (
      select 1 from public.enrollments
      where student_id = auth.uid() and class_id = v_class_id
    ) then
      return false;
    end if;

    -- Aturan Sekuensial:
    -- Hitung jumlah materi sebelumnya di modul yang sama yang BELUM diselesaikan siswa
    select count(*)
    into v_prev_uncompleted
    from public.materials prev_mat
    where prev_mat.module_id = v_module_id
      and prev_mat.order_index < v_order_idx
      and not exists (
        select 1 from public.material_completions mc
        where mc.student_id = auth.uid() and mc.material_id = prev_mat.id
      );

    -- Dapat diakses jika tidak ada materi sebelumnya yang belum tuntas
    return (v_prev_uncompleted = 0);
  end if;

  return false;
end;
$$;

revoke all on function public.can_access_material(uuid) from public, anon;
grant execute on function public.can_access_material(uuid) to authenticated;

-- 3. Perbarui RLS policy materials untuk siswa
-- Menggunakan can_access_material sehingga materi yang terkunci TIDAK BISA diambil/dibaca langsung oleh siswa lewat SQL/URL
drop policy if exists materials_student_select on public.materials;

create policy materials_student_select on public.materials
  for select to authenticated
  using (
    public.can_access_material(id)
  );

-- 4. Fungsi bantu get_student_class_modules
-- Mengembalikan struktur daftar modul & materi beserta status kunci (is_unlocked) dan selesai (is_completed)
-- tanpa membocorkan konten rahasia teks dan video jika materi masih terkunci.
create or replace function public.get_student_class_modules(p_class_id uuid)
returns json
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result json;
begin
  -- Validasi izin: siswa di kelas ini, guru pengampu, atau admin
  if not (
    public.is_admin() or
    public.teaches_class(p_class_id) or
    exists (select 1 from public.enrollments where student_id = auth.uid() and class_id = p_class_id)
  ) then
    return '[]'::json;
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'id', mod.id,
        'title', mod.title,
        'description', mod.description,
        'order_index', mod.order_index,
        'subject_name', s.name,
        'materials', (
          select coalesce(
            json_agg(
              json_build_object(
                'id', mat.id,
                'title', mat.title,
                'order_index', mat.order_index,
                'has_video', (mat.video_url is not null and trim(mat.video_url) != ''),
                'has_content', (mat.content is not null and trim(mat.content) != ''),
                'is_completed', exists (
                  select 1 from public.material_completions mc
                  where mc.student_id = auth.uid() and mc.material_id = mat.id
                ),
                'is_unlocked', public.can_access_material(mat.id)
              ) order by mat.order_index asc
            ),
            '[]'::json
          )
          from public.materials mat
          where mat.module_id = mod.id
        )
      ) order by mod.order_index asc
    ),
    '[]'::json
  )
  into v_result
  from public.modules mod
  join public.subjects s on s.id = mod.subject_id
  where mod.class_id = p_class_id;

  return coalesce(v_result, '[]'::json);
end;
$$;

revoke all on function public.get_student_class_modules(uuid) from public, anon;
grant execute on function public.get_student_class_modules(uuid) to authenticated;
