-- ==============================================================================
-- Tahap 6: Tugas dengan Batas Waktu, Pengumpulan Berkas/Tautan, Ekstensi Deadline,
-- RLS, Storage Bucket "submissions", dan RPC submit_assignment.
-- ==============================================================================

-- 1. TABEL ASSIGNMENTS
create table if not exists public.assignments (
  id                   uuid primary key default gen_random_uuid(),
  class_id             uuid not null references public.classes (id) on delete cascade,
  subject_id           uuid not null references public.subjects (id) on delete cascade,
  material_id          uuid references public.materials (id) on delete set null,
  title                text not null check (length(trim(title)) > 0),
  description          text,
  submission_type      text not null check (submission_type in ('file', 'link', 'both')),
  open_at              timestamptz not null,
  due_at               timestamptz not null,
  close_at             timestamptz,
  allow_late           boolean not null default true,
  late_penalty_percent int not null default 0 check (late_penalty_percent between 0 and 100),
  max_score            int not null default 100 check (max_score > 0),
  created_by           uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),

  -- CHECK: open_at < due_at, dan close_at >= due_at bila diisi.
  constraint assignments_dates_check check (
    open_at < due_at and
    (close_at is null or close_at >= due_at)
  )
);

create index if not exists assignments_class_subject_idx on public.assignments (class_id, subject_id);
create index if not exists assignments_material_id_idx on public.assignments (material_id);
create index if not exists assignments_due_at_idx on public.assignments (due_at);

-- 2. TABEL SUBMISSIONS
create table if not exists public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  student_id     uuid not null references public.profiles (id) on delete cascade,
  file_path      text,
  link_url       text,
  submitted_at   timestamptz not null default now(),
  is_late        boolean not null default false,
  score          numeric(5,2) check (score is null or score >= 0),
  feedback       text,
  graded_by      uuid references public.profiles (id) on delete set null,
  graded_at      timestamptz,

  unique (assignment_id, student_id)
);

create index if not exists submissions_assignment_idx on public.submissions (assignment_id);
create index if not exists submissions_student_idx on public.submissions (student_id);

-- 3. TABEL ASSIGNMENT_EXTENSIONS
create table if not exists public.assignment_extensions (
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  student_id     uuid not null references public.profiles (id) on delete cascade,
  new_due_at     timestamptz not null,
  reason         text,
  granted_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),

  primary key (assignment_id, student_id)
);

create index if not exists assignment_extensions_student_idx on public.assignment_extensions (student_id);

-- 4. STORAGE BUCKET: submissions
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  10485760, -- 10 MB limit
  array[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- 5. ROW LEVEL SECURITY (RLS)
alter table public.assignments           enable row level security;
alter table public.submissions           enable row level security;
alter table public.assignment_extensions enable row level security;

-- A. ASSIGNMENTS POLICIES
-- Admin: full access
create policy assignments_admin_all on public.assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Siswa: membaca tugas di kelas tempat ia terdaftar
create policy assignments_student_select on public.assignments
  for select to authenticated
  using (class_id = public.my_class_id());

-- Guru: membaca tugas di kelas dan mapel yang ia ajar
create policy assignments_teacher_select on public.assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.teacher_assignments ta
      where ta.class_id = assignments.class_id
        and ta.subject_id = assignments.subject_id
        and ta.teacher_id = auth.uid()
    )
  );

-- Guru: menambah tugas di kelas dan mapel yang ia ajar
create policy assignments_teacher_insert on public.assignments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.teacher_assignments ta
      where ta.class_id = assignments.class_id
        and ta.subject_id = assignments.subject_id
        and ta.teacher_id = auth.uid()
    )
  );

-- Guru: mengubah tugas di kelas dan mapel yang ia ajar
create policy assignments_teacher_update on public.assignments
  for update to authenticated
  using (
    exists (
      select 1 from public.teacher_assignments ta
      where ta.class_id = assignments.class_id
        and ta.subject_id = assignments.subject_id
        and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teacher_assignments ta
      where ta.class_id = assignments.class_id
        and ta.subject_id = assignments.subject_id
        and ta.teacher_id = auth.uid()
    )
  );

-- Guru: menghapus tugas di kelas dan mapel yang ia ajar
create policy assignments_teacher_delete on public.assignments
  for delete to authenticated
  using (
    exists (
      select 1 from public.teacher_assignments ta
      where ta.class_id = assignments.class_id
        and ta.subject_id = assignments.subject_id
        and ta.teacher_id = auth.uid()
    )
  );

-- B. SUBMISSIONS POLICIES
-- Admin: full access
create policy submissions_admin_all on public.submissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Siswa: membaca submissions miliknya saja
create policy submissions_student_select on public.submissions
  for select to authenticated
  using (student_id = auth.uid());

-- Guru: membaca submissions untuk kelas yang ia ajar
create policy submissions_teacher_select on public.submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      join public.teacher_assignments ta
        on ta.class_id = a.class_id
       and ta.subject_id = a.subject_id
      where a.id = submissions.assignment_id
        and ta.teacher_id = auth.uid()
    )
  );

-- Guru: menilai (mengubah score, feedback, graded_by, graded_at) untuk kelas yang ia ajar
create policy submissions_teacher_update on public.submissions
  for update to authenticated
  using (
    exists (
      select 1 from public.assignments a
      join public.teacher_assignments ta
        on ta.class_id = a.class_id
       and ta.subject_id = a.subject_id
      where a.id = submissions.assignment_id
        and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assignments a
      join public.teacher_assignments ta
        on ta.class_id = a.class_id
       and ta.subject_id = a.subject_id
      where a.id = submissions.assignment_id
        and ta.teacher_id = auth.uid()
    )
  );

-- Catatan RLS Submissions: Siswa TIDAK diberi policy insert/update langsung pada submissions.
-- Seluruh pengumpulan siswa WAJIB melalui fungsi RPC submit_assignment (SECURITY DEFINER).

-- C. ASSIGNMENT_EXTENSIONS POLICIES
-- Admin: full access
create policy assignment_extensions_admin_all on public.assignment_extensions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Siswa: membaca perpanjangan miliknya
create policy assignment_extensions_student_select on public.assignment_extensions
  for select to authenticated
  using (student_id = auth.uid());

-- Guru: CRUD perpanjangan hanya untuk tugas di kelas dan mapel miliknya
create policy assignment_extensions_teacher_all on public.assignment_extensions
  for all to authenticated
  using (
    exists (
      select 1 from public.assignments a
      join public.teacher_assignments ta
        on ta.class_id = a.class_id
       and ta.subject_id = a.subject_id
      where a.id = assignment_extensions.assignment_id
        and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assignments a
      join public.teacher_assignments ta
        on ta.class_id = a.class_id
       and ta.subject_id = a.subject_id
      where a.id = assignment_extensions.assignment_id
        and ta.teacher_id = auth.uid()
    )
  );

-- D. STORAGE OBJECTS POLICIES (bucket "submissions")
-- Siswa mengunggah ke foldernya sendiri: assignment_id/auth.uid()/nama-file
create policy submissions_storage_student_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  );

-- Siswa membaca foldernya sendiri
create policy submissions_storage_student_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  );

-- Guru membaca file siswa untuk tugas di kelas yang diajarkannya
create policy submissions_storage_teacher_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and exists (
      select 1 from public.assignments a
      join public.teacher_assignments ta
        on ta.class_id = a.class_id
       and ta.subject_id = a.subject_id
      where a.id::text = split_part(name, '/', 1)
        and ta.teacher_id = auth.uid()
    )
  );

-- Admin akses penuh pada storage submissions
create policy submissions_storage_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'submissions' and public.is_admin())
  with check (bucket_id = 'submissions' and public.is_admin());


-- ==============================================================================
-- 6. FUNGSI RPC: submit_assignment
-- SECURITY DEFINER: Menerapkan aturan batas waktu, validasi berkas/link,
-- dan pengumpulan ulang (upsert).
-- ==============================================================================
create or replace function public.submit_assignment(
  p_assignment_id uuid,
  p_file_path     text default null,
  p_link_url      text default null
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id        uuid;
  v_role              text;
  v_assignment        record;
  v_new_due_at        timestamptz;
  v_effective_due_at  timestamptz;
  v_now               timestamptz := now();
  v_is_late           boolean := false;
  v_submission_id     uuid;
  v_clean_file_path   text;
  v_clean_link_url    text;
  v_expected_prefix   text;
begin
  -- 1. Verifikasi autentikasi
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Tidak terautentikasi';
  end if;

  select role into v_role from public.profiles where id = v_student_id;
  if v_role != 'student' and v_role != 'admin' then
    raise exception 'Hanya siswa yang dapat mengumpulkan tugas';
  end if;

  -- 2. Ambil detail tugas
  select
    a.id,
    a.class_id,
    a.subject_id,
    a.title,
    a.submission_type,
    a.open_at,
    a.due_at,
    a.close_at,
    a.allow_late
  into v_assignment
  from public.assignments a
  where a.id = p_assignment_id;

  if v_assignment.id is null then
    raise exception 'Tugas tidak ditemukan';
  end if;

  -- 3. Pastikan siswa terdaftar di kelas tugas tersebut
  if v_role = 'student' and not exists (
    select 1 from public.enrollments
    where student_id = v_student_id and class_id = v_assignment.class_id
  ) then
    raise exception 'Anda tidak terdaftar di kelas untuk tugas ini';
  end if;

  -- 4. Pastikan now() >= open_at
  if v_now < v_assignment.open_at then
    raise exception 'Pengumpulan tugas belum dibuka';
  end if;

  -- 5. Hitung deadline efektif siswa (assignment_extensions bila ada, selain itu due_at)
  select new_due_at into v_new_due_at
  from public.assignment_extensions
  where assignment_id = p_assignment_id and student_id = v_student_id;

  v_effective_due_at := coalesce(v_new_due_at, v_assignment.due_at);

  -- 6. Terapkan aturan batas waktu
  -- Ketat: allow_late = false -> ditolak setelah deadline efektif
  if not v_assignment.allow_late and v_now > v_effective_due_at then
    raise exception 'Batas waktu pengumpulan telah berakhir (mode ketat)';
  end if;

  -- Dengan batas akhir: allow_late = true dan close_at diisi -> ditolak bila melewati close_at
  if v_assignment.allow_late and v_assignment.close_at is not null and v_now > v_assignment.close_at then
    raise exception 'Batas akhir pengumpulan tugas telah ditutup';
  end if;

  -- Hitung status keterlambatan
  v_is_late := (v_now > v_effective_due_at);

  -- 7. Bersihkan dan validasi masukan
  v_clean_file_path := nullif(trim(p_file_path), '');
  v_clean_link_url := nullif(trim(p_link_url), '');

  -- Validasi sesuai submission_type ('file' | 'link' | 'both')
  if v_assignment.submission_type = 'file' then
    if v_clean_file_path is null then
      raise exception 'Pengumpulan file wajib disertakan untuk tugas ini';
    end if;
  elsif v_assignment.submission_type = 'link' then
    if v_clean_link_url is null then
      raise exception 'Tautan (link) wajib disertakan untuk tugas ini';
    end if;
  elsif v_assignment.submission_type = 'both' then
    if v_clean_file_path is null or v_clean_link_url is null then
      raise exception 'File dan tautan (link) keduanya wajib disertakan untuk tugas ini';
    end if;
  end if;

  -- Validasi tautan: harus berawalan https://
  if v_clean_link_url is not null then
    if not (v_clean_link_url ~* '^https://') then
      raise exception 'Tautan harus berawalan https://';
    end if;
  end if;

  -- Validasi file_path: harus berawalan "assignment_id/auth.uid()/"
  if v_clean_file_path is not null then
    v_expected_prefix := p_assignment_id::text || '/' || v_student_id::text || '/';
    if not (v_clean_file_path like (v_expected_prefix || '%')) then
      raise exception 'Path file tidak valid (harus berawalan %)', v_expected_prefix;
    end if;
  end if;

  -- 8. Upsert ke tabel submissions (pengumpulan ulang menimpa yang lama)
  insert into public.submissions (
    assignment_id,
    student_id,
    file_path,
    link_url,
    submitted_at,
    is_late
  )
  values (
    p_assignment_id,
    v_student_id,
    v_clean_file_path,
    v_clean_link_url,
    v_now,
    v_is_late
  )
  on conflict (assignment_id, student_id)
  do update set
    file_path    = excluded.file_path,
    link_url     = excluded.link_url,
    submitted_at = excluded.submitted_at,
    is_late      = excluded.is_late
  returning id into v_submission_id;

  return json_build_object(
    'submission_id', v_submission_id,
    'assignment_id', p_assignment_id,
    'student_id', v_student_id,
    'is_late', v_is_late,
    'submitted_at', v_now,
    'message', case when v_is_late then 'Tugas berhasil dikumpulkan (Terlambat)' else 'Tugas berhasil dikumpulkan tepat waktu' end
  );
end;
$$;

revoke all on function public.submit_assignment(uuid, text, text) from public, anon;
grant execute on function public.submit_assignment(uuid, text, text) to authenticated;
