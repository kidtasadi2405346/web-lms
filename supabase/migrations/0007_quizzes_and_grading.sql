-- Tahap 4: Sistem Kuis Pilihan Ganda, Question Keys, Quiz Attempts, Student Progress, dan RPC submit_quiz

-- ==============================================================================
-- 1. TABEL QUIZZES
-- ==============================================================================
create table if not exists public.quizzes (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references public.modules (id) on delete cascade,
  title             text not null check (length(trim(title)) > 0),
  description       text,
  passing_score     int not null default 70 check (passing_score between 0 and 100),
  shuffle_questions boolean not null default false,
  shuffle_options   boolean not null default false,
  order_index       int not null default 0,
  created_at        timestamptz not null default now()
);

-- Penambahan kolom aman jika tabel quizzes sudah pernah dibuat sebelumnya
alter table public.quizzes add column if not exists shuffle_questions boolean not null default false;
alter table public.quizzes add column if not exists shuffle_options boolean not null default false;

create index if not exists quizzes_module_id_idx on public.quizzes (module_id);

-- ==============================================================================
-- 2. TABEL QUESTIONS (Soal dan Opsi Pilihan Ganda)
-- ==============================================================================
create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes (id) on delete cascade,
  question_text text not null check (length(trim(question_text)) > 0),
  -- options format: jsonb array of objects [{"key": "A", "text": "Pilihan A"}, ...] atau key-value
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  order_index   int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists questions_quiz_id_idx on public.questions (quiz_id);

-- ==============================================================================
-- 3. TABEL QUESTION_KEYS (Kunci Jawaban - TERPISAH DAN RAHASIA DARI SISWA)
-- ==============================================================================
create table if not exists public.question_keys (
  question_id    uuid primary key references public.questions (id) on delete cascade,
  correct_option text not null check (length(trim(correct_option)) > 0),
  created_at     timestamptz not null default now()
);

-- ==============================================================================
-- 4. TABEL QUIZ_ATTEMPTS (Riwayat Pengerjaan Kuis)
-- ==============================================================================
create table if not exists public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  score        numeric(5,2) not null check (score between 0 and 100),
  passed       boolean not null default false,
  answers      jsonb not null default '{}'::jsonb, -- Jawaban siswa {"question_id": "A"}
  attempted_at timestamptz not null default now()
);

create index if not exists quiz_attempts_student_quiz_idx on public.quiz_attempts (student_id, quiz_id);

-- ==============================================================================
-- 5. TABEL STUDENT_PROGRESS (Rekap Progres Ketuntasan Kuis dan Modul Siswa)
-- ==============================================================================
create table if not exists public.student_progress (
  student_id   uuid not null references public.profiles (id) on delete cascade,
  quiz_id      uuid not null references public.quizzes (id) on delete cascade,
  module_id    uuid not null references public.modules (id) on delete cascade,
  highest_score numeric(5,2) not null default 0 check (highest_score between 0 and 100),
  is_passed    boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (student_id, quiz_id)
);

create index if not exists student_progress_student_module_idx on public.student_progress (student_id, module_id);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.quizzes          enable row level security;
alter table public.questions        enable row level security;
alter table public.question_keys    enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.student_progress enable row level security;

-- A. QUIZZES
create policy quizzes_admin_all on public.quizzes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy quizzes_teacher_all on public.quizzes
  for all to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where m.id = quizzes.module_id and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.modules m
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where m.id = quizzes.module_id and ta.teacher_id = auth.uid()
    )
  );

create policy quizzes_student_select on public.quizzes
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      where m.id = quizzes.module_id and m.class_id = public.my_class_id()
    )
  );

-- B. QUESTIONS
create policy questions_admin_all on public.questions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy questions_teacher_all on public.questions
  for all to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      join public.modules m on m.id = q.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where q.id = questions.quiz_id and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quizzes q
      join public.modules m on m.id = q.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where q.id = questions.quiz_id and ta.teacher_id = auth.uid()
    )
  );

create policy questions_student_select on public.questions
  for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      join public.modules m on m.id = q.module_id
      where q.id = questions.quiz_id and m.class_id = public.my_class_id()
    )
  );

-- C. QUESTION_KEYS (PENTING: SISWA TIDAK DIBERI AKSES SAMA SEKALI)
create policy question_keys_admin_all on public.question_keys
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy question_keys_teacher_all on public.question_keys
  for all to authenticated
  using (
    exists (
      select 1 from public.questions q
      join public.quizzes qz on qz.id = q.quiz_id
      join public.modules m on m.id = qz.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where q.id = question_keys.question_id and ta.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.questions q
      join public.quizzes qz on qz.id = q.quiz_id
      join public.modules m on m.id = qz.module_id
      join public.teacher_assignments ta on ta.class_id = m.class_id and ta.subject_id = m.subject_id
      where q.id = question_keys.question_id and ta.teacher_id = auth.uid()
    )
  );
-- (Siswa tidak memiliki policy SELECT/INSERT/UPDATE/DELETE pada question_keys)

-- D. QUIZ_ATTEMPTS
create policy quiz_attempts_admin_all on public.quiz_attempts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy quiz_attempts_teacher_select on public.quiz_attempts
  for select to authenticated
  using (public.teaches_student(student_id));

create policy quiz_attempts_student_select on public.quiz_attempts
  for select to authenticated
  using (student_id = auth.uid());

-- E. STUDENT_PROGRESS
create policy student_progress_admin_all on public.student_progress
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy student_progress_teacher_select on public.student_progress
  for select to authenticated
  using (public.teaches_student(student_id));

create policy student_progress_student_select on public.student_progress
  for select to authenticated
  using (student_id = auth.uid());

-- ==============================================================================
-- 7. FUNGSI RPC: submit_quiz
-- Menilai jawaban siswa secara aman di server PostgreSQL dan mencatat progres.
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
  v_module_id        uuid;
  v_class_id         uuid;
  v_passing_score    int;
  v_total_questions  int := 0;
  v_correct_count    int := 0;
  v_score            numeric(5,2) := 0;
  v_passed           boolean := false;
  v_attempt_id       uuid;
  v_q                record;
  v_student_ans      text;
  v_correct_ans      text;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Tidak terautentikasi';
  end if;

  select role into v_role from public.profiles where id = v_student_id;
  if v_role != 'student' and v_role != 'admin' then
    raise exception 'Hanya siswa yang dapat mengumpulkan kuis';
  end if;

  -- Ambil data kuis dan modul
  select q.module_id, q.passing_score, m.class_id
  into v_module_id, v_passing_score, v_class_id
  from public.quizzes q
  join public.modules m on m.id = q.module_id
  where q.id = p_quiz_id;

  if v_module_id is null then
    raise exception 'Kuis tidak ditemukan';
  end if;

  -- Pastikan siswa terdaftar di kelas modul ini
  if v_role = 'student' and not exists (
    select 1 from public.enrollments
    where student_id = v_student_id and class_id = v_class_id
  ) then
    raise exception 'Anda tidak terdaftar di kelas untuk kuis ini';
  end if;

  -- Hitung penilaian soal dan kunci
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
  v_passed := (v_score >= v_passing_score);

  -- 1. Simpan riwayat attempt
  insert into public.quiz_attempts (quiz_id, student_id, score, passed, answers)
  values (p_quiz_id, v_student_id, v_score, v_passed, coalesce(p_answers, '{}'::jsonb))
  returning id into v_attempt_id;

  -- 2. Update progres siswa
  insert into public.student_progress (student_id, quiz_id, module_id, highest_score, is_passed, updated_at)
  values (v_student_id, p_quiz_id, v_module_id, v_score, v_passed, now())
  on conflict (student_id, quiz_id)
  do update set
    highest_score = greatest(public.student_progress.highest_score, excluded.highest_score),
    is_passed = (public.student_progress.is_passed or excluded.is_passed),
    updated_at = now();

  return json_build_object(
    'attempt_id', v_attempt_id,
    'score', v_score,
    'passing_score', v_passing_score,
    'passed', v_passed,
    'total_questions', v_total_questions,
    'correct_count', v_correct_count
  );
end;
$$;

revoke all on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- ==============================================================================
-- 8. INTEGRASI DENGAN can_access_material
-- Jika modul memiliki kuis: setelah kuis lulus, materi modul berikutnya otomatis terbuka.
-- ==============================================================================
create or replace function public.can_access_material(p_material_id uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role             text;
  v_module_id        uuid;
  v_class_id         uuid;
  v_subject_id       uuid;
  v_mod_order        int;
  v_order_idx        int;
  v_prev_uncompleted int;
  v_unpassed_prev_quiz int;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    return false;
  end if;

  if v_role = 'admin' then
    return true;
  end if;

  select m.module_id, mod.class_id, mod.subject_id, mod.order_index, m.order_index
  into v_module_id, v_class_id, v_subject_id, v_mod_order, v_order_idx
  from public.materials m
  join public.modules mod on mod.id = m.module_id
  where m.id = p_material_id;

  if v_module_id is null then
    return false;
  end if;

  if v_role = 'teacher' then
    return public.teaches_class(v_class_id);
  end if;

  if v_role = 'student' then
    if not exists (
      select 1 from public.enrollments
      where student_id = auth.uid() and class_id = v_class_id
    ) then
      return false;
    end if;

    -- Aturan 1: Materi-materi sebelumnya di modul yang sama harus selesai
    select count(*)
    into v_prev_uncompleted
    from public.materials prev_mat
    where prev_mat.module_id = v_module_id
      and prev_mat.order_index < v_order_idx
      and not exists (
        select 1 from public.material_completions mc
        where mc.student_id = auth.uid() and mc.material_id = prev_mat.id
      );

    if v_prev_uncompleted > 0 then
      return false;
    end if;

    -- Aturan 2: Jika ada modul sebelumnya (di mapel yang sama) yang memiliki kuis,
    -- kuis tersebut harus sudah LULUS (is_passed = true di student_progress)
    select count(*)
    into v_unpassed_prev_quiz
    from public.quizzes q
    join public.modules prev_mod on prev_mod.id = q.module_id
    where prev_mod.class_id = v_class_id
      and prev_mod.subject_id = v_subject_id
      and prev_mod.order_index < v_mod_order
      and not exists (
        select 1 from public.student_progress sp
        where sp.student_id = auth.uid()
          and sp.quiz_id = q.id
          and sp.is_passed = true
      );

    if v_unpassed_prev_quiz > 0 then
      return false;
    end if;

    return true;
  end if;

  return false;
end;
$$;
