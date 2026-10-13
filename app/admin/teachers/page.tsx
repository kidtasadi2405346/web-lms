import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TeachersManager } from './teachers-manager'

export default async function TeachersPage() {
  await requireRole('admin')
  const supabase = await createClient()

  // Ambil semua guru beserta jumlah penugasan
  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, name, identity_number, created_at, teacher_assignments(count)')
    .eq('role', 'teacher')
    .order('name', { ascending: true })

  const formattedTeachers = (teachers ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    identity_number: t.identity_number,
    created_at: t.created_at,
    assignment_count: t.teacher_assignments?.[0]?.count ?? 0,
  }))

  return <TeachersManager initialTeachers={formattedTeachers} />
}
