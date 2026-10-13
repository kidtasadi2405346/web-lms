import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TeacherClassAssignments } from './teacher-class-assignments'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TeacherClassAssignmentsPage({ params }: PageProps) {
  const profile = await requireRole('teacher')
  const { id: classId } = await params
  const supabase = await createClient()

  // 1. Ambil informasi kelas
  const { data: classData } = await supabase
    .from('classes')
    .select('id, name, referral_code')
    .eq('id', classId)
    .maybeSingle()

  if (!classData) {
    redirect('/teacher')
  }

  // 2. Verifikasi penugasan guru di kelas ini dan ambil daftar mapel yang diajarkan
  const { data: teacherAssignments } = await supabase
    .from('teacher_assignments')
    .select('subject_id, subjects (id, name)')
    .eq('teacher_id', profile.id)
    .eq('class_id', classId)

  if (!teacherAssignments || teacherAssignments.length === 0) {
    redirect('/teacher')
  }

  const taughtSubjects = teacherAssignments
    .map((ta: any) => ({
      id: ta.subject_id,
      name: ta.subjects?.name ?? 'Mata Pelajaran',
    }))
    .filter((s, idx, arr) => arr.findIndex((item) => item.id === s.id) === idx)

  const subjectIds = taughtSubjects.map((s) => s.id)

  // 3. Hitung total siswa terdaftar di kelas ini
  const { count: totalStudents } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId)

  // 4. Ambil daftar materi di kelas ini (untuk opsi kaitkan ke materi)
  const { data: rawModules } = await supabase
    .from('modules')
    .select(`
      id,
      title,
      subject_id,
      materials (
        id,
        title,
        order_index
      )
    `)
    .eq('class_id', classId)
    .in('subject_id', subjectIds)
    .order('order_index', { ascending: true })

  const materialsOptions: { id: string; title: string; subject_id: string; module_title: string }[] = []
  ;(rawModules ?? []).forEach((mod: any) => {
    ;(mod.materials ?? []).forEach((mat: any) => {
      materialsOptions.push({
        id: mat.id,
        title: mat.title,
        subject_id: mod.subject_id,
        module_title: mod.title,
      })
    })
  })

  // 5. Ambil daftar tugas di kelas ini (pada mapel yang diajarkan guru ini)
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      id,
      class_id,
      subject_id,
      material_id,
      title,
      description,
      submission_type,
      open_at,
      due_at,
      close_at,
      allow_late,
      late_penalty_percent,
      max_score,
      created_at,
      subjects:subject_id (id, name),
      materials:material_id (id, title),
      submissions (id, score)
    `)
    .eq('class_id', classId)
    .in('subject_id', subjectIds)
    .order('created_at', { ascending: false })

  const formattedAssignments = (assignments ?? []).map((a: any) => {
    const subs = a.submissions ?? []
    const graded = subs.filter((s: any) => s.score !== null && s.score !== undefined)

    return {
      ...a,
      submissions_count: subs.length,
      graded_count: graded.length,
      total_students: totalStudents ?? 0,
    }
  })

  return (
    <TeacherClassAssignments
      classId={classId}
      classNameStr={classData.name}
      taughtSubjects={taughtSubjects}
      materials={materialsOptions}
      assignments={formattedAssignments}
    />
  )
}
