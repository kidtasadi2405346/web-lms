# EduSpace — Tahap 1: Fondasi

Next.js (App Router, TS strict) + Tailwind + shadcn/ui + Supabase.

## Menjalankan

1. `npm install`
2. Buat proyek di Supabase. Authentication > Providers > Email: **matikan "Confirm email"**.
3. Salin `.env.local.example` ke `.env.local`, isi URL dan anon key.
4. Jalankan migration berurutan (SQL Editor, atau `supabase db push`):
   `0001_core_tables` → `0002_helper_functions` → `0003_registration_trigger` → `0004_rls`
5. Buat admin pertama dan guru: ikuti `supabase/seed/create_staff_profile.sql`.
6. `npm run dev` lalu buka http://localhost:3000

## Catatan desain

- NIS/NIP menjadi `{id}@lms.local` (huruf kecil). Untuk guru/admin buatan Dashboard, email harus huruf kecil.
- Akun yang dibuat tanpa kode kelas (guru/admin) tidak mendapat profil otomatis; profil dibuat admin lewat SQL.
  Pengguna tanpa profil ditolak middleware dan RLS.
- Role tidak pernah dibaca dari metadata; NIS diambil dari email di trigger.
- Pesan galat pendaftaran dari Supabase untuk kegagalan trigger selalu generik ("Database error saving new user"),
  jadi form menampilkan "Periksa kembali Kode Kelas".
