import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ClassesManager } from './classes-manager'

export default async function ClassesPage() {
  await requireRole('admin')
  const supabase = await createClient()

  // Ambil semua kelas beserta jumlah siswa terdaftar
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, referral_code, created_at, enrollments(count)')
    .order('created_at', { ascending: false })

  const formattedClasses = (classes ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    referral_code: c.referral_code,
    created_at: c.created_at,
    student_count: c.enrollments?.[0]?.count ?? 0,
  }))

  return <ClassesManager initialClasses={formattedClasses} />
}
