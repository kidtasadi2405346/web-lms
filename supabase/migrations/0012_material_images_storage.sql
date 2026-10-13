-- ==============================================================================
-- Mini LMS - Migration 0012: Material Images Storage Bucket & Policies
-- ==============================================================================

-- 1. Buat bucket 'material-images' jika belum ada
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'material-images',
    'material-images',
    true,
    2097152, -- 2 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Kebijakan Baca Publik: Siapa saja (termasuk siswa dan umum) dapat membaca gambar materi
DROP POLICY IF EXISTS "material_images_public_read" ON storage.objects;
CREATE POLICY "material_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'material-images');

-- 3. Kebijakan Upload: Hanya pengguna dengan role 'teacher' yang boleh mengunggah,
-- dan hanya ke dalam folder ID akun miliknya: (storage.foldername(name))[1] = auth.uid()::text
DROP POLICY IF EXISTS "material_images_teacher_insert" ON storage.objects;
CREATE POLICY "material_images_teacher_insert"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'material-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher'
    )
);

-- 4. Kebijakan Hapus: Guru hanya boleh menghapus gambar miliknya sendiri
DROP POLICY IF EXISTS "material_images_teacher_delete" ON storage.objects;
CREATE POLICY "material_images_teacher_delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'material-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher'
    )
);
