-- ==============================================================================
-- PANDUAN SEEDING TAHAP 1: MEMBUAT AKUN ADMIN & GURU PERTAMA
-- ==============================================================================
--
-- LANGKAH 1 (Dashboard Supabase):
-- 1. Buka menu Authentication > Providers > Email, pastikan "Confirm email" DINONAKTIFKAN.
-- 2. Buka menu Authentication > Users > "Add user" > "Create new user":
--
--    a. Akun Admin:
--       - Email    : admin01@lms.local   (wajib huruf kecil)
--       - Password : (buat password, misal: password123)
--       - Centang "Auto Confirm User"
--
--    b. Akun Guru:
--       - Email    : 198001012005011001@lms.local   (NIP, wajib huruf kecil)
--       - Password : (buat password, misal: password123)
--       - Centang "Auto Confirm User"
--
-- LANGKAH 2 (SQL Editor Supabase):
-- Jalankan query di bawah ini untuk mengaitkan akun dengan profil dan data awal:

-- 1. Buat profil untuk Admin:
insert into public.profiles (id, name, role, identity_number)
select id,
       'Budi Administrator',
       'admin',
       split_part(email, '@', 1)
from auth.users
where email = 'admin01@lms.local'
on conflict (id) do update set role = excluded.role, name = excluded.name;

-- 2. Buat profil untuk Guru:
insert into public.profiles (id, name, role, identity_number)
select id,
       'Natarina Wulan Sari, S.Pd.',
       'teacher',
       split_part(email, '@', 1)
from auth.users
where email = '198001012005011001@lms.local'
on conflict (id) do update set role = excluded.role, name = excluded.name;

-- 3. Data Awal Kelas & Mata Pelajaran untuk Uji Coba:
insert into public.classes (name, referral_code)
values ('X IPA 1', 'XIPA1-2026')
on conflict (referral_code) do nothing;

insert into public.subjects (name)
values ('Matematika')
on conflict (name) do nothing;

-- 4. Tugaskan Guru ke Kelas dan Mata Pelajaran:
insert into public.teacher_assignments (teacher_id, subject_id, class_id)
select p.id, s.id, c.id
from public.profiles p, public.subjects s, public.classes c
where p.identity_number = '198001012005011001'
  and s.name = 'Matematika'
  and c.name = 'X IPA 1'
on conflict (teacher_id, subject_id, class_id) do nothing;
