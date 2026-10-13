-- ==============================================================================
-- Tahap 6b: Tambahkan Jenis Kuis (Kuis Bab & Kuis Penilaian), Jendela Waktu,
-- Batas Percobaan (Max Attempts), RLS Anti-Bocor Soal, dan Perbaruan submit_quiz.
-- ==============================================================================

-- 1. PERBARUI TABEL QUIZZES
-- Tambah kolom jenis kuis, relasi kelas/mapel, jadwal batas waktu, dan max_attempts
alter table public.quizzes
  add column if not exists type text not null default 'chapter' check (type in ('chapter', 'assessment')),
  add column if not exists class_id uuid references public.classes (id) on delete cascade,
  add column if not exists subject_id uuid references public.subjects (id) on delete cascade,
  add column if not exists material_id uuid references public.materials (id) on delete set null,
  add column if not exists open_at timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists close_at timestamptz,
  add column if not exists allow_late boolean not null default false,
  add column if not exists max_attempts int check (max_attempts is null or max_attempts > 0);

-- Modul_id menjadi nullable (kuis penilaian tidak terikat modul bab)
alter table public.quizzes alter column module_id drop not null;

-- Sinkronisasi class_id dan subject_id pada kuis chapter yang sudah ada
update public.quizzes q
set class_id = m.class_id, subject_id = m.subject_id
from public.modules m
where q.module_id = m.id and (q.class_id is null or q.subject_id is null);

-- Unique index pada material_id hanya jika tidak null
create unique index if not exists quizzes_material_id_idx
  on public.quizzes (material_id)
  where material_id is not null;

-- Check constraint jenis kuis:
-- - Kuis 'chapter': wajib punya material_id atau module_id
-- - Kuis 'assessment': wajib punya class_id dan subject_id
alter table public.quizzes drop constraint if exists quizzes_type_check;
alter table public.quizzes add constraint quizzes_type_check check (
  (type = 'chapter' and (material_id is not null or module_id is not null)) or
  (type = 'assessment' and class_id is not null and subject_id is not null)
);

-- Check constraint waktu kuis (jika diisi)
alter table public.quizzes drop constraint if exists quizzes_dates_check;
alter table public.quizzes add constraint quizzes_dates_check check (
  (open_at is null or due_at is null or open_at < due_at) and
  (close_at is null or due_at is null or close_at >= due_at)
);

-- Indeks performa untuk kuis penilaian
create index if not exists quizzes_class_subject_type_idx
  on public.quizzes (class_id, subject_id, type);

-- 2. PERBARUI TABEL QUIZ_ATTEMPTS
alter table public.quiz_attempts
  add column if not exists is_late boolean not null default false;

-- 3. PERBARUI ROW LEVEL SECURITY (RLS)

-- A. RLS QUIZZES
drop policy if exists quizzes_teacher_all on public.quizzes;
create policy quizzes_teacher_all on public.quizzes
  for all to authenticated
  using (
    public.is_admin() or
    (
      type = 'chapter' and module_id is not null and exists (
        select 1 from public.modules m
        join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
        where m.id = quizzes.module_id and ta.teacher_id = auth.uid()
      )
    ) or
    (
      type = 'assessment' and class_id is not null and subject_id is not null and exists (
        select 1 from public.teacher_assignments ta
        where ta.class_id = quizzes.class_id and ta.subject_id = quizzes.subject_id and ta.teacher_id = auth.uid()
      )
    )
  )
  with check (
    public.is_admin() or
    (
      type = 'chapter' and module_id is not null and exists (
        select 1 from public.modules m
        join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
        where m.id = quizzes.module_id and ta.teacher_id = auth.uid()
      )
    ) or
    (
      type = 'assessment' and class_id is not null and subject_id is not null and exists (
        select 1 from public.teacher_assignments ta
        where ta.class_id = quizzes.class_id and ta.subject_id = quizzes.subject_id and ta.teacher_id = auth.uid()
      )
    )
  );

drop policy if exists quizzes_student_select on public.quizzes;
create policy quizzes_student_select on public.quizzes
  for select to authenticated
  using (
    (
      type = 'chapter' and exists (
        select 1 from public.modules m
        join public.enrollments e on e.class_id = m.class_id
        where m.id = quizzes.module_id and e.student_id = auth.uid()
      )
    ) or
    (
      type = 'assessment' and exists (
        select 1 from public.enrollments e
        where e.class_id = quizzes.class_id and e.student_id = auth.uid()
      )
    )
  );

-- B. RLS QUESTIONS (Soal Kuis Penilaian TIDAK boleh bocor sebelum open_at!)
drop policy if exists questions_student_select on public.questions;
create policy questions_student_select on public.questions
  for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = questions.quiz_id
        and (
          (
            q.type = 'chapter' and exists (
              select 1 from public.modules m
              join public.enrollments e on e.class_id = m.class_id
              where m.id = q.module_id and e.student_id = auth.uid()
            )
          ) or
          (
            q.type = 'assessment' and (q.open_at is null or now() >= q.open_at) and exists (
              select 1 from public.enrollments e
              where e.class_id = q.class_id and e.student_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists questions_teacher_all on public.questions;
create policy questions_teacher_all on public.questions
  for all to authenticated
  using (
    public.is_admin() or
    exists (
      select 1 from public.quizzes q
      where q.id = questions.quiz_id
        and (
          (
            q.type = 'chapter' and exists (
              select 1 from public.modules m
              join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
              where m.id = q.module_id and ta.teacher_id = auth.uid()
            )
          ) or
          (
            q.type = 'assessment' and exists (
              select 1 from public.teacher_assignments ta
              where ta.class_id = q.class_id and ta.subject_id = q.subject_id and ta.teacher_id = auth.uid()
            )
          )
        )
    )
  )
  with check (
    public.is_admin() or
    exists (
      select 1 from public.quizzes q
      where q.id = questions.quiz_id
        and (
          (
            q.type = 'chapter' and exists (
              select 1 from public.modules m
              join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
              where m.id = q.module_id and ta.teacher_id = auth.uid()
            )
          ) or
          (
            q.type = 'assessment' and exists (
              select 1 from public.teacher_assignments ta
              where ta.class_id = q.class_id and ta.subject_id = q.subject_id and ta.teacher_id = auth.uid()
            )
          )
        )
    )
  );

-- C. RLS QUESTION_KEYS (Kunci jawaban hanya guru/admin)
drop policy if exists question_keys_teacher_all on public.question_keys;
create policy question_keys_teacher_all on public.question_keys
  for all to authenticated
  using (
    public.is_admin() or
    exists (
      select 1 from public.questions qst
      join public.quizzes q on q.id = qst.quiz_id
      where qst.id = question_keys.question_id
        and (
          (
            q.type = 'chapter' and exists (
              select 1 from public.modules m
              join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
              where m.id = q.module_id and ta.teacher_id = auth.uid()
            )
          ) or
          (
            q.type = 'assessment' and exists (
              select 1 from public.teacher_assignments ta
              where ta.class_id = q.class_id and ta.subject_id = q.subject_id and ta.teacher_id = auth.uid()
            )
          )
        )
    )
  )
  with check (
    public.is_admin() or
    exists (
      select 1 from public.questions qst
      join public.quizzes q on q.id = qst.quiz_id
      where qst.id = question_keys.question_id
        and (
          (
            q.type = 'chapter' and exists (
              select 1 from public.modules m
              join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
              where m.id = q.module_id and ta.teacher_id = auth.uid()
            )
          ) or
          (
            q.type = 'assessment' and exists (
              select 1 from public.teacher_assignments ta
              where ta.class_id = q.class_id and ta.subject_id = q.subject_id and ta.teacher_id = auth.uid()
            )
          )
        )
    )
  );

-- D. RLS QUIZ_ATTEMPTS
drop policy if exists quiz_attempts_teacher_select on public.quiz_attempts;
create policy quiz_attempts_teacher_select on public.quiz_attempts
  for select to authenticated
  using (
    public.is_admin() or
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_attempts.quiz_id
        and (
          (
            q.type = 'chapter' and exists (
              select 1 from public.modules m
              join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
              where m.id = q.module_id and ta.teacher_id = auth.uid()
            )
          ) or
          (
            q.type = 'assessment' and exists (
              select 1 from public.teacher_assignments ta
              where ta.class_id = q.class_id and ta.subject_id = q.subject_id and ta.teacher_id = auth.uid()
            )
          )
        )
    )
  );


-- ==============================================================================
-- 4. FUNGSI RPC: submit_quiz (DIPERBARUI UNTUK CHAPTER & ASSESSMENT)
-- ==============================================================================
create or replace function public.submit_quiz(
  p_quiz_id uuid,
  p_answers jsonb
)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_student_id       uuid;
  v_role             text;
  v_quiz             record;
  v_class_id         uuid;
  v_attempt_count    int;
  v_now              timestamptz := now();
  v_is_late          boolean := false;
  v_total_questions  int := 0;
  v_correct_count    int := 0;
  v_score            numeric(5,2) := 0;
  v_passed           boolean := false;
  v_attempt_id       uuid;
  v_q                record;
  v_student_ans      text;
  v_correct_ans      text;
begin
  -- 1. Autentikasi
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Tidak terautentikasi';
  end if;

  select role into v_role from public.profiles where id = v_student_id;
  if v_role != 'student' and v_role != 'admin' then
    raise exception 'Hanya siswa yang dapat mengumpulkan kuis';
  end if;

  -- 2. Ambil data kuis dan kelasnya
  select
    q.id,
    q.type,
    q.module_id,
    q.material_id,
    q.class_id,
    q.subject_id,
    q.passing_score,
    q.open_at,
    q.due_at,
    q.close_at,
    q.allow_late,
    q.max_attempts,
    coalesce(q.class_id, m.class_id) as resolved_class_id
  into v_quiz
  from public.quizzes q
  left join public.modules m on m.id = q.module_id
  where q.id = p_quiz_id;

  if v_quiz.id is null then
    raise exception 'Kuis tidak ditemukan';
  end if;

  v_class_id := v_quiz.resolved_class_id;

  -- 3. Pastikan siswa terdaftar di kelas kuis ini
  if v_role = 'student' and not exists (
    select 1 from public.enrollments
    where student_id = v_student_id and class_id = v_class_id
  ) then
    raise exception 'Anda tidak terdaftar di kelas untuk kuis ini';
  end if;

  -- 4. Hitung jumlah attempt yang sudah dilakukan siswa
  select count(*) into v_attempt_count
  from public.quiz_attempts
  where quiz_id = p_quiz_id and student_id = v_student_id;

  -- Cek batas max_attempts (jika disetel)
  if v_quiz.max_attempts is not null and v_attempt_count >= v_quiz.max_attempts then
    raise exception 'Batas maksimal percobaan pengerjaan kuis (% kali) telah tercapai', v_quiz.max_attempts;
  end if;

  -- 5. Validasi jendela waktu
  if v_quiz.type = 'assessment' then
    -- Kuis Penilaian: wajib dalam jendela waktu yang sah
    if v_quiz.open_at is not null and v_now < v_quiz.open_at then
      raise exception 'Kuis penilaian belum dibuka';
    end if;

    -- Mode ketat: tolak setelah due_at jika allow_late = false
    if not v_quiz.allow_late and v_quiz.due_at is not null and v_now > v_quiz.due_at then
      raise exception 'Batas waktu pengerjaan kuis penilaian telah berakhir (mode ketat)';
    end if;

    -- Tolak setelah close_at bila diisi
    if v_quiz.close_at is not null and v_now > v_quiz.close_at then
      raise exception 'Batas akhir pengerjaan kuis penilaian telah ditutup';
    end if;

    v_is_late := (v_quiz.due_at is not null and v_now > v_quiz.due_at);
  else
    -- Kuis Bab: due_at hanya penanda target (rekomendasi), submit_quiz selalu menerima
    v_is_late := (v_quiz.due_at is not null and v_now > v_quiz.due_at);
  end if;

  -- 6. Hitung penilaian jawaban siswa
  for v_q in (
    select q.id as question_id, k.correct_option
    from public.questions q
    join public.question_keys k on k.question_id = q.id
    where q.quiz_id = p_quiz_id
  ) loop
    v_total_questions := v_total_questions + 1;
    v_student_ans := trim(coalesce(p_answers ->> v_q.question_id::text, ''));
    v_correct_ans := trim(v_q.correct_option);

    if upper(v_student_ans) = upper(v_correct_ans) then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  if v_total_questions = 0 then
    raise exception 'Kuis ini belum memiliki soal atau kunci jawaban';
  end if;

  v_score := round(((v_correct_count::numeric / v_total_questions::numeric) * 100), 2);
  v_passed := (v_score >= v_quiz.passing_score);

  -- 7. Simpan riwayat attempt (dengan kolom is_late yang terisi otomatis)
  insert into public.quiz_attempts (quiz_id, student_id, score, passed, answers, attempted_at, is_late)
  values (p_quiz_id, v_student_id, v_score, v_passed, coalesce(p_answers, '{}'::jsonb), v_now, v_is_late)
  returning id into v_attempt_id;

  -- 8. Update progres siswa HANYA untuk kuis bab ('chapter')
  -- Kuis penilaian ('assessment') TIDAK mengunci bab dan JANGAN membuat baris student_progress!
  if v_quiz.type = 'chapter' and v_quiz.module_id is not null then
    insert into public.student_progress (student_id, quiz_id, module_id, highest_score, is_passed, updated_at)
    values (v_student_id, p_quiz_id, v_quiz.module_id, v_score, v_passed, v_now)
    on conflict (student_id, quiz_id)
    do update set
      highest_score = greatest(public.student_progress.highest_score, excluded.highest_score),
      is_passed = (public.student_progress.is_passed or excluded.is_passed),
      updated_at = v_now;
  end if;

  return json_build_object(
    'attempt_id', v_attempt_id,
    'score', v_score,
    'passing_score', v_quiz.passing_score,
    'passed', v_passed,
    'total_questions', v_total_questions,
    'correct_count', v_correct_count,
    'is_late', v_is_late,
    'type', v_quiz.type,
    'attempts_left', case when v_quiz.max_attempts is not null then greatest(0, v_quiz.max_attempts - (v_attempt_count + 1)) else null end
  );
end;
$$;

revoke all on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;
