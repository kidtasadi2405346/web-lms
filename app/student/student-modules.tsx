'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileQuestion,
  FileText,
  Lock,
  PlayCircle,
  RotateCcw,
  Trophy,
  Video,
  Clock,
} from 'lucide-react'
import { formatDateTimeId } from '@/lib/assignment-utils'

export type MaterialSummary = {
  id: string
  title: string
  order_index: number
  has_video?: boolean
  has_content?: boolean
  has_simulation?: boolean
  is_completed: boolean
  is_unlocked: boolean
}

export type QuizSummary = {
  id: string
  title: string
  description?: string | null
  passing_score: number
  total_questions: number
  is_unlocked: boolean
  is_passed: boolean
  last_score?: number | null
  due_at?: string | null
}

export type ModuleSummary = {
  id: string
  title: string
  description?: string | null
  order_index: number
  subject_name: string
  materials: MaterialSummary[]
  quizzes?: QuizSummary[]
}

interface StudentModulesProps {
  className: string
  referralCode: string
  modules: ModuleSummary[]
}

export function StudentModulesDashboard({ className, referralCode, modules }: StudentModulesProps) {
  // Hitung total statistik progres keseluruhan (materi + kuis)
  const totalMaterials = modules.reduce((acc, m) => acc + m.materials.length, 0)
  const completedMaterials = modules.reduce(
    (acc, m) => acc + m.materials.filter((mat) => mat.is_completed).length,
    0,
  )

  const totalQuizzes = modules.reduce((acc, m) => acc + (m.quizzes?.length || 0), 0)
  const passedQuizzes = modules.reduce(
    (acc, m) => acc + (m.quizzes?.filter((qz) => qz.is_passed).length || 0),
    0,
  )

  const grandTotal = totalMaterials + totalQuizzes
  const grandCompleted = completedMaterials + passedQuizzes
  const overallPercentage = grandTotal > 0 ? Math.round((grandCompleted / grandTotal) * 100) : 0

  // Filter per mata pelajaran
  const searchParams = useSearchParams()
  const router = useRouter()
  const subjectParam = searchParams.get('subject')

  const subjects = Array.from(new Set(modules.map((m) => m.subject_name)))
  const activeSubject = subjectParam && subjects.includes(subjectParam) ? subjectParam : 'all'

  const filteredModules =
    activeSubject === 'all' ? modules : modules.filter((m) => m.subject_name === activeSubject)

  const handleSelectSubject = (sub: string) => {
    if (sub === 'all') {
      router.push('/student', { scroll: false })
    } else {
      router.push(`/student?subject=${encodeURIComponent(sub)}`, { scroll: false })
    }
  }

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Progres Siswa */}
      <Card className="relative overflow-hidden border border-border/80 bg-gradient-to-br from-card via-card to-primary/10 shadow-sm">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <CardHeader className="pb-3 relative z-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/5">
                  {referralCode}
                </Badge>
                <Badge variant="secondary" className="text-xs font-semibold">
                  Kelas {className}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Progres Belajar Anda</CardTitle>
              <CardDescription className="text-sm text-muted-foreground/90 max-w-xl">
                Pelajari materi dan selesaikan evaluasi bab secara berurutan untuk membuka modul lanjutan.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 self-start sm:self-center rounded-2xl border border-primary/20 bg-background/60 p-3 backdrop-blur-xs shadow-xs">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-foreground tracking-tight">{overallPercentage}%</p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {completedMaterials}/{totalMaterials} Materi • {passedQuizzes}/{totalQuizzes} Kuis
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-1 relative z-10">
          <div className="space-y-2">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/80 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-all duration-700 ease-out"
                style={{ width: `${overallPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {grandCompleted} aktivitas tuntas
              </span>
              <span>{grandTotal - grandCompleted} aktivitas tersisa</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Mata Pelajaran (Khusus Mobile karena panel sidebar kiri tersembunyi di layar kecil) */}
      {subjects.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Mata Pelajaran:</span>
          <Button
            size="sm"
            variant={activeSubject === 'all' ? 'default' : 'outline'}
            className="h-8 text-xs shrink-0"
            onClick={() => handleSelectSubject('all')}
          >
            Semua ({modules.length})
          </Button>
          {subjects.map((sub) => {
            const count = modules.filter((m) => m.subject_name === sub).length
            return (
              <Button
                key={sub}
                size="sm"
                variant={activeSubject === sub ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0"
                onClick={() => handleSelectSubject(sub)}
              >
                {sub} ({count})
              </Button>
            )
          })}
        </div>
      )}

      {/* Daftar Modul Pembelajaran */}
      {filteredModules.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-2">Belum ada modul pelajaran</CardTitle>
            <CardDescription>
              Guru belum mengunggah modul atau materi untuk kelas Anda.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredModules.map((m, mIdx) => {
            const modTotal = m.materials.length + (m.quizzes?.length || 0)
            const modCompleted =
              m.materials.filter((mat) => mat.is_completed).length +
              (m.quizzes?.filter((qz) => qz.is_passed).length || 0)
            const modPercentage = modTotal > 0 ? Math.round((modCompleted / modTotal) * 100) : 0

            return (
              <Card key={m.id} className="overflow-hidden border shadow-sm">
                <CardHeader className="bg-muted/20 pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Bab {mIdx + 1}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {m.subject_name}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg font-semibold">{m.title}</CardTitle>
                      {m.description && (
                        <CardDescription className="text-sm">{m.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 self-start sm:self-auto">
                      <span className="text-xs font-semibold text-foreground">
                        {modCompleted}/{modTotal} Tuntas ({modPercentage}%)
                      </span>
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${modPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-5">
                  {/* Bagian Materi */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                      Materi Pembelajaran ({m.materials.length})
                    </h4>

                    {m.materials.length === 0 ? (
                      <p className="text-xs italic text-muted-foreground">Belum ada materi di bab ini.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {m.materials.map((mat, matIdx) => {
                          const isUnlocked = mat.is_unlocked
                          const isDone = mat.is_completed

                          if (!isUnlocked) {
                            return (
                              <div
                                key={mat.id}
                                className="flex items-center justify-between rounded-lg border border-dashed bg-muted/40 p-3.5 opacity-75"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                    <Lock className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-muted-foreground">{mat.title}</p>
                                      <Badge variant="outline" className="border-muted-foreground/30 text-[10px] text-muted-foreground">
                                        Terkunci
                                      </Badge>
                                      {mat.has_simulation && (
                                        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] gap-1">
                                          <Cpu className="h-2.5 w-2.5" /> Simulasi
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground/80 mt-0.5">
                                      Selesaikan materi/kuis sebelumnya terlebih dahulu untuk membuka.
                                    </p>
                                  </div>
                                </div>
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                              </div>
                            )
                          }

                          return (
                            <Link
                              key={mat.id}
                              href={`/student/materi/${mat.id}`}
                              className="group flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/30 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-start gap-3.5">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-transform duration-200 group-hover:scale-105 ${
                                    isDone
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                                      : 'bg-primary/10 text-primary shadow-2xs'
                                  }`}
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                  ) : mat.has_video ? (
                                    <PlayCircle className="h-5 w-5" />
                                  ) : (
                                    matIdx + 1
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                      {mat.title}
                                    </p>
                                    {isDone && (
                                      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
                                        Selesai ✓
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                                    {mat.has_simulation && (
                                      <span className="flex items-center gap-1 text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-md">
                                        <Cpu className="h-3 w-3" /> Simulasi Interaktif
                                      </span>
                                    )}
                                    {mat.has_video && (
                                      <span className="flex items-center gap-1 text-primary/90 font-medium">
                                        <Video className="h-3 w-3" /> Video
                                      </span>
                                    )}
                                    {mat.has_content && (
                                      <span className="flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Bacaan
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-auto text-primary">
                                <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                  Buka Materi
                                </span>
                                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bagian Kuis Evaluasi Bab */}
                  {m.quizzes && m.quizzes.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <FileQuestion className="h-3.5 w-3.5 text-primary" />
                        Kuis Evaluasi Bab ({m.quizzes.length})
                      </h4>

                      <div className="space-y-2.5">
                        {m.quizzes.map((qz) => {
                          const isUnlocked = qz.is_unlocked
                          const isPassed = qz.is_passed
                          const hasAttempt = qz.last_score !== null && qz.last_score !== undefined

                          if (!isUnlocked) {
                            return (
                              <div
                                key={qz.id}
                                className="flex items-center justify-between rounded-lg border border-dashed bg-muted/40 p-3.5 opacity-75"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                    <Lock className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-muted-foreground">{qz.title}</p>
                                      <Badge variant="outline" className="border-muted-foreground/30 text-[10px] text-muted-foreground">
                                        Kuis Terkunci
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground/80 mt-0.5">
                                      Selesaikan seluruh materi di bab ini terlebih dahulu untuk membuka kuis.
                                    </p>
                                  </div>
                                </div>
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                              </div>
                            )
                          }

                          return (
                            <Link
                              key={qz.id}
                              href={`/student/kuis/${qz.id}`}
                              className={`group flex flex-col gap-3 rounded-lg border p-3.5 transition-all hover:shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                                isPassed
                                  ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60'
                                  : hasAttempt
                                  ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60'
                                  : 'border-primary/20 bg-primary/5 hover:border-primary/50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                                    isPassed
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : hasAttempt
                                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                      : 'bg-primary/10 text-primary'
                                  }`}
                                >
                                  {isPassed ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : hasAttempt ? (
                                    <RotateCcw className="h-4 w-4" />
                                  ) : (
                                    <FileQuestion className="h-4 w-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                      {qz.title}
                                    </p>
                                    {isPassed ? (
                                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                        Lulus ✓ (Skor: {qz.last_score})
                                      </Badge>
                                    ) : hasAttempt ? (
                                      <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 text-[10px]">
                                        Perlu Remedial (Skor: {qz.last_score})
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Siap Dikerjakan
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    KKM: {qz.passing_score}% • {qz.total_questions} Soal Pilihan Ganda
                                  </p>
                                  {qz.due_at && (
                                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Disarankan selesai sebelum {formatDateTimeId(qz.due_at)} WIB
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <Button
                                  size="sm"
                                  variant={isPassed ? 'outline' : 'default'}
                                  className="h-8 text-xs gap-1"
                                >
                                  {isPassed ? 'Lihat / Ulangi' : hasAttempt ? 'Remedial Sekarang' : 'Kerjakan Kuis'}
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
