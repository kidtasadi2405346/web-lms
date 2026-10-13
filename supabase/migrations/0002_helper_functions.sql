-- Fungsi bantu untuk RLS. SECURITY DEFINER agar tidak memicu rekursi RLS
-- (mis. policy profiles yang perlu membaca profiles).

create or replace function public.get_my_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.get_my_role() = 'admin', false)
$$;

-- Kelas tempat siswa yang sedang login terdaftar (null jika bukan siswa / belum terdaftar).
create or replace function public.my_class_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select class_id from public.enrollments where student_id = auth.uid()
$$;

-- Apakah guru yang sedang login ditugaskan pada kelas ini (mapel apa pun)?
create or replace function public.teaches_class(p_class_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.teacher_assignments
    where teacher_id = auth.uid() and class_id = p_class_id
  )
$$;

-- Apakah siswa ini ada di salah satu kelas yang diampu guru yang sedang login?
create or replace function public.teaches_student(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.teacher_assignments ta on ta.class_id = e.class_id
    where e.student_id = p_student_id and ta.teacher_id = auth.uid()
  )
$$;

revoke all on function public.get_my_role()          from public, anon;
revoke all on function public.is_admin()             from public, anon;
revoke all on function public.my_class_id()          from public, anon;
revoke all on function public.teaches_class(uuid)    from public, anon;
revoke all on function public.teaches_student(uuid)  from public, anon;

grant execute on function public.get_my_role()         to authenticated;
grant execute on function public.is_admin()            to authenticated;
grant execute on function public.my_class_id()         to authenticated;
grant execute on function public.teaches_class(uuid)   to authenticated;
grant execute on function public.teaches_student(uuid) to authenticated;
