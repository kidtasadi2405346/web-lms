-- ==============================================================================
-- Test Suite Tahap 6: Assignments, Submissions, Deadlines, Extensions, & RLS
-- ==============================================================================
-- File ini menguji:
-- 1. Check Constraint pada tabel assignments (open_at < due_at, close_at >= due_at)
-- 2. RPC submit_assignment:
--    a. Tepat sebelum deadline -> is_late = false
--    b. Tepat sesudah deadline (mode fleksibel) -> is_late = true
--    c. Setelah close_at -> ditolak (exception)
--    d. Mode ketat setelah deadline -> ditolak (exception)
--    e. Perpanjangan deadline (extension) -> submit setelah due_at asli tapi sebelum new_due_at -> is_late = false
--    f. Link tidak valid (bukan https://) -> ditolak (exception)
--    g. File path tidak valid (bukan assignment_id/uid/...) -> ditolak (exception)
-- 3. RLS submissions:
--    a. Siswa hanya dapat membaca submissions miliknya
--    b. Siswa lain tidak dapat membaca submission siswa lain
--    c. Guru pengampu dapat membaca dan memberi nilai submissions
--    d. Direct insert siswa ke tabel submissions ditolak (wajib lewat RPC)
-- ==============================================================================

begin;

do $$
declare
  v_teacher_id     uuid := '11111111-1111-1111-1111-111111111111';
  v_student_a_id   uuid := '22222222-2222-2222-2222-222222222222';
  v_student_b_id   uuid := '33333333-3333-3333-3333-333333333333';
  v_class_id       uuid;
  v_subject_id     uuid;
  v_assign_flex    uuid;
  v_assign_close   uuid;
  v_assign_strict  uuid;
  v_res            json;
  v_caught         boolean;
begin
  raise notice '=== MEMULAI TEST TAHAP 6 ===';

  -- 1. Setup Data Dummy (Profiles, Class, Subject, Enrollment, Teacher Assignment)
  insert into auth.users (id, email)
  values
    (v_teacher_id, 'guru_tahap6@test.com'),
    (v_student_a_id, 'siswa_a_tahap6@test.com'),
    (v_student_b_id, 'siswa_b_tahap6@test.com')
  on conflict (id) do nothing;

  insert into public.profiles (id, name, role, identity_number)
  values
    (v_teacher_id, 'Guru Tahap 6', 'teacher', 'guru_tahap6'),
    (v_student_a_id, 'Siswa A Tahap 6', 'student', 'siswa_a_tahap6'),
    (v_student_b_id, 'Siswa B Tahap 6', 'student', 'siswa_b_tahap6')
  on conflict (id) do nothing;

  insert into public.classes (name, referral_code)
  values ('Kelas Tahap 6', 'CLS6TEST')
  returning id into v_class_id;

  insert into public.subjects (name)
  values ('Mapel Tahap 6')
  returning id into v_subject_id;

  insert into public.enrollments (student_id, class_id)
  values
    (v_student_a_id, v_class_id),
    (v_student_b_id, v_class_id);

  insert into public.teacher_assignments (teacher_id, subject_id, class_id)
  values (v_teacher_id, v_subject_id, v_class_id);

  -- ----------------------------------------------------------------------------
  -- TEST 1: Check Constraint Tanggal Tugas
  -- ----------------------------------------------------------------------------
  v_caught := false;
  begin
    insert into public.assignments (
      class_id, subject_id, title, submission_type,
      open_at, due_at
    ) values (
      v_class_id, v_subject_id, 'Tugas Tanggal Invalid', 'file',
      now() + interval '2 hours', now() + interval '1 hour' -- open_at > due_at (INVALID)
    );
  exception when check_violation then
    v_caught := true;
  end;
  assert v_caught, 'CHECK CONSTRAINT FAILED: Harusnya gagal saat open_at >= due_at';
  raise notice 'PASS: Check constraint open_at < due_at berhasil diverifikasi';

  v_caught := false;
  begin
    insert into public.assignments (
      class_id, subject_id, title, submission_type,
      open_at, due_at, close_at
    ) values (
      v_class_id, v_subject_id, 'Tugas Close Invalid', 'file',
      now() - interval '2 hours', now() + interval '2 hours', now() + interval '1 hour' -- close_at < due_at (INVALID)
    );
  exception when check_violation then
    v_caught := true;
  end;
  assert v_caught, 'CHECK CONSTRAINT FAILED: Harusnya gagal saat close_at < due_at';
  raise notice 'PASS: Check constraint close_at >= due_at berhasil diverifikasi';

  -- Buat 3 macam tugas untuk pengujian batas waktu:
  -- 1) Fleksibel (allow_late = true, due_at in the future)
  insert into public.assignments (
    class_id, subject_id, title, submission_type,
    open_at, due_at, close_at, allow_late
  ) values (
    v_class_id, v_subject_id, 'Tugas Fleksibel', 'both',
    now() - interval '2 hours', now() + interval '2 hours', null, true
  ) returning id into v_assign_flex;

  -- 2) Dengan batas akhir (close_at lampau)
  insert into public.assignments (
    class_id, subject_id, title, submission_type,
    open_at, due_at, close_at, allow_late
  ) values (
    v_class_id, v_subject_id, 'Tugas Dengan Batas Akhir Lampau', 'link',
    now() - interval '5 hours', now() - interval '2 hours', now() - interval '1 hour', true
  ) returning id into v_assign_close;

  -- 3) Ketat (allow_late = false, due_at lampau)
  insert into public.assignments (
    class_id, subject_id, title, submission_type,
    open_at, due_at, close_at, allow_late
  ) values (
    v_class_id, v_subject_id, 'Tugas Ketat Lampau', 'file',
    now() - interval '4 hours', now() - interval '1 hour', null, false
  ) returning id into v_assign_strict;

  -- ----------------------------------------------------------------------------
  -- TEST 2: submit_assignment - Tepat sebelum deadline (On Time)
  -- ----------------------------------------------------------------------------
  -- Set auth context sebagai Siswa A
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_a_id::text, 'role', 'authenticated')::text, true);

  v_res := public.submit_assignment(
    v_assign_flex,
    v_assign_flex::text || '/' || v_student_a_id::text || '/laporan.pdf',
    'https://github.com/siswa/project'
  );
  assert (v_res->>'is_late')::boolean = false, 'SUBMIT FAILED: Harusnya is_late = false';
  raise notice 'PASS: Pengumpulan sebelum deadline tercatat is_late = false';

  -- ----------------------------------------------------------------------------
  -- TEST 3: submit_assignment - Tepat sesudah deadline pada mode Fleksibel (Terlambat)
  -- ----------------------------------------------------------------------------
  -- Update v_assign_flex agar due_at mundur ke masa lampau
  update public.assignments
  set due_at = now() - interval '10 minutes'
  where id = v_assign_flex;

  v_res := public.submit_assignment(
    v_assign_flex,
    v_assign_flex::text || '/' || v_student_a_id::text || '/laporan_revisi.pdf',
    'https://github.com/siswa/project-v2'
  );
  assert (v_res->>'is_late')::boolean = true, 'SUBMIT FAILED: Harusnya is_late = true';
  raise notice 'PASS: Pengumpulan sesudah deadline pada mode fleksibel tercatat is_late = true';

  -- ----------------------------------------------------------------------------
  -- TEST 4: submit_assignment - Lewat close_at (Ditolak)
  -- ----------------------------------------------------------------------------
  v_caught := false;
  begin
    perform public.submit_assignment(
      v_assign_close,
      null,
      'https://demo.com'
    );
  exception when others then
    if sqlerrm like '%telah ditutup%' or sqlerrm like '%close_at%' then
      v_caught := true;
    else
      raise;
    end if;
  end;
  assert v_caught, 'SUBMIT FAILED: Harusnya ditolak karena lewat close_at';
  raise notice 'PASS: Pengumpulan lewat close_at berhasil ditolak';

  -- ----------------------------------------------------------------------------
  -- TEST 5: submit_assignment - Mode ketat setelah deadline (Ditolak)
  -- ----------------------------------------------------------------------------
  v_caught := false;
  begin
    perform public.submit_assignment(
      v_assign_strict,
      v_assign_strict::text || '/' || v_student_a_id::text || '/tugas.pdf',
      null
    );
  exception when others then
    if sqlerrm like '%mode ketat%' then
      v_caught := true;
    else
      raise;
    end if;
  end;
  assert v_caught, 'SUBMIT FAILED: Harusnya ditolak pada mode ketat';
  raise notice 'PASS: Pengumpulan lewat deadline pada mode ketat berhasil ditolak';

  -- ----------------------------------------------------------------------------
  -- TEST 6: submit_assignment - Perpanjangan deadline (Extension)
  -- ----------------------------------------------------------------------------
  -- Beri perpanjangan untuk Siswa A pada tugas ketat hingga 2 jam ke depan
  insert into public.assignment_extensions (
    assignment_id, student_id, new_due_at, reason, granted_by
  ) values (
    v_assign_strict, v_student_a_id, now() + interval '2 hours', 'Izin sakit', v_teacher_id
  );

  -- Siswa A submit kembali pada tugas ketat
  v_res := public.submit_assignment(
    v_assign_strict,
    v_assign_strict::text || '/' || v_student_a_id::text || '/tugas_perpanjangan.pdf',
    null
  );
  assert (v_res->>'is_late')::boolean = false, 'SUBMIT FAILED: Harusnya berhasil dan is_late = false karena ada perpanjangan';
  raise notice 'PASS: Pengumpulan dengan perpanjangan deadline berhasil dan is_late = false';

  -- ----------------------------------------------------------------------------
  -- TEST 7: submit_assignment - Validasi Tautan (Harus https://)
  -- ----------------------------------------------------------------------------
  v_caught := false;
  begin
    perform public.submit_assignment(
      v_assign_flex,
      v_assign_flex::text || '/' || v_student_a_id::text || '/file.pdf',
      'http://insecure-link.com'
    );
  exception when others then
    if sqlerrm like '%https://%' then
      v_caught := true;
    else
      raise;
    end if;
  end;
  assert v_caught, 'VALIDASI FAILED: Harusnya ditolak jika tautan bukan https://';
  raise notice 'PASS: Validasi link bukan https:// berhasil ditolak';

  -- ----------------------------------------------------------------------------
  -- TEST 8: submit_assignment - Validasi File Path (Harus assignment_id/uid/...)
  -- ----------------------------------------------------------------------------
  v_caught := false;
  begin
    perform public.submit_assignment(
      v_assign_flex,
      'hacker_folder/file.pdf',
      'https://valid-link.com'
    );
  exception when others then
    if sqlerrm like '%Path file tidak valid%' then
      v_caught := true;
    else
      raise;
    end if;
  end;
  assert v_caught, 'VALIDASI FAILED: Harusnya ditolak jika path tidak berawalan assignment_id/uid/';
  raise notice 'PASS: Validasi file path ilegal berhasil ditolak';

  -- ----------------------------------------------------------------------------
  -- TEST 9: RLS Submissions
  -- ----------------------------------------------------------------------------
  -- a. Siswa A dapat melihat submissions miliknya
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_a_id::text, 'role', 'authenticated')::text, true);
  assert (select count(*) from public.submissions where student_id = v_student_a_id) > 0, 'RLS FAILED: Siswa A harus bisa membaca submission miliknya';

  -- b. Siswa B TIDAK DAPAT melihat submission milik Siswa A
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_b_id::text, 'role', 'authenticated')::text, true);
  assert (select count(*) from public.submissions where student_id = v_student_a_id) = 0, 'RLS FAILED: Siswa B TIDAK BOLEH membaca submission Siswa A';
  raise notice 'PASS: RLS isolasi submission antar siswa terbukti aman';

  -- c. Direct INSERT oleh siswa ke tabel submissions harus gagal
  v_caught := false;
  begin
    insert into public.submissions (assignment_id, student_id, file_path)
    values (v_assign_flex, v_student_b_id, 'direct_hack.pdf');
  exception when others then
    v_caught := true;
  end;
  assert v_caught, 'RLS FAILED: Direct INSERT ke submissions oleh siswa harus dilarang';
  raise notice 'PASS: Direct insert siswa ke tabel submissions berhasil ditolak';

  -- d. Guru dapat melihat submission siswa di kelas yang diajarnya dan memberi nilai
  perform set_config('request.jwt.claims', json_build_object('sub', v_teacher_id::text, 'role', 'authenticated')::text, true);
  assert (select count(*) from public.submissions where assignment_id = v_assign_flex) > 0, 'RLS FAILED: Guru harus bisa melihat submission di kelasnya';

  update public.submissions
  set score = 95, feedback = 'Kerja bagus!', graded_by = v_teacher_id, graded_at = now()
  where assignment_id = v_assign_flex and student_id = v_student_a_id;
  assert (select score from public.submissions where assignment_id = v_assign_flex and student_id = v_student_a_id) = 95, 'RLS FAILED: Guru harus bisa memberi nilai';
  raise notice 'PASS: Guru dapat membaca dan memberi nilai pada submissions';

  raise notice '=== SEMUA 9 TES TAHAP 6 BERHASIL (100%% PASS) ===';
end $$;

rollback;
