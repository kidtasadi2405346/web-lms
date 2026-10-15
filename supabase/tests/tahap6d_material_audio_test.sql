-- ==============================================================================
-- Tahap 6d: Material Audio, RLS, dan Storage privat
-- Jalankan setelah seluruh migration, termasuk 0014_material_audio.sql.
-- ==============================================================================

begin;

-- Fixture dibuat sebagai pemilik migration, lalu seluruh assertion RLS dijalankan sebagai authenticated.
insert into auth.users (id, email) values
  ('77777777-7777-4777-8777-777777777771', 'guru_6d_audio@test.com'),
  ('77777777-7777-4777-8777-777777777772', 'guru_lain_6d_audio@test.com'),
  ('77777777-7777-4777-8777-777777777773', 'siswa_6d_audio@test.com'),
  ('77777777-7777-4777-8777-777777777774', 'siswa_lain_6d_audio@test.com')
on conflict (id) do nothing;

insert into public.profiles (id, name, role, identity_number) values
  ('77777777-7777-4777-8777-777777777771', 'Guru 6d Audio', 'teacher', 'guru_6d_audio'),
  ('77777777-7777-4777-8777-777777777772', 'Guru Lain 6d Audio', 'teacher', 'guru_lain_6d_audio'),
  ('77777777-7777-4777-8777-777777777773', 'Siswa 6d Audio', 'student', 'siswa_6d_audio'),
  ('77777777-7777-4777-8777-777777777774', 'Siswa Lain 6d Audio', 'student', 'siswa_lain_6d_audio')
on conflict (id) do nothing;

insert into public.classes (id, name, referral_code) values
  ('77777777-7777-4777-8777-777777777775', 'Kelas 6d Audio', 'CLS6DAUDIO'),
  ('77777777-7777-4777-8777-777777777776', 'Kelas Lain 6d Audio', 'CLS6DOTHER')
on conflict (id) do nothing;

insert into public.subjects (id, name) values
  ('77777777-7777-4777-8777-777777777777', 'Mapel 6d Audio'),
  ('77777777-7777-4777-8777-777777777778', 'Mapel Lain 6d Audio')
on conflict (id) do nothing;

insert into public.enrollments (student_id, class_id) values
  ('77777777-7777-4777-8777-777777777773', '77777777-7777-4777-8777-777777777775'),
  ('77777777-7777-4777-8777-777777777774', '77777777-7777-4777-8777-777777777776')
on conflict (student_id) do nothing;

insert into public.teacher_assignments (teacher_id, subject_id, class_id) values
  ('77777777-7777-4777-8777-777777777771', '77777777-7777-4777-8777-777777777777', '77777777-7777-4777-8777-777777777775'),
  ('77777777-7777-4777-8777-777777777772', '77777777-7777-4777-8777-777777777778', '77777777-7777-4777-8777-777777777776')
on conflict (teacher_id, subject_id, class_id) do nothing;

insert into public.modules (id, class_id, subject_id, title, order_index) values
  ('77777777-7777-4777-8777-777777777779', '77777777-7777-4777-8777-777777777775', '77777777-7777-4777-8777-777777777777', 'Modul 6d Audio', 1),
  ('77777777-7777-4777-8777-777777777780', '77777777-7777-4777-8777-777777777776', '77777777-7777-4777-8777-777777777778', 'Modul Lain 6d Audio', 1)
on conflict (id) do nothing;

insert into public.materials (id, module_id, title, order_index) values
  ('77777777-7777-4777-8777-777777777781', '77777777-7777-4777-8777-777777777779', 'Materi Terbuka 6d', 0),
  ('77777777-7777-4777-8777-777777777782', '77777777-7777-4777-8777-777777777779', 'Materi Terkunci 6d', 1)
on conflict (id) do nothing;

insert into public.material_audios (id, material_id, title, file_path, order_index, created_by) values
  ('77777777-7777-4777-8777-777777777783', '77777777-7777-4777-8777-777777777781', 'Audio Terbuka', '77777777-7777-4777-8777-777777777781/77777777-7777-4777-8777-777777777786.mp3', 0, '77777777-7777-4777-8777-777777777771'),
  ('77777777-7777-4777-8777-777777777784', '77777777-7777-4777-8777-777777777782', 'Audio Terkunci', '77777777-7777-4777-8777-777777777782/77777777-7777-4777-8777-777777777787.mp3', 0, '77777777-7777-4777-8777-777777777771')
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name) values
  ('material-audio', '77777777-7777-4777-8777-777777777781/77777777-7777-4777-8777-777777777786.mp3'),
  ('material-audio', '77777777-7777-4777-8777-777777777782/77777777-7777-4777-8777-777777777787.mp3'),
  ('material-audio', '77777777-7777-4777-8777-777777777781/77777777-7777-4777-8777-777777777785.mp3');

do $$
declare
  v_public boolean;
  v_size_limit bigint;
  v_allowed_types text[];
begin
  select public, file_size_limit, allowed_mime_types
  into v_public, v_size_limit, v_allowed_types
  from storage.buckets where id = 'material-audio';
  assert v_public = false, 'Bucket material-audio harus privat';
  assert v_size_limit = 10485760, 'Batas ukuran bucket harus 10 MB';
  assert cardinality(v_allowed_types) = 4
     and v_allowed_types @> array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg'],
    'Bucket harus membatasi MIME ke empat tipe audio yang ditentukan';
end $$;

set local role authenticated;

do $$
declare
  v_teacher_id uuid := '77777777-7777-4777-8777-777777777771';
  v_other_teacher_id uuid := '77777777-7777-4777-8777-777777777772';
  v_student_id uuid := '77777777-7777-4777-8777-777777777773';
  v_other_student_id uuid := '77777777-7777-4777-8777-777777777774';
  v_open_material_id uuid := '77777777-7777-4777-8777-777777777781';
  v_open_audio_id uuid := '77777777-7777-4777-8777-777777777783';
  v_locked_audio_id uuid := '77777777-7777-4777-8777-777777777784';
  v_open_path text := '77777777-7777-4777-8777-777777777781/77777777-7777-4777-8777-777777777786.mp3';
  v_locked_path text := '77777777-7777-4777-8777-777777777782/77777777-7777-4777-8777-777777777787.mp3';
  v_orphan_path text := '77777777-7777-4777-8777-777777777781/77777777-7777-4777-8777-777777777785.mp3';
  v_count integer;
  v_rows integer;
  v_caught boolean;
  v_teacher_audio_id uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_student_id::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_student_id::text, true);

  select count(*) into v_count from public.material_audios where id = v_open_audio_id;
  assert v_count = 1, 'Siswa terdaftar harus dapat membaca audio materi terbuka';
  select count(*) into v_count from public.material_audios where id = v_locked_audio_id;
  assert v_count = 0, 'Siswa tidak boleh membaca audio materi terkunci';

  v_caught := false;
  begin
    insert into public.material_audios (material_id, title, file_path)
    values (v_open_material_id, 'Unggah ilegal', v_open_material_id::text || '/77777777-7777-4777-8777-777777777788.mp3');
  exception when insufficient_privilege then
    v_caught := true;
  end;
  assert v_caught, 'Siswa tidak boleh INSERT metadata audio';
  update public.material_audios set title = 'Diubah siswa' where id = v_open_audio_id;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'Siswa tidak boleh UPDATE metadata audio';
  delete from public.material_audios where id = v_open_audio_id;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'Siswa tidak boleh DELETE metadata audio';

  -- Baris metadata di subquery tetap terkena RLS material_audios.
  select count(*) into v_count from storage.objects where bucket_id = 'material-audio' and name = v_open_path;
  assert v_count = 1, 'Siswa harus dapat membaca object audio yang terlihat';
  select count(*) into v_count from storage.objects where bucket_id = 'material-audio' and name = v_locked_path;
  assert v_count = 0, 'Siswa tidak boleh membaca object audio materi terkunci';
  select count(*) into v_count from storage.objects where bucket_id = 'material-audio' and name = v_orphan_path;
  assert v_count = 0, 'Object tanpa baris material_audios tidak boleh dibaca';

  v_caught := false;
  begin
    insert into storage.objects (bucket_id, name)
    values ('material-audio', v_open_material_id::text || '/77777777-7777-4777-8777-777777777789.mp3');
  exception when insufficient_privilege then
    v_caught := true;
  end;
  assert v_caught, 'Siswa tidak boleh mengunggah object audio';
  delete from storage.objects where bucket_id = 'material-audio' and name = v_open_path;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'Siswa tidak boleh menghapus object audio';

  perform set_config('request.jwt.claims', json_build_object('sub', v_other_student_id::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_other_student_id::text, true);
  select count(*) into v_count from public.material_audios where id = v_open_audio_id;
  assert v_count = 0, 'Siswa kelas lain tidak boleh membaca metadata audio';
  select count(*) into v_count from storage.objects where bucket_id = 'material-audio' and name = v_open_path;
  assert v_count = 0, 'Siswa kelas lain tidak boleh membaca object audio';

  perform set_config('request.jwt.claims', json_build_object('sub', v_other_teacher_id::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_other_teacher_id::text, true);
  update public.material_audios set title = 'Diubah guru lain' where id = v_open_audio_id;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'Guru kelas lain tidak boleh mengubah metadata audio';
  delete from storage.objects where bucket_id = 'material-audio' and name = v_open_path;
  get diagnostics v_rows = row_count;
  assert v_rows = 0, 'Guru kelas lain tidak boleh menghapus object audio';
  v_caught := false;
  begin
    insert into storage.objects (bucket_id, name)
    values ('material-audio', v_open_material_id::text || '/77777777-7777-4777-8777-777777777790.mp3');
  exception when insufficient_privilege then
    v_caught := true;
  end;
  assert v_caught, 'Guru kelas lain tidak boleh mengunggah object audio';

  perform set_config('request.jwt.claims', json_build_object('sub', v_teacher_id::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_teacher_id::text, true);
  select count(*) into v_count from public.material_audios where id = v_open_audio_id;
  assert v_count = 1, 'Guru pengampu harus dapat membaca metadata audio';
  insert into public.material_audios (material_id, title, file_path, created_by)
  values (v_open_material_id, 'Audio Guru', v_open_material_id::text || '/77777777-7777-4777-8777-777777777791.mp3', v_teacher_id)
  returning id into v_teacher_audio_id;
  update public.material_audios set title = 'Audio Guru Diubah' where id = v_teacher_audio_id;
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'Guru pengampu harus dapat UPDATE metadata audio';
  delete from public.material_audios where id = v_teacher_audio_id;
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'Guru pengampu harus dapat DELETE metadata audio';

  insert into storage.objects (bucket_id, name)
  values ('material-audio', v_open_material_id::text || '/77777777-7777-4777-8777-777777777792.mp3');
  delete from storage.objects
  where bucket_id = 'material-audio'
    and name = v_open_material_id::text || '/77777777-7777-4777-8777-777777777792.mp3';
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'Guru pengampu harus dapat menghapus object audio';

  raise notice '=== SEMUA TES TAHAP 6d MATERIAL AUDIO BERHASIL ===';
end $$;

reset role;
rollback;
