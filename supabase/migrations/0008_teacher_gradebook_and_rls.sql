-- ==============================================================================
-- Tahap 5: RLS Rekap Nilai & Progres Siswa untuk Guru
-- Memastikan guru HANYA dapat melihat data siswa (progres materi, riwayat kuis,
-- dan skor) pada kelas dan mata pelajaran yang ditugaskan padanya (teacher_assignments).
-- ==============================================================================

-- 1. Perketat policy SELECT pada quiz_attempts untuk guru
-- Guru hanya boleh melihat attempt kuis pada modul/kelas yang diajarkannya
drop policy if exists quiz_attempts_teacher_select on public.quiz_attempts;

create policy quiz_attempts_teacher_select on public.quiz_attempts
  for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      join public.modules m on m.id = q.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where q.id = quiz_attempts.quiz_id and ta.teacher_id = auth.uid()
    )
  );

-- 2. Perketat policy SELECT pada student_progress untuk guru
-- Guru hanya boleh melihat progres modul pada kelas yang diajarkannya
drop policy if exists student_progress_teacher_select on public.student_progress;

create policy student_progress_teacher_select on public.student_progress
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where m.id = student_progress.module_id and ta.teacher_id = auth.uid()
    )
  );

-- 3. Perketat policy SELECT pada material_completions untuk guru
-- Guru hanya boleh melihat penyelesaian materi pada modul/kelas yang diajarkannya
drop policy if exists material_completions_teacher_select on public.material_completions;

create policy material_completions_teacher_select on public.material_completions
  for select to authenticated
  using (
    exists (
      select 1 from public.materials mat
      join public.modules m on m.id = mat.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where mat.id = material_completions.material_id and ta.teacher_id = auth.uid()
    )
  );

-- 4. Verifikasi bahwa enrollments dan profiles sudah dilindungi
-- Catatan:
-- - enrollments_select_teacher: public.teaches_class(class_id)
--   (Guru hanya dapat melihat pendaftaran siswa di kelas yang diajarnya)
-- - profiles_select_teacher: public.teaches_student(id)
--   (Guru hanya dapat melihat profil siswa yang terdaftar di kelas yang diampu guru)
