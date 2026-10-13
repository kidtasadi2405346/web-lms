import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { SubjectsManager } from './subjects-manager'

export default async function SubjectsPage() {
  await requireRole('admin')
  const supabase = await createClient()

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, created_at')
    .order('name', { ascending: true })

  return <SubjectsManager initialSubjects={subjects ?? []} />
}
