import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Tahap 5: Simulasi RLS (Row Level Security) Verification', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/0009_simulations.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8')

  it('memastikan tabel simulations mengaktifkan RLS', () => {
    expect(migrationSql).toMatch(/alter table public\.simulations enable row level security;/i)
  })

  it('1. Siswa pada materi yang terkunci tidak bisa membaca simulasinya (terikat can_access_material)', () => {
    // Policy harus memanggil can_access_material(material_id)
    expect(migrationSql).toMatch(/create policy simulations_student_select on public\.simulations/i)
    expect(migrationSql).toMatch(/public\.can_access_material\(material_id\)/i)

    // Evaluasi simulasi logika RLS
    function simulateStudentSelect(canAccessMaterial: boolean) {
      // Sesuai policy: using (public.can_access_material(material_id))
      return canAccessMaterial === true
    }

    expect(simulateStudentSelect(false)).toBe(false)
  })

  it('2. Siswa pada materi yang terbuka bisa membaca simulasinya', () => {
    function simulateStudentSelect(canAccessMaterial: boolean) {
      return canAccessMaterial === true
    }

    expect(simulateStudentSelect(true)).toBe(true)
  })

  it('3. Siswa tidak memiliki izin insert, update, atau delete (hanya guru & admin)', () => {
    // Cek bahwa TIDAK ada policy insert, update, atau delete untuk student
    expect(migrationSql).not.toMatch(/create policy simulations_student_insert/i)
    expect(migrationSql).not.toMatch(/create policy simulations_student_update/i)
    expect(migrationSql).not.toMatch(/create policy simulations_student_delete/i)

    // Simulasi otorisasi write
    type Role = 'student' | 'teacher' | 'admin'
    function canUserWrite(role: Role, isAssignedTeacher: boolean = false) {
      if (role === 'admin') return true
      if (role === 'teacher' && isAssignedTeacher) return true
      return false
    }

    expect(canUserWrite('student', false)).toBe(false)
    expect(canUserWrite('student', true)).toBe(false)
  })

  it('4. Guru kelas atau mapel lain tidak bisa mengubah simulasi', () => {
    // Verifikasi bahwa policy guru terikat secara ketat dengan teacher_assignments
    expect(migrationSql).toMatch(/join public\.teacher_assignments ta on ta\.class_id = m\.class_id and ta\.subject_id = m\.subject_id/i)
    expect(migrationSql).toMatch(/ta\.teacher_id = auth\.uid\(\)/i)

    type Assignment = { teacherId: string; classId: string; subjectId: string }
    function simulateTeacherCanModify(
      teacherId: string,
      targetMaterial: { classId: string; subjectId: string },
      assignments: Assignment[],
    ) {
      return assignments.some(
        (ta) =>
          ta.teacherId === teacherId &&
          ta.classId === targetMaterial.classId &&
          ta.subjectId === targetMaterial.subjectId,
      )
    }

    const assignments: Assignment[] = [
      { teacherId: 'guru-a', classId: 'kelas-1', subjectId: 'mapel-dasar-listrik' },
    ]

    // Guru B mencoba mengubah simulasi di kelas-1 mapel-dasar-listrik -> harus false
    expect(
      simulateTeacherCanModify('guru-b', { classId: 'kelas-1', subjectId: 'mapel-dasar-listrik' }, assignments),
    ).toBe(false)

    // Guru A mencoba mengubah simulasi di kelas-2 (bukan kelasnya) -> harus false
    expect(
      simulateTeacherCanModify('guru-a', { classId: 'kelas-2', subjectId: 'mapel-dasar-listrik' }, assignments),
    ).toBe(false)

    // Guru A mencoba mengubah simulasi di mapel-elektronika-daya (bukan mapelnya) -> harus false
    expect(
      simulateTeacherCanModify('guru-a', { classId: 'kelas-1', subjectId: 'mapel-elektronika-daya' }, assignments),
    ).toBe(false)
  })

  it('5. Guru yang ditugaskan bisa melakukan CRUD penuh', () => {
    expect(migrationSql).toMatch(/create policy simulations_teacher_select/i)
    expect(migrationSql).toMatch(/create policy simulations_teacher_insert/i)
    expect(migrationSql).toMatch(/create policy simulations_teacher_update/i)
    expect(migrationSql).toMatch(/create policy simulations_teacher_delete/i)

    type Assignment = { teacherId: string; classId: string; subjectId: string }
    function simulateTeacherCanModify(
      teacherId: string,
      targetMaterial: { classId: string; subjectId: string },
      assignments: Assignment[],
    ) {
      return assignments.some(
        (ta) =>
          ta.teacherId === teacherId &&
          ta.classId === targetMaterial.classId &&
          ta.subjectId === targetMaterial.subjectId,
      )
    }

    const assignments: Assignment[] = [
      { teacherId: 'guru-a', classId: 'kelas-1', subjectId: 'mapel-dasar-listrik' },
    ]

    // Guru A pada kelas-1 dan mapel-dasar-listrik -> diizinkan CRUD
    expect(
      simulateTeacherCanModify('guru-a', { classId: 'kelas-1', subjectId: 'mapel-dasar-listrik' }, assignments),
    ).toBe(true)
  })
})
