-- ==============================================================================
-- Test Suite Tahap 6b: Quiz Types (Chapter vs Assessment), Windows, Attempts, & RLS
-- ==============================================================================
-- File ini menguji:
-- 1. Check Constraint pada tabel quizzes:
--    a. Assessment tanpa class_id atau subject_id -> ditolak
--    b. Tanggal open_at >= due_at -> ditolak
--    c. Tanggal close_at < due_at -> ditolak
-- 2. submit_quiz pada Kuis Bab (Chapter):
--    a. submit_quiz selalu menerima kapan saja
--    b. Memperbarui student_progress (mengunci/membuka bab berikutnya)
--    c. Tanpa batas percobaan jika max_attempts null
-- 3. submit_quiz pada Kuis Penilaian (Assessment):
--    a. Sebelum open_at -> ditolak
--    b. Di dalam jendela waktu -> diterima, is_late = false
--    c. Tidak membuat baris student_progress
--    d. Lewat due_at dengan allow_late = false -> ditolak (mode ketat)
--    e. Lewat due_at dengan allow_late = true -> diterima, is_late = true
--    f. Lewat close_at -> ditolak
--    g. Percobaan melebihi max_attempts -> ditolak
-- 4. RLS Pengujian:
--    a. Siswa tidak dapat membaca soal assessment sebelum open_at
--    b. Siswa kelas lain tidak dapat membaca soal assessment
--    c. Siswa tidak dapat membaca tabel question_keys
-- ==============================================================================

begin;

do $$
declare
  v_teacher_id       uuid := '44444444-4444-4444-4444-444444444444';
  v_student_a_id     uuid := '55555555-5555-5555-5555-555555555555';
  v_student_other_id uuid := '66666666-6666-6666-6666-666666666666';
  v_class_id         uuid;
  v_other_class_id   uuid;
  v_subject_id       uuid;
  v_module_id        uuid;
  v_material_id      uuid;

  v_quiz_chap        uuid;
  v_quiz_future      uuid;
  v_quiz_active      uuid;
  v_quiz_strict_late uuid;
  v_quiz_flex_late   uuid;
  v_quiz_closed      uuid;
  v_quiz_limited     uuid;

  v_q1               uuid;
  v_q2               uuid;

  v_res              json;
  v_caught           boolean;
  v_progress_count   int;
  v_attempt_count    int;
  v_questions_count  int;
begin
  raise notice '=== MEMULAI TEST TAHAP 6b: QUIZ TYPES & ASSESSMENT ===';

  -- 1. Setup Auth Users & Profiles
  insert into auth.users (id, email)
  values
    (v_teacher_id, 'guru_tahap6b@test.com'),
    (v_student_a_id, 'siswa_a_tahap6b@test.com'),
    (v_student_other_id, 'siswa_other_tahap6b@test.com')
  on conflict (id) do nothing;

  insert into public.profiles (id, name, role, identity_number)
  values
    (v_teacher_id, 'Guru Tahap 6b', 'teacher', 'guru_6b'),
    (v_student_a_id, 'Siswa A Tahap 6b', 'student', 'siswa_a_6b'),
    (v_student_other_id, 'Siswa Other Tahap 6b', 'student', 'siswa_other_6b')
  on conflict (id) do nothing;

  insert into public.classes (name, referral_code)
  values ('Kelas 6B Utama', 'CLS6B')
  returning id into v_class_id;

  insert into public.classes (name, referral_code)
  values ('Kelas 6B Lain', 'CLS6BLAIN')
  returning id into v_other_class_id;

  insert into public.subjects (name)
  values ('Fisika Kuantum 6B')
  returning id into v_subject_id;

  insert into public.enrollments (student_id, class_id)
  values
    (v_student_a_id, v_class_id),
    (v_student_other_id, v_other_class_id);

  insert into public.teacher_assignments (teacher_id, subject_id, class_id)
  values (v_teacher_id, v_subject_id, v_class_id);

  insert into public.modules (class_id, subject_id, title, order_index)
  values (v_class_id, v_subject_id, 'Bab 1 Relativitas', 1)
  returning id into v_module_id;

  insert into public.materials (module_id, title, order_index)
  values (v_module_id, 'Materi Pengantar', 1)
  returning id into v_material_id;

  -- ----------------------------------------------------------------------------
  -- TEST 1: Check Constraint Skema Quizzes
  -- ----------------------------------------------------------------------------
  -- 1a. Assessment tanpa class_id atau subject_id harus ditolak
  v_caught := false;
  begin
    insert into public.quizzes (type, title, passing_score)
    values ('assessment', 'Kuis Invalid Assessment', 70);
  exception when check_violation then
    v_caught := true;
  end;
  assert v_caught, 'CHECK CONSTRAINT FAILED: Assessment tanpa class_id & subject_id harusnya gagal';
  raise notice 'PASS: Check constraint assessment (class_id & subject_id) berhasil';

  -- 1b. open_at >= due_at harus ditolak
  v_caught := false;
  begin
    insert into public.quizzes (type, class_id, subject_id, title, passing_score, open_at, due_at)
    values ('assessment', v_class_id, v_subject_id, 'Kuis Invalid Waktu', 70, now() + interval '2 hours', now() + interval '1 hour');
  exception when check_violation then
    v_caught := true;
  end;
  assert v_caught, 'CHECK CONSTRAINT FAILED: open_at >= due_at harusnya gagal';
  raise notice 'PASS: Check constraint open_at < due_at berhasil';

  -- 1c. close_at < due_at harus ditolak
  v_caught := false;
  begin
    insert into public.quizzes (type, class_id, subject_id, title, passing_score, open_at, due_at, close_at)
    values ('assessment', v_class_id, v_subject_id, 'Kuis Invalid Close', 70, now() - interval '2 hours', now() + interval '2 hours', now() + interval '1 hour');
  exception when check_violation then
    v_caught := true;
  end;
  assert v_caught, 'CHECK CONSTRAINT FAILED: close_at < due_at harusnya gagal';
  raise notice 'PASS: Check constraint close_at >= due_at berhasil';

  -- ----------------------------------------------------------------------------
  -- SETUP KUIS & SOAL UNTUK PENGUJIAN LOGIKA
  -- ----------------------------------------------------------------------------
  -- Kuis Bab
  insert into public.quizzes (type, module_id, material_id, class_id, subject_id, title, passing_score)
  values ('chapter', v_module_id, v_material_id, v_class_id, v_subject_id, 'Kuis Bab 1', 70)
  returning id into v_quiz_chap;

  -- Kuis Penilaian: Masa Depan (belum dibuka)
  insert into public.quizzes (type, class_id, subject_id, title, passing_score, open_at, due_at)
  values ('assessment', v_class_id, v_subject_id, 'Kuis Masa Depan', 70, now() + interval '1 hour', now() + interval '3 hours')
  returning id into v_quiz_future;

  -- Kuis Penilaian: Aktif (dalam jendela waktu)
  insert into public.quizzes (type, class_id, subject_id, title, passing_score, open_at, due_at, allow_late, max_attempts)
  values ('assessment', v_class_id, v_subject_id, 'Kuis Aktif', 70, now() - interval '1 hour', now() + interval '2 hours', false, 1)
  returning id into v_quiz_active;

  -- Kuis Penilaian: Lewat Due Date Mode Ketat (allow_late = false)
  insert into public.quizzes (type, class_id, subject_id, title, passing_score, open_at, due_at, allow_late)
  values ('assessment', v_class_id, v_subject_id, 'Kuis Ketat Telat', 70, now() - interval '3 hours', now() - interval '1 hour', false)
  returning id into v_quiz_strict_late;

  -- Kuis Penilaian: Lewat Due Date Mode Fleksibel (allow_late = true, close_at null)
  insert into public.quizzes (type, class_id, subject_id, title, passing_score, open_at, due_at, allow_late)
  values ('assessment', v_class_id, v_subject_id, 'Kuis Fleksibel Telat', 70, now() - interval '3 hours', now() - interval '1 hour', true)
  returning id into v_quiz_flex_late;

  -- Kuis Penilaian: Lewat Close Date
  insert into public.quizzes (type, class_id, subject_id, title, passing_score, open_at, due_at, close_at, allow_late)
  values ('assessment', v_class_id, v_subject_id, 'Kuis Tertutup', 70, now() - interval '5 hours', now() - interval '3 hours', now() - interval '1 hour', true)
  returning id into v_quiz_closed;

  -- Helper function untuk membuat soal dan kunci jawaban
  -- Buat 1 soal di kuis bab
  insert into public.questions (quiz_id, question_text, options, order_index)
  values (v_quiz_chap, 'Siapa penemu relativitas?', jsonb_build_array(jsonb_build_object('key','A','text','Einstein'), jsonb_build_object('key','B','text','Newton')), 1)
  returning id into v_q1;
  insert into public.question_keys (question_id, correct_option) values (v_q1, 'A');

  -- Buat 1 soal di kuis aktif
  insert into public.questions (quiz_id, question_text, options, order_index)
  values (v_quiz_active, 'Berapa kecepatan cahaya?', jsonb_build_array(jsonb_build_object('key','A','text','300k km/s'), jsonb_build_object('key','B','text','100k km/s')), 1)
  returning id into v_q2;
  insert into public.question_keys (question_id, correct_option) values (v_q2, 'A');

  -- Salin soal ke kuis-kuis lainnya agar bisa di-submit
  insert into public.questions (quiz_id, question_text, options, order_index)
  values (v_quiz_future, 'Soal Rahasia?', jsonb_build_array(jsonb_build_object('key','A','text','X')), 1)
  returning id into v_q1;
  insert into public.question_keys (question_id, correct_option) values (v_q1, 'A');

  insert into public.questions (quiz_id, question_text, options, order_index)
  values (v_quiz_strict_late, 'Soal Ketat?', jsonb_build_array(jsonb_build_object('key','A','text','X')), 1)
  returning id into v_q1;
  insert into public.question_keys (question_id, correct_option) values (v_q1, 'A');

  insert into public.questions (quiz_id, question_text, options, order_index)
  values (v_quiz_flex_late, 'Soal Fleksibel?', jsonb_build_array(jsonb_build_object('key','A','text','X')), 1)
  returning id into v_q1;
  insert into public.question_keys (question_id, correct_option) values (v_q1, 'A');

  insert into public.questions (quiz_id, question_text, options, order_index)
  values (v_quiz_closed, 'Soal Tutup?', jsonb_build_array(jsonb_build_object('key','A','text','X')), 1)
  returning id into v_q1;
  insert into public.question_keys (question_id, correct_option) values (v_q1, 'A');

  -- ----------------------------------------------------------------------------
  -- TEST 2: submit_quiz pada Kuis Bab ('chapter')
  -- ----------------------------------------------------------------------------
  -- Simulasikan autentikasi sebagai Siswa A
  perform set_config('request.jwt.claim.sub', v_student_a_id::text, true);

  v_res := public.submit_quiz(
    v_quiz_chap,
    jsonb_build_object(
      (select id::text from public.questions where quiz_id = v_quiz_chap limit 1), 'A'
    )
  );
  assert (v_res->>'score')::numeric = 100, 'Kuis bab harusnya bernilai 100';
  assert (v_res->>'passed')::boolean = true, 'Kuis bab harusnya lulus';

  -- Pastikan student_progress terbuat dan terupdate
  select count(*) into v_progress_count
  from public.student_progress
  where student_id = v_student_a_id and quiz_id = v_quiz_chap and is_passed = true;
  assert v_progress_count = 1, 'Kuis bab wajib membuat/memperbarui student_progress';
  raise notice 'PASS: submit_quiz kuis bab berhasil dan mengupdate student_progress';

  -- ----------------------------------------------------------------------------
  -- TEST 3: submit_quiz pada Kuis Penilaian ('assessment')
  -- ----------------------------------------------------------------------------
  -- 3a. Ditolak jika sebelum open_at
  v_caught := false;
  begin
    perform public.submit_quiz(v_quiz_future, '{}'::jsonb);
  exception when others then
    if sqlerrm like '%belum dibuka%' then
      v_caught := true;
    end if;
  end;
  assert v_caught, 'submit_quiz sebelum open_at harus ditolak dengan pesan yang sesuai';
  raise notice 'PASS: Penolakan kuis penilaian sebelum open_at berhasil';

  -- 3b. Diterima di dalam jendela waktu, is_late = false
  v_res := public.submit_quiz(
    v_quiz_active,
    jsonb_build_object(
      v_q2::text, 'A'
    )
  );
  assert (v_res->>'is_late')::boolean = false, 'Kuis aktif tepat waktu tidak boleh is_late';
  assert (v_res->>'score')::numeric = 100, 'Skor harusnya 100';

  -- 3c. Kuis penilaian JANGAN membuat baris student_progress
  select count(*) into v_progress_count
  from public.student_progress
  where student_id = v_student_a_id and quiz_id = v_quiz_active;
  assert v_progress_count = 0, 'Kuis penilaian TIDAK BOLEH membuat baris student_progress';
  raise notice 'PASS: Kuis penilaian aktif diterima dan TIDAK membuat student_progress';

  -- 3d. Percobaan kedua pada kuis dengan max_attempts = 1 harus ditolak
  v_caught := false;
  begin
    perform public.submit_quiz(v_quiz_active, jsonb_build_object(v_q2::text, 'A'));
  exception when others then
    if sqlerrm like '%Batas maksimal percobaan%' then
      v_caught := true;
    end if;
  end;
  assert v_caught, 'submit_quiz melebihi max_attempts harus ditolak';
  raise notice 'PASS: Batas percobaan (max_attempts) berhasil diverifikasi';

  -- 3e. Lewat due_at pada mode ketat (allow_late = false) harus ditolak
  v_caught := false;
  begin
    perform public.submit_quiz(
      v_quiz_strict_late,
      jsonb_build_object(
        (select id::text from public.questions where quiz_id = v_quiz_strict_late limit 1), 'A'
      )
    );
  exception when others then
    if sqlerrm like '%mode ketat%' then
      v_caught := true;
    end if;
  end;
  assert v_caught, 'submit_quiz telat pada mode ketat harus ditolak';
  raise notice 'PASS: Penolakan keterlambatan mode ketat berhasil';

  -- 3f. Lewat due_at pada mode fleksibel (allow_late = true) harus diterima dengan is_late = true
  v_res := public.submit_quiz(
    v_quiz_flex_late,
    jsonb_build_object(
      (select id::text from public.questions where quiz_id = v_quiz_flex_late limit 1), 'A'
    )
  );
  assert (v_res->>'is_late')::boolean = true, 'submit_quiz fleksibel telat harus is_late = true';
  raise notice 'PASS: Penerimaan keterlambatan mode fleksibel (is_late = true) berhasil';

  -- 3g. Lewat close_at harus ditolak
  v_caught := false;
  begin
    perform public.submit_quiz(
      v_quiz_closed,
      jsonb_build_object(
        (select id::text from public.questions where quiz_id = v_quiz_closed limit 1), 'A'
      )
    );
  exception when others then
    if sqlerrm like '%telah ditutup%' then
      v_caught := true;
    end if;
  end;
  assert v_caught, 'submit_quiz setelah close_at harus ditolak';
  raise notice 'PASS: Penolakan submit_quiz setelah close_at berhasil';

  -- ----------------------------------------------------------------------------
  -- TEST 4: Row Level Security (RLS) Anti-Bocor Soal
  -- ----------------------------------------------------------------------------
  -- 4a. Siswa A membaca soal kuis yang belum dibuka (v_quiz_future) -> harus 0 baris (anti-bocor)
  select count(*) into v_questions_count
  from public.questions
  where quiz_id = v_quiz_future;
  assert v_questions_count = 0, 'RLS LEAK! Soal kuis belum dibuka tidak boleh bisa dibaca siswa';
  raise notice 'PASS: RLS Anti-Bocor: Siswa tidak bisa membaca soal kuis sebelum open_at';

  -- 4b. Siswa kelas lain (v_student_other_id) mencoba membaca soal kuis aktif di kelas A -> harus 0 baris
  perform set_config('request.jwt.claim.sub', v_student_other_id::text, true);
  select count(*) into v_questions_count
  from public.questions
  where quiz_id = v_quiz_active;
  assert v_questions_count = 0, 'RLS LEAK! Siswa kelas lain tidak boleh bisa membaca soal kuis';
  raise notice 'PASS: RLS Isolasi Kelas: Siswa kelas lain tidak dapat membaca soal';

  -- 4c. Siswa mencoba membaca kunci jawaban di tabel question_keys -> harus 0 baris
  select count(*) into v_questions_count
  from public.question_keys;
  assert v_questions_count = 0, 'RLS LEAK! Siswa tidak boleh bisa membaca tabel question_keys';
  raise notice 'PASS: RLS Rahasia Kunci: Siswa tidak dapat membaca question_keys';

  raise notice '=== SEMUA TEST TAHAP 6b BERHASIL LULUS 100%% ===';
end $$;

rollback;
