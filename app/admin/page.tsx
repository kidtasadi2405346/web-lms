import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function AdminHome() {
  const profile = await requireRole('admin')
  const supabase = await createClient()

  const count = { count: 'exact', head: true } as const
  const [classes, subjects, teachers, students] = await Promise.all([
    supabase.from('classes').select('*', count),
    supabase.from('subjects').select('*', count),
    supabase.from('profiles').select('*', count).eq('role', 'teacher'),
    supabase.from('profiles').select('*', count).eq('role', 'student'),
  ])

  const stats = [
    { label: 'Kelas', value: classes.count ?? 0 },
    { label: 'Mata pelajaran', value: subjects.count ?? 0 },
    { label: 'Guru', value: teachers.count ?? 0 },
    { label: 'Siswa', value: students.count ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {profile.name}</h1>
        <p className="text-muted-foreground">Ringkasan data sekolah. Pengelolaan kelas, mapel, dan penugasan menyusul di tahap berikutnya.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  )
}
