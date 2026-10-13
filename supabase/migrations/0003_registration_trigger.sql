-- Registrasi siswa: dipicu setiap ada baris baru di auth.users.
--
-- Aturan keamanan:
--  * role SELALU 'student'. Metadata dari user tidak pernah dibaca untuk role.
--  * NIS (identity_number) diambil dari email samaran, bukan dari metadata.
--  * Kode kelas tidak valid -> exception -> pendaftaran dibatalkan seluruhnya.
--  * Tanpa referral_code di metadata = akun dibuat admin lewat Dashboard (guru/admin).
--    Trigger tidak membuat profil; admin membuatnya manual (lihat supabase/seed).
--    Akun tanpa profil tidak punya akses apa pun (RLS + middleware menolaknya).

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_code     text;
  v_name     text;
  v_identity text;
  v_class_id uuid;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));

  if v_code = '' then
    return new;
  end if;

  v_name := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  if v_name = '' then
    raise exception 'Nama wajib diisi';
  end if;

  if new.email is null or new.email !~ '^[A-Za-z0-9]{3,30}@lms\.local$' then
    raise exception 'Format NIS tidak valid';
  end if;
  v_identity := lower(split_part(new.email, '@', 1));

  select id into v_class_id from public.classes where referral_code = v_code;
  if v_class_id is null then
    raise exception 'Kode kelas tidak valid';
  end if;

  insert into public.profiles (id, name, role, identity_number)
  values (new.id, v_name, 'student', v_identity);

  insert into public.enrollments (student_id, class_id)
  values (new.id, v_class_id);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
