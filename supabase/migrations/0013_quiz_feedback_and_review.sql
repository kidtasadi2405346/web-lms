-- ==============================================================================
-- Mini LMS - Migration 0013: Umpan Balik Kuis, Review, dan Jawaban Per Soal
-- ==============================================================================

-- 1. Tambahkan kolom umpan balik dan review baru pada quizzes
alter table public.quizzes
  add column if not exists feedback_mode text,
  add column if not exists review_at timestamptz,
  add column if not exists sound_effects boolean default false,
  add column if not exists shuffle_questions boolean default false,
  add column if not exists shuffle_options boolean default false;

update public.quizzes
set feedback_mode = coalesce(feedback_mode, 'none')
where feedback_mode is null;

alter table public.quizzes
  alter column feedback_mode set default 'none',
  alter column feedback_mode set not null,
  alter column sound_effects set default false,
  alter column sound_effects set not null,
  alter column shuffle_questions set default false,
  alter column shuffle_questions set not null,
  alter column shuffle_options set default false,
  alter column shuffle_options set not null;

alter table public.quizzes drop constraint if exists quizzes_feedback_mode_check;
alter table public.quizzes add constraint quizzes_feedback_mode_check
  check (feedback_mode in ('none', 'after_submit', 'per_question'));

alter table public.quizzes drop constraint if exists quizzes_assessment_feedback_mode_check;
alter table public.quizzes add constraint quizzes_assessment_feedback_mode_check
  check (type <> 'assessment' or feedback_mode <> 'per_question');

-- 2. Penjelasan jawaban di question_keys
alter table public.question_keys
  add column if not exists explanation text;

-- 3. Riwayat jawaban per soal untuk mode per-soal
alter table public.quiz_attempts
  add column if not exists status text default 'submitted',
  add column if not exists started_at timestamptz default now(),
  add column if not exists finished_at timestamptz;

update public.quiz_attempts
set status = coalesce(status, 'submitted')
where status is null;

alter table public.quiz_attempts
  alter column status set default 'submitted',
  alter column status set not null,
  alter column started_at set default now();

create unique index if not exists quiz_attempts_student_quiz_active_idx
  on public.quiz_attempts (student_id, quiz_id)
  where status = 'in_progress';

create table if not exists public.quiz_attempt_answers (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  answer text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- 4. RLS baru: siswa tidak boleh membaca hasil mentah/kunci, guru hanya mengakses yang relevan
alter table public.quiz_attempt_answers enable row level security;

create policy quiz_attempt_answers_admin_select on public.quiz_attempt_answers
  for select to authenticated
  using (public.is_admin());

create policy quiz_attempt_answers_teacher_select on public.quiz_attempt_answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.quiz_attempts qa
      join public.quizzes q on q.id = qa.quiz_id
      where qa.id = quiz_attempt_answers.attempt_id
        and (
          (q.type = 'chapter' and exists (
            select 1 from public.modules m
            join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
            where m.id = q.module_id and ta.teacher_id = auth.uid()
          )) or
          (q.type = 'assessment' and exists (
            select 1 from public.teacher_assignments ta
            where ta.class_id = q.class_id and ta.subject_id = q.subject_id and ta.teacher_id = auth.uid()
          ))
        )
    )
  );

create policy quiz_attempt_answers_no_direct_write on public.quiz_attempt_answers
  for all to authenticated
  using (false)
  with check (false);

-- 5. Fungsi internal bersama untuk finalisasi hasil
drop function if exists public._finalize_attempt(uuid);
create or replace function public._finalize_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_quiz record;
  v_total_questions integer := 0;
  v_correct_count integer := 0;
  v_score numeric(5,2) := 0;
  v_passed boolean := false;
  v_question record;
  v_is_correct boolean;
begin
  select a.*, q.type, q.module_id, q.passing_score, q.due_at, q.allow_late
  into v_attempt
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  where a.id = p_attempt_id;

  if v_attempt.id is null then
    raise exception 'Percobaan kuis tidak ditemukan';
  end if;

  select * into v_quiz
  from public.quizzes
  where id = v_attempt.quiz_id;

  for v_question in (
    select q.id as question_id, k.correct_option
    from public.questions q
    join public.question_keys k on k.question_id = q.id
    where q.quiz_id = v_attempt.quiz_id
    order by q.order_index
  ) loop
    v_total_questions := v_total_questions + 1;

    select a.is_correct
    into v_is_correct
    from public.quiz_attempt_answers a
    where a.attempt_id = p_attempt_id and a.question_id = v_question.question_id;

    if coalesce(v_is_correct, false) then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  if v_total_questions = 0 then
    raise exception 'Kuis ini belum memiliki soal atau kunci jawaban';
  end if;

  v_score := round((v_correct_count::numeric / v_total_questions::numeric) * 100, 2);
  v_passed := v_score >= v_quiz.passing_score;

  update public.quiz_attempts
  set score = v_score,
      passed = v_passed,
      status = 'submitted',
      finished_at = coalesce(finished_at, now()),
      attempted_at = coalesce(attempted_at, started_at, now()),
      answers = coalesce((
        select jsonb_object_agg(question_id::text, answer)
        from public.quiz_attempt_answers
        where attempt_id = p_attempt_id
      ), '{}'::jsonb)
  where id = p_attempt_id;

  if v_quiz.type = 'chapter' and v_quiz.module_id is not null then
    insert into public.student_progress (student_id, quiz_id, module_id, highest_score, is_passed, updated_at)
    values (v_attempt.student_id, v_attempt.quiz_id, v_quiz.module_id, v_score, v_passed, now())
    on conflict (student_id, quiz_id)
    do update set
      highest_score = greatest(public.student_progress.highest_score, excluded.highest_score),
      is_passed = (public.student_progress.is_passed or excluded.is_passed),
      updated_at = now();
  end if;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'score', v_score,
    'passing_score', v_quiz.passing_score,
    'passed', v_passed,
    'total_questions', v_total_questions,
    'correct_count', v_correct_count,
    'type', v_quiz.type,
    'status', 'submitted'
  );
end;
$$;

revoke all on function public._finalize_attempt(uuid) from public, anon, authenticated;

-- 6. submit_quiz yang kompatibel dengan kuis lama, tetapi melarang mode per_question
drop function if exists public.submit_quiz(uuid, jsonb);
drop function if exists public.submit_quiz(uuid, json);
create or replace function public.submit_quiz(
  p_quiz_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_role text;
  v_quiz record;
  v_material_id uuid;
  v_total_questions integer := 0;
  v_correct_count integer := 0;
  v_score numeric(5,2) := 0;
  v_passed boolean := false;
  v_now timestamptz := now();
  v_question record;
  v_answer text;
  v_attempt_id uuid;
  v_attempt_count integer;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Tidak terautentikasi';
  end if;

  select role into v_role from public.profiles where id = v_student_id;
  if v_role is null then
    raise exception 'Profil pengguna tidak ditemukan';
  end if;

  if v_role not in ('student', 'admin') then
    raise exception 'Hanya siswa yang dapat mengumpulkan kuis';
  end if;

  select q.*, m.class_id as resolved_class_id
  into v_quiz
  from public.quizzes q
  left join public.modules m on m.id = q.module_id
  where q.id = p_quiz_id;

  if v_quiz.id is null then
    raise exception 'Kuis tidak ditemukan';
  end if;

  if v_quiz.feedback_mode = 'per_question' then
    raise exception 'Kuis ini memakai mode per soal. Gunakan mulai kuis dan jawab satu soal per satu.';
  end if;

  if v_quiz.type = 'chapter' then
    if v_quiz.material_id is not null then
      v_material_id := v_quiz.material_id;
    elsif v_quiz.module_id is not null then
      select m.id into v_material_id
      from public.materials m
      where m.module_id = v_quiz.module_id
      order by m.order_index
      limit 1;
    end if;

    if v_material_id is not null and v_role = 'student' and not public.can_access_material(v_material_id) then
      raise exception 'Kuis bab belum dibuka untuk Anda';
    end if;
  end if;

  if v_role = 'student' and not exists (
    select 1 from public.enrollments e where e.student_id = v_student_id and e.class_id = coalesce(v_quiz.class_id, v_quiz.resolved_class_id)
  ) then
    raise exception 'Anda tidak terdaftar di kelas untuk kuis ini';
  end if;

  select count(*) into v_attempt_count
  from public.quiz_attempts
  where quiz_id = p_quiz_id and student_id = v_student_id and status in ('in_progress', 'submitted');

  if v_quiz.max_attempts is not null and v_attempt_count >= v_quiz.max_attempts then
    raise exception 'Batas maksimal percobaan kuis telah tercapai';
  end if;

  if v_quiz.type = 'assessment' then
    if v_quiz.open_at is not null and v_now < v_quiz.open_at then
      raise exception 'Kuis penilaian belum dibuka';
    end if;
    if not v_quiz.allow_late and v_quiz.due_at is not null and v_now > v_quiz.due_at then
      raise exception 'Batas waktu pengerjaan kuis penilaian telah berakhir';
    end if;
    if v_quiz.close_at is not null and v_now > v_quiz.close_at then
      raise exception 'Batas akhir pengerjaan kuis penilaian telah ditutup';
    end if;
  end if;

  insert into public.quiz_attempts (
    quiz_id,
    student_id,
    score,
    passed,
    answers,
    status,
    started_at,
    finished_at,
    attempted_at,
    is_late
  )
  values (
    p_quiz_id,
    v_student_id,
    0,
    false,
    coalesce(p_answers, '{}'::jsonb),
    'submitted',
    v_now,
    v_now,
    v_now,
    (v_quiz.due_at is not null and v_now > v_quiz.due_at)
  )
  returning id into v_attempt_id;

  for v_question in (
    select q.id as question_id, k.correct_option
    from public.questions q
    join public.question_keys k on k.question_id = q.id
    where q.quiz_id = p_quiz_id
    order by q.order_index
  ) loop
    v_total_questions := v_total_questions + 1;
    v_answer := trim(coalesce(p_answers ->> v_question.question_id::text, ''));

    insert into public.quiz_attempt_answers (attempt_id, question_id, answer, is_correct)
    values (v_attempt_id, v_question.question_id, v_answer, upper(v_answer) = upper(v_question.correct_option))
    on conflict (attempt_id, question_id) do nothing;

    if upper(v_answer) = upper(v_question.correct_option) then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  if v_total_questions = 0 then
    raise exception 'Kuis ini belum memiliki soal atau kunci jawaban';
  end if;

  v_score := round((v_correct_count::numeric / v_total_questions::numeric) * 100, 2);
  v_passed := v_score >= v_quiz.passing_score;

  return public._finalize_attempt(v_attempt_id);
end;
$$;

revoke all on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- 7. start_quiz untuk mode per_question
drop function if exists public.start_quiz(uuid);
create or replace function public.start_quiz(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_quiz record;
  v_material_id uuid;
  v_existing record;
  v_attempt_count integer;
  v_now timestamptz := now();
begin
  if v_student_id is null then
    raise exception 'Tidak terautentikasi';
  end if;

  select q.*, m.class_id as resolved_class_id
  into v_quiz
  from public.quizzes q
  left join public.modules m on m.id = q.module_id
  where q.id = p_quiz_id;

  if v_quiz.id is null then
    raise exception 'Kuis tidak ditemukan';
  end if;

  if v_quiz.feedback_mode <> 'per_question' then
    raise exception 'Kuis ini tidak memakai mode per soal.';
  end if;

  if v_quiz.type = 'chapter' then
    if v_quiz.material_id is not null then
      v_material_id := v_quiz.material_id;
    elsif v_quiz.module_id is not null then
      select m.id into v_material_id
      from public.materials m
      where m.module_id = v_quiz.module_id
      order by m.order_index
      limit 1;
    end if;

    if v_material_id is not null and not public.can_access_material(v_material_id) then
      raise exception 'Kuis bab belum dibuka untuk Anda';
    end if;
  end if;

  if not exists (
    select 1 from public.enrollments e
    where e.student_id = v_student_id and e.class_id = coalesce(v_quiz.class_id, v_quiz.resolved_class_id)
  ) then
    raise exception 'Anda tidak terdaftar di kelas untuk kuis ini';
  end if;

  if v_quiz.type = 'assessment' then
    if v_quiz.open_at is not null and v_now < v_quiz.open_at then
      raise exception 'Kuis penilaian belum dibuka';
    end if;
    if not v_quiz.allow_late and v_quiz.due_at is not null and v_now > v_quiz.due_at then
      raise exception 'Batas waktu pengerjaan kuis penilaian telah berakhir';
    end if;
    if v_quiz.close_at is not null and v_now > v_quiz.close_at then
      raise exception 'Batas akhir pengerjaan kuis penilaian telah ditutup';
    end if;
  end if;

  select * into v_existing
  from public.quiz_attempts
  where quiz_id = p_quiz_id and student_id = v_student_id and status = 'in_progress'
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object('attempt_id', v_existing.id, 'status', 'in_progress');
  end if;

  select count(*) into v_attempt_count
  from public.quiz_attempts
  where quiz_id = p_quiz_id and student_id = v_student_id and status in ('submitted', 'in_progress');

  if v_quiz.max_attempts is not null and v_attempt_count >= v_quiz.max_attempts then
    raise exception 'Batas maksimal percobaan kuis telah tercapai';
  end if;

  insert into public.quiz_attempts (quiz_id, student_id, score, passed, answers, status, started_at, attempted_at)
  values (p_quiz_id, v_student_id, 0, false, '{}'::jsonb, 'in_progress', v_now, v_now)
  returning id into v_existing;

  return jsonb_build_object('attempt_id', v_existing.id, 'status', 'in_progress');
end;
$$;

revoke all on function public.start_quiz(uuid) from public, anon;
grant execute on function public.start_quiz(uuid) to authenticated;

-- 8. answer_question: menyimpan hasil soal per soal
drop function if exists public.answer_question(uuid, uuid, text);
create or replace function public.answer_question(p_attempt_id uuid, p_question_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_question record;
  v_is_correct boolean;
  v_answer text;
begin
  select a.*, q.type, q.feedback_mode
  into v_attempt
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  where a.id = p_attempt_id;

  if v_attempt.id is null then
    raise exception 'Percobaan kuis tidak ditemukan';
  end if;

  if v_attempt.student_id <> auth.uid() then
    raise exception 'Percobaan yang dijawab tidak milik akun Anda';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'Percobaan ini sudah selesai dan tidak menerima jawaban baru';
  end if;

  select q.id, q.quiz_id, q.question_text, q.options, k.correct_option, k.explanation
  into v_question
  from public.questions q
  join public.question_keys k on k.question_id = q.id
  where q.id = p_question_id;

  if v_question.id is null then
    raise exception 'Soal tidak ditemukan';
  end if;

  if v_question.quiz_id <> v_attempt.quiz_id then
    raise exception 'Soal tidak termasuk dalam kuis percobaan ini';
  end if;

  if exists (
    select 1 from public.quiz_attempt_answers where attempt_id = p_attempt_id and question_id = p_question_id
  ) then
    raise exception 'Soal ini sudah dijawab pada percobaan ini';
  end if;

  v_answer := coalesce(p_answer, '');
  v_is_correct := upper(trim(v_answer)) = upper(trim(v_question.correct_option));

  insert into public.quiz_attempt_answers (attempt_id, question_id, answer, is_correct)
  values (p_attempt_id, p_question_id, v_answer, v_is_correct);

  update public.quiz_attempts
  set answers = coalesce(answers, '{}'::jsonb) || jsonb_build_object(p_question_id::text, v_answer)
  where id = p_attempt_id;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_answer', v_question.correct_option,
    'explanation', v_question.explanation
  );
end;
$$;

revoke all on function public.answer_question(uuid, uuid, text) from public, anon;
grant execute on function public.answer_question(uuid, uuid, text) to authenticated;

-- 9. finish_quiz: wajib semua soal terjawab dan finalisasi hasil
drop function if exists public.finish_quiz(uuid);
create or replace function public.finish_quiz(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_total_questions integer;
begin
  select a.*, q.feedback_mode, q.type
  into v_attempt
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  where a.id = p_attempt_id;

  if v_attempt.id is null then
    raise exception 'Percobaan kuis tidak ditemukan';
  end if;

  if v_attempt.student_id <> auth.uid() then
    raise exception 'Percobaan ini bukan milik akun Anda';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'Percobaan ini sudah diselesaikan';
  end if;

  select count(*) into v_total_questions
  from public.questions where quiz_id = v_attempt.quiz_id;

  if (select count(*) from public.quiz_attempt_answers where attempt_id = p_attempt_id) < v_total_questions then
    raise exception 'Semua soal harus dijawab sebelum menutup kuis';
  end if;

  return public._finalize_attempt(p_attempt_id);
end;
$$;

revoke all on function public.finish_quiz(uuid) from public, anon;
grant execute on function public.finish_quiz(uuid) to authenticated;

-- 10. review untuk siswa setelah waktu dibuka
drop function if exists public.get_attempt_review(uuid);
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_rows jsonb;
begin
  select a.*, q.feedback_mode, q.review_at, q.type
  into v_attempt
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  where a.id = p_attempt_id;

  if v_attempt.id is null then
    raise exception 'Percobaan kuis tidak ditemukan';
  end if;

  if v_attempt.student_id <> auth.uid() then
    raise exception 'Percobaan ini bukan milik akun Anda';
  end if;

  if v_attempt.status <> 'submitted' then
    raise exception 'Review hanya tersedia untuk percobaan yang sudah diserahkan';
  end if;

  if v_attempt.feedback_mode not in ('after_submit', 'per_question') then
    raise exception 'Kuis ini tidak menyediakan pembahasan';
  end if;

  if v_attempt.review_at is not null and now() < v_attempt.review_at then
    raise exception 'Pembahasan akan dibuka pada % WIB', to_char(v_attempt.review_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI');
  end if;

  select jsonb_agg(item) into v_rows
  from (
    select
      q.id as question_id,
      q.question_text,
      q.options,
      coalesce(qa.answer, '') as student_answer,
      k.correct_option,
      coalesce(qa.is_correct, false) as is_correct,
      k.explanation,
      q.order_index
    from public.questions q
    left join public.quiz_attempt_answers qa
      on qa.question_id = q.id and qa.attempt_id = p_attempt_id
    join public.question_keys k on k.question_id = q.id
    where q.quiz_id = v_attempt.quiz_id
    order by q.order_index
  ) item;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;
