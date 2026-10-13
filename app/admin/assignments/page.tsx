import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AssignmentsManager } from './assignments-manager'

export default async function AssignmentsPage() {
  await requireRole('admin')
  const supabase = await createClient()

  // Ambil penugasan guru yang sudah ada
  const { data: assignments } = await supabase
    .from('teacher_assignments')
    .select(`
      id,
      teacher_id,
      subject_id,
      class_id,
      profiles:teacher_id (name, identity_number),
      subjects:subject_id (name),
      classes:class_id (name, referral_code)
    `)
    .order('created_at', { ascending: false })

  // Ambil master data guru, mapel, dan kelas untuk dropdown pilihan
  const [teachersRes, subjectsRes, classesRes] = await Promise.all([
    supabase.from('profiles').select('id, name, identity_number').eq('role', 'teacher').order('name'),
    supabase.from('subjects').select('id, name').order('name'),
    supabase.from('classes').select('id, name, referral_code').order('name'),
  ])

  const formattedAssignments = (assignments ?? []).map((a: any) => ({
    id: a.id,
    teacher_id: a.teacher_id,
    teacher_name: a.profiles?.name ?? 'Guru Tidak Ditemukan',
    teacher_nip: a.profiles?.identity_number ?? '-',
    subject_id: a.subject_id,
    subject_name: a.subjects?.name ?? 'Mapel Tidak Ditemukan',
    class_id: a.class_id,
    class_name: a.classes?.name ?? 'Kelas Tidak Ditemukan',
    referral_code: a.classes?.referral_code ?? '-',
  }))

  const teachers = (teachersRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    extra: t.identity_number,
  }))

  const subjects = (subjectsRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
  }))

  const classes = (classesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    extra: c.referral_code,
  }))

  return (
    <AssignmentsManager
      initialAssignments={formattedAssignments}
      teachers={teachers}
      subjects={subjects}
      classes={classes}
    />
  )
}
