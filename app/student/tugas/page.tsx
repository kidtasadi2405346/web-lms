import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { StudentAssignmentsList } from './student-assignments-list'
import { Card, CardContent } from '@/components/ui/card'
import { FileText } from 'lucide-react'

export default async function StudentAssignmentsPage() {
  const profile = await requireRole('student')
  const supabase = await createClient()

  // 1. Ambil pendaftaran kelas siswa
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('class_id, classes (id, name)')
    .eq('student_id', profile.id)
    .maybeSingle()

  if (!enrollment?.class_id) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tugas & Penugasan</h1>
          <p className="text-sm text-muted-foreground">Anda belum terdaftar di kelas manapun.</p>
        </div>
        <Card className="border-dashed text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Silakan hubungi administrator sekolah untuk didaftarkan ke dalam kelas.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const classId = enrollment.class_id
  const classNameStr = (enrollment.classes as any)?.name ?? 'Kelas'

  // 2. Query assignments kelas ini, submissions milik siswa, dan perpanjangan siswa
  const [
    { data: rawAssignments },
    { data: mySubmissions },
    { data: myExtensions },
  ] = await Promise.all([
    supabase
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
      .eq('class_id', classId)
      .order('due_at', { ascending: true }),
    supabase
      .from('submissions')
      .select('*')
      .eq('student_id', profile.id),
    supabase
      .from('assignment_extensions')
      .select('*')
      .eq('student_id', profile.id),
  ])

  const submissionsMap = new Map<string, any>()
  ;(mySubmissions ?? []).forEach((s: any) => {
    submissionsMap.set(s.assignment_id, s)
  })

  const extensionsMap = new Map<string, any>()
  ;(myExtensions ?? []).forEach((ext: any) => {
    extensionsMap.set(ext.assignment_id, ext)
  })

  const assignments = (rawAssignments ?? []).map((a: any) => ({
    ...a,
    userSubmission: submissionsMap.get(a.id) ?? null,
    userExtension: extensionsMap.get(a.id) ?? null,
  }))

  return (
    <StudentAssignmentsList
      assignments={assignments}
      classNameStr={classNameStr}
    />
  )
}
