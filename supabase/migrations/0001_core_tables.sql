-- Tahap 1: tabel pengguna & kelas.
-- Tabel konten (modules, materials, quizzes, dst) dibuat di tahap berikutnya.

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  role            text not null check (role in ('student', 'teacher', 'admin')),
  -- text agar angka 0 di depan tidak hilang. Harus huruf kecil (sama dengan email di Auth).
  identity_number text not null unique check (identity_number = lower(identity_number)),
  created_at      timestamptz not null default now()
);

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- Kode kelas selalu huruf besar; trigger registrasi membandingkan dalam huruf besar.
  referral_code text not null unique check (referral_code = upper(referral_code) and length(referral_code) between 4 and 20),
  created_at    timestamptz not null default now()
);

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- student_id sebagai primary key = satu siswa hanya boleh satu kelas.
create table public.enrollments (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index enrollments_class_id_idx on public.enrollments (class_id);

create table public.teacher_assignments (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id, class_id)
);
create index teacher_assignments_class_id_idx on public.teacher_assignments (class_id);
