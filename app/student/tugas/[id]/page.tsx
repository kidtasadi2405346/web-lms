import { notFound, redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { StudentAssignmentDetail } from './student-assignment-detail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StudentAssignmentDetailPage({ params }: PageProps) {
  const profile = await requireRole('student')
  const { id: assignmentId } = await params
  const supabase = await createClient()

  // 1. Ambil pendaftaran kelas siswa
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', profile.id)
    .maybeSingle()

  if (!enrollment?.class_id) {
    redirect('/student')
  }

  // 2. Ambil detail tugas
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
      subjects:subject_id (id, name),
      materials:material_id (
        id,
        title,
        simulations (id, title)
      )
    `)
    .eq('id', assignmentId)
    .eq('class_id', enrollment.class_id)
    .maybeSingle()

  if (!assignment) {
    notFound()
  }

  // 3. Ambil submission siswa dan perpanjangan khusus siswa
  const [{ data: submission }, { data: extension }] = await Promise.all([
    supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', profile.id)
      .maybeSingle(),
    supabase
      .from('assignment_extensions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', profile.id)
      .maybeSingle(),
  ])

  return (
    <StudentAssignmentDetail
      assignment={assignment as any}
      submission={submission as any}
      extension={extension as any}
      studentProfile={profile}
    />
  )
}
