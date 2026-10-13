import { notFound, redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TeacherAssignmentGrading, type StudentRowData } from './teacher-assignment-grading'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TeacherAssignmentGradingPage({ params }: PageProps) {
  const profile = await requireRole('teacher')
  const { id: assignmentId } = await params
  const supabase = await createClient()

  // 1. Ambil detail tugas
  const { data: assignment } = await supabase
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
      classes:class_id (id, name),
      subjects:subject_id (id, name),
      materials:material_id (id, title)
    `)
    .eq('id', assignmentId)
    .maybeSingle()

  if (!assignment) {
    notFound()
  }

  // 2. Verifikasi bahwa guru ini mengajar di kelas & mapel tugas ini
  const { data: teacherAssignment } = await supabase
    .from('teacher_assignments')
    .select('id')
    .eq('teacher_id', profile.id)
    .eq('class_id', assignment.class_id)
    .eq('subject_id', assignment.subject_id)
    .maybeSingle()

  if (!teacherAssignment) {
    // Bukan guru pengampu tugas ini
    redirect('/teacher')
  }

  // 3. Ambil semua siswa yang terdaftar di kelas ini
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      student_id,
      student:student_id (
        id,
        name,
        role,
        identity_number
      )
    `)
    .eq('class_id', assignment.class_id)

  const enrolledStudents = (enrollments ?? [])
    .map((e: any) => e.student)
    .filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  // 4. Ambil semua submission pada tugas ini
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)

  const submissionsMap = new Map<string, any>()
  ;(submissions ?? []).forEach((s: any) => {
    submissionsMap.set(s.student_id, s)
  })

  // 5. Ambil semua perpanjangan deadline pada tugas ini
  const { data: extensions } = await supabase
    .from('assignment_extensions')
    .select('*')
    .eq('assignment_id', assignmentId)

  const extensionsMap = new Map<string, any>()
  ;(extensions ?? []).forEach((ext: any) => {
    extensionsMap.set(ext.student_id, ext)
  })

  // Gabungkan baris data per siswa
  const studentsData: StudentRowData[] = enrolledStudents.map((std: any) => ({
    student: std,
    submission: submissionsMap.get(std.id) ?? null,
    extension: extensionsMap.get(std.id) ?? null,
  }))

  return (
    <TeacherAssignmentGrading
      assignment={assignment as any}
      studentsData={studentsData}
    />
  )
}
