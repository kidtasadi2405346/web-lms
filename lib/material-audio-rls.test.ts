import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/0014_material_audio.sql"),
  "utf8",
);

describe("Tahap 6d: material audio policies", () => {
  it("mengaktifkan RLS dan membatasi siswa ke enrollment serta materi yang terbuka", () => {
    expect(migration).toMatch(
      /alter table public\.material_audios enable row level security/i,
    );
    expect(migration).toMatch(
      /join public\.enrollments e on e\.class_id = m\.class_id and e\.student_id = auth\.uid\(\)/i,
    );
    expect(migration).toMatch(/public\.can_access_material\(mat\.id\)/i);
    expect(migration).not.toMatch(
      /create policy material_audios_student_(insert|update|delete)/i,
    );
  });

  it("mengikat CRUD guru pada penugasan kelas dan mata pelajaran", () => {
    expect(migration).toMatch(/material_audios_teacher_insert/i);
    expect(migration).toMatch(/material_audios_teacher_update/i);
    expect(migration).toMatch(/material_audios_teacher_delete/i);
    expect(migration).toMatch(
      /ta\.class_id = m\.class_id and ta\.subject_id = m\.subject_id/i,
    );
    expect(migration).toMatch(/ta\.teacher_id = auth\.uid\(\)/i);
  });

  it("mengatur bucket privat 10 MB dan empat MIME audio yang diizinkan", () => {
    expect(migration).toMatch(
      /'material-audio',[\s\S]*?false,[\s\S]*?10485760,[\s\S]*?array\['audio\/mpeg', 'audio\/mp4', 'audio\/x-m4a', 'audio\/ogg'\]/i,
    );
  });

  it("membaca storage hanya lewat baris material_audios yang tunduk pada RLS", () => {
    expect(migration).toMatch(
      /create policy material_audio_storage_visible_read on storage\.objects/i,
    );
    expect(migration).toMatch(
      /select 1\s+from public\.material_audios ma\s+where ma\.file_path = storage\.objects\.name/i,
    );
    expect(migration).toMatch(
      /create policy material_audio_storage_teacher_insert[\s\S]*?ta\.teacher_id = auth\.uid\(\)/i,
    );
    expect(migration).toMatch(
      /create policy material_audio_storage_teacher_delete[\s\S]*?ta\.teacher_id = auth\.uid\(\)/i,
    );
  });
});
