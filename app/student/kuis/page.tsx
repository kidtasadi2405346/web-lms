import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, HelpCircle, CheckCircle2, ChevronRight, Lock, AlertTriangle, FileQuestion } from 'lucide-react'
import { formatDateTimeWib } from '@/lib/assignment-utils'

export default async function StudentClassQuizzesPage() {
  const profile = await requireRole('student')
  const supabase = await createClient()

  // 1. Ambil pendaftaran kelas siswa
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('class_id, classes:class_id (name)')
    .eq('student_id', profile.id)
    .maybeSingle()

  if (!enrollment) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Kuis & Penilaian Kelas</h1>
        <p className="text-sm text-muted-foreground">Anda belum terdaftar di kelas manapun.</p>
      </div>
    )
  }

  const classId = enrollment.class_id
  const className = (enrollment.classes as any)?.name ?? 'Kelas'

  // 2. Ambil seluruh kuis di kelas ini (baik chapter maupun assessment)
  const [
    { data: quizzes },
    { data: myAttempts },
    { data: myProgress },
  ] = await Promise.all([
    supabase
      .from('quizzes')
      .select(`
        id,
        module_id,
        class_id,
        subject_id,
        type,
        title,
        description,
        passing_score,
        open_at,
        due_at,
        close_at,
        allow_late,
        max_attempts,
        order_index,
        subjects:subject_id (id, name),
        modules:module_id (
          id,
          title,
          subjects:subject_id (name)
        ),
        questions (id)
      `)
      .or(`class_id.eq.${classId},module_id.not.is.null`)
      .order('created_at', { ascending: false }),
    supabase
      .from('quiz_attempts')
      .select('id, quiz_id, score, passed, attempted_at, is_late')
      .eq('student_id', profile.id),
    supabase
      .from('student_progress')
      .select('quiz_id, highest_score, is_passed')
      .eq('student_id', profile.id),
  ])

  const now = new Date()

  // Petakan attempts per kuis
  const attemptsMap = new Map<string, any[]>()
  ;(myAttempts ?? []).forEach((att: any) => {
    const list = attemptsMap.get(att.quiz_id) || []
    list.push(att)
    attemptsMap.set(att.quiz_id, list)
  })

  // Petakan progress per kuis (untuk kuis bab)
  const progressMap = new Map<string, any>()
  ;(myProgress ?? []).forEach((p: any) => {
    progressMap.set(p.quiz_id, p)
  })

  // Proses setiap kuis
  const processedQuizzes = (quizzes ?? []).map((qz: any) => {
    const isAssessment = qz.type === 'assessment'
    const subjectName =
      qz.subjects?.name || qz.modules?.subjects?.name || 'Mata Pelajaran'
    const atts = attemptsMap.get(qz.id) || []
    const attemptsCount = atts.length
    const highestScore = atts.length > 0 ? Math.max(...atts.map((a: any) => Number(a.score))) : null
    const isPassed = atts.some((a: any) => Boolean(a.passed))
    const maxAtt = isAssessment ? qz.max_attempts || 1 : null

    let status: 'belum_dibuka' | 'terbuka' | 'ditutup' | 'sudah_dikerjakan' = 'terbuka'
    let statusLabel = 'Terbuka'
    let canTake = true

    if (isAssessment) {
      if (attemptsCount >= (maxAtt || 1) || isPassed) {
        status = 'sudah_dikerjakan'
        statusLabel = 'Sudah Dikerjakan'
        canTake = false
      } else if (qz.open_at && now < new Date(qz.open_at)) {
        status = 'belum_dibuka'
        statusLabel = 'Belum Dibuka'
        canTake = false
      } else if (
        (qz.close_at && now > new Date(qz.close_at)) ||
        (!qz.allow_late && qz.due_at && now > new Date(qz.due_at))
      ) {
        status = 'ditutup'
        statusLabel = 'Ditutup'
        canTake = false
      }
    } else {
      // Kuis Bab
      const p = progressMap.get(qz.id)
      if (p?.is_passed) {
        status = 'sudah_dikerjakan'
        statusLabel = 'Lulus ✓'
      } else if (attemptsCount > 0) {
        status = 'terbuka'
        statusLabel = 'Perlu Remedial'
      } else {
        status = 'terbuka'
        statusLabel = 'Siap Dikerjakan'
      }
    }

    return {
      ...qz,
      isAssessment,
      subjectName,
      attemptsCount,
      highestScore,
      isPassed,
      maxAtt,
      status,
      statusLabel,
      canTake,
    }
  })

  const assessmentQuizzes = processedQuizzes.filter((q) => q.isAssessment)
  const chapterQuizzes = processedQuizzes.filter((q) => !q.isAssessment)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kuis & Penilaian Kelas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Daftar evaluasi kuis penilaian ujian dan kuis bab pembelajaran di Kelas {className}.
        </p>
      </div>

      {/* Bagian 1: Kuis Penilaian (Ujian / Evaluasi Terjadwal) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
            <Clock className="h-4 w-4 text-purple-600" />
            Kuis Penilaian (Ujian & Jadwal Evaluasi)
          </h2>
          <span className="text-xs text-muted-foreground">{assessmentQuizzes.length} Kuis</span>
        </div>

        {assessmentQuizzes.length === 0 ? (
          <Card className="border-dashed p-6 text-center text-xs text-muted-foreground">
            Belum ada kuis penilaian terjadwal di kelas ini.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {assessmentQuizzes.map((qz) => {
              const statusBadgeVariant =
                qz.status === 'sudah_dikerjakan'
                  ? 'secondary'
                  : qz.status === 'ditutup'
                  ? 'destructive'
                  : qz.status === 'belum_dibuka'
                  ? 'outline'
                  : 'default'

              const statusBadgeClass =
                qz.status === 'sudah_dikerjakan'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : qz.status === 'belum_dibuka'
                  ? 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/5'
                  : qz.status === 'terbuka'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : ''

              return (
                <Card
                  key={qz.id}
                  className={`overflow-hidden transition-all flex flex-col justify-between ${
                    qz.status === 'terbuka'
                      ? 'border-purple-500/40 shadow-sm'
                      : qz.status === 'belum_dibuka'
                      ? 'opacity-85 border-amber-500/30 bg-amber-500/[0.02]'
                      : qz.status === 'ditutup'
                      ? 'opacity-70 bg-muted/20'
                      : 'border-emerald-500/30'
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        {qz.subjectName}
                      </span>
                      <Badge variant={statusBadgeVariant} className={`text-[10px] ${statusBadgeClass}`}>
                        {qz.statusLabel}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold mt-1">{qz.title}</CardTitle>
                    {qz.description && (
                      <CardDescription className="text-xs line-clamp-2">{qz.description}</CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="text-xs text-muted-foreground space-y-1 rounded-lg bg-muted/30 p-2.5">
                      {qz.open_at && (
                        <p className="flex items-center justify-between">
                          <span>Waktu Dibuka:</span>
                          <span className="font-medium text-foreground">{formatDateTimeWib(qz.open_at)}</span>
                        </p>
                      )}
                      {qz.due_at && (
                        <p className="flex items-center justify-between">
                          <span>Tenggat Waktu:</span>
                          <span className="font-medium text-foreground">{formatDateTimeWib(qz.due_at)}</span>
                        </p>
                      )}
                      {qz.close_at && (
                        <p className="flex items-center justify-between">
                          <span>Batas Akhir:</span>
                          <span className="font-medium text-foreground">{formatDateTimeWib(qz.close_at)}</span>
                        </p>
                      )}
                      <p className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span>KKM & Percobaan:</span>
                        <span className="font-medium text-foreground">
                          KKM: {qz.passing_score}% • Batas: {qz.attemptsCount}/{qz.maxAtt || 1}x
                        </span>
                      </p>
                      {qz.highestScore !== null && (
                        <p className="flex items-center justify-between text-emerald-600 font-semibold pt-1">
                          <span>Nilai Terbaik:</span>
                          <span>{qz.highestScore}% {qz.isPassed ? '(Lulus ✓)' : ''}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      {qz.canTake ? (
                        <Link href={`/student/kuis/${qz.id}`} className="w-full">
                          <Button className="w-full gap-1.5 text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white">
                            Mulai Kuis <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : qz.status === 'sudah_dikerjakan' ? (
                        <Link href={`/student/kuis/${qz.id}`} className="w-full">
                          <Button variant="outline" className="w-full gap-1.5 text-xs h-8">
                            Lihat Nilai & Hasil <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : qz.status === 'belum_dibuka' ? (
                        <Button disabled variant="outline" className="w-full text-xs h-8 opacity-60">
                          Kuis Belum Dibuka
                        </Button>
                      ) : (
                        <Button disabled variant="ghost" className="w-full text-xs h-8 opacity-60">
                          Kuis Telah Ditutup
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Bagian 2: Kuis Bab Modul */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
            <FileQuestion className="h-4 w-4 text-primary" />
            Kuis Bab (Prasyarat Materi Modul)
          </h2>
          <span className="text-xs text-muted-foreground">{chapterQuizzes.length} Kuis</span>
        </div>

        {chapterQuizzes.length === 0 ? (
          <Card className="border-dashed p-6 text-center text-xs text-muted-foreground">
            Belum ada kuis bab di modul pembelajaran.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {chapterQuizzes.map((qz) => (
              <Card key={qz.id} className="overflow-hidden flex flex-col justify-between">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider">
                      {qz.subjectName}
                    </span>
                    <Badge variant={qz.isPassed ? 'secondary' : 'outline'} className="text-[10px]">
                      {qz.statusLabel}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold mt-1">{qz.title}</CardTitle>
                  <CardDescription className="text-xs">
                    Modul: {qz.modules?.title ?? 'Modul Bab'} • KKM: {qz.passing_score}%
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-2.5">
                  {qz.due_at && (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Disarankan selesai sebelum {formatDateTimeWib(qz.due_at)}
                    </p>
                  )}
                  {qz.highestScore !== null && (
                    <p className="text-xs text-emerald-600 font-semibold">
                      Nilai Tertinggi: {qz.highestScore}%
                    </p>
                  )}

                  <div className="flex justify-end pt-1">
                    <Link href={`/student/kuis/${qz.id}`} className="w-full">
                      <Button variant="outline" className="w-full gap-1.5 text-xs h-8">
                        {qz.isPassed ? 'Lihat / Remedial' : 'Kerjakan Kuis'}{' '}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
