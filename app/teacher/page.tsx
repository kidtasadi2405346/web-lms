import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, ChevronRight, School } from 'lucide-react'

type Assignment = {
  id: string
  class_id: string
  subject_id: string
  subjects: { name: string } | null
  classes: { name: string; referral_code: string } | null
}

export default async function TeacherHome() {
  const profile = await requireRole('teacher')
  const supabase = await createClient()

  const { data } = await supabase
    .from('teacher_assignments')
    .select('id, class_id, subject_id, subjects(name), classes(name, referral_code)')
    .eq('teacher_id', profile.id)

  const assignments = (data ?? []) as unknown as Assignment[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {profile.name}</h1>
        <p className="text-muted-foreground">Kelas dan mata pelajaran yang Anda ampu.</p>
      </div>

      {assignments.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <School className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-2">Belum ada penugasan</CardTitle>
            <CardDescription>
              Minta admin sekolah untuk menugaskan Anda ke kelas dan mata pelajaran.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <Card key={a.id} className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{a.subjects?.name ?? 'Mata Pelajaran'}</CardTitle>
                    <CardDescription className="text-xs">
                      Kelas {a.classes?.name ?? '-'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between border-t pt-3 mt-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    Kode: {a.classes?.referral_code ?? '-'}
                  </span>
                  <Link href={`/teacher/kelas/${a.class_id}?subject=${a.subject_id}`}>
                    <Button size="sm" variant="outline" className="gap-1 text-xs group-hover:bg-primary group-hover:text-primary-foreground">
                      Kelola Modul & Materi <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
