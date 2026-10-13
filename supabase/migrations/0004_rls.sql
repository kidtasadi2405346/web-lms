-- RLS untuk tabel Tahap 1. Tabel konten mendapat RLS di migration tahapnya masing-masing.
-- Tanpa policy INSERT/UPDATE/DELETE untuk siswa & guru = penulisan ditolak.
-- Trigger registrasi (SECURITY DEFINER) tidak terkena RLS.

-- Anon tidak butuh akses ke tabel mana pun (signUp/signIn lewat Auth, bukan tabel).
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

alter table public.profiles            enable row level security;
alter table public.classes             enable row level security;
alter table public.subjects            enable row level security;
alter table public.enrollments         enable row level security;
alter table public.teacher_assignments enable row level security;

-- profiles: baca milik sendiri; guru baca siswa di kelasnya; admin kelola semua.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_teacher on public.profiles
  for select to authenticated using (public.teaches_student(id));
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- classes: admin; guru pada kelas yang ditugaskan; siswa pada kelasnya sendiri.
-- (Lebih ketat dari master plan: siswa tidak bisa melihat kode kelas milik kelas lain.)
create policy classes_select_scoped on public.classes
  for select to authenticated
  using (public.is_admin() or id = public.my_class_id() or public.teaches_class(id));
create policy classes_admin_all on public.classes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- subjects: semua user login boleh baca; hanya admin yang mengubah.
create policy subjects_select_all on public.subjects
  for select to authenticated using (true);
create policy subjects_admin_all on public.subjects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- enrollments: siswa baca miliknya; guru baca kelas yang diampu; admin kelola.
create policy enrollments_select_own on public.enrollments
  for select to authenticated using (student_id = auth.uid());
create policy enrollments_select_teacher on public.enrollments
  for select to authenticated using (public.teaches_class(class_id));
create policy enrollments_admin_all on public.enrollments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- teacher_assignments: guru baca penugasannya sendiri; admin kelola.
create policy teacher_assignments_select_own on public.teacher_assignments
  for select to authenticated using (teacher_id = auth.uid());
create policy teacher_assignments_admin_all on public.teacher_assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
