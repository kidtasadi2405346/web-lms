'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, ChevronRight, FileText, HelpCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTimeId, formatTimeRemaining } from '@/lib/assignment-utils'

export type UpcomingAssignmentItem = {
  id: string
  title: string
  subject_name: string
  effective_due_at: string
  is_urgent: boolean
  time_remaining_text: string
  submission_type: string
}

export type StudentQuizStatus = 'belum_dibuka' | 'terbuka' | 'ditutup' | 'sudah_dikerjakan'

export type ActiveQuizItem = {
  id: string
  title: string
  type: 'chapter' | 'assessment'
  module_title?: string
  subject_name: string
  passing_score: number
  total_questions: number
  status: StudentQuizStatus
  status_label: string
  open_at?: string | null
  due_at?: string | null
  close_at?: string | null
  max_attempts?: number | null
  attempts_count: number
  highest_score?: number | null
  is_passed?: boolean
  can_take: boolean
}

interface UpcomingTasksProps {
  assignments: UpcomingAssignmentItem[]
  quizzes: ActiveQuizItem[]
}

export function UpcomingTasksBlock({ assignments, quizzes }: UpcomingTasksProps) {
  const hasItems = assignments.length > 0 || quizzes.length > 0

  return (
    <Card className="border-primary/20 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Tugas Mendatang & Penilaian Aktif
          </CardTitle>
          <div className="flex items-center gap-2">
            <Link href="/student/kuis">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                Semua Kuis <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
            <Link href="/student/tugas">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                Semua Tugas <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {!hasItems ? (
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Tidak ada tugas atau kuis yang perlu dikumpulkan saat ini. Pertahankan prestasimu!</span>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {/* Tugas Mendatang */}
            {assignments.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border transition-all hover:shadow-sm flex flex-col justify-between gap-2.5 ${
                  item.is_urgent
                    ? 'border-amber-500/60 bg-amber-500/[0.04] dark:bg-amber-950/20'
                    : 'border-border/80 bg-background/50 hover:border-primary/40'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider">
                      {item.subject_name}
                    </span>
                    <Badge
                      variant={item.is_urgent ? 'destructive' : 'outline'}
                      className={`text-[10px] gap-1 px-1.5 py-0 ${
                        item.is_urgent ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse' : ''
                      }`}
                    >
                      {item.is_urgent && <AlertTriangle className="h-2.5 w-2.5" />}
                      {item.time_remaining_text}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground line-clamp-1">{item.title}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Tenggat: {formatDateTimeId(item.effective_due_at)} WIB
                  </p>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Tugas Kelas
                  </span>
                  <Link href={`/student/tugas/${item.id}`}>
                    <Button size="sm" variant={item.is_urgent ? 'default' : 'outline'} className="h-6 text-[11px] px-2.5 gap-1">
                      Kerjakan <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}

            {/* Kuis Penilaian & Kuis Aktif */}
            {quizzes.map((qz) => {
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
                <div
                  key={qz.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all hover:shadow-sm ${
                    qz.status === 'terbuka'
                      ? 'border-purple-500/40 bg-purple-500/[0.03] hover:border-purple-500/60'
                      : qz.status === 'belum_dibuka'
                      ? 'border-amber-500/30 bg-amber-500/[0.02] opacity-85'
                      : qz.status === 'ditutup'
                      ? 'border-border/60 bg-muted/20 opacity-70'
                      : 'border-emerald-500/30 bg-emerald-500/[0.02]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        {qz.subject_name}
                      </span>
                      <Badge
                        variant={statusBadgeVariant}
                        className={`text-[10px] px-1.5 py-0 font-medium ${statusBadgeClass}`}
                      >
                        {qz.status_label}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-semibold text-foreground line-clamp-1">{qz.title}</h4>

                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      {qz.due_at && (
                        <p className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {qz.type === 'chapter' ? 'Target: ' : 'Tenggat: '}
                            {formatDateTimeId(qz.due_at)} WIB
                          </span>
                        </p>
                      )}
                      {qz.open_at && qz.status === 'belum_dibuka' && (
                        <p className="text-amber-600 dark:text-amber-400">
                          Dibuka pada: {formatDateTimeId(qz.open_at)} WIB
                        </p>
                      )}
                      {qz.highest_score !== null && qz.highest_score !== undefined && (
                        <p className="font-medium text-emerald-600 dark:text-emerald-400">
                          Skor Anda: {qz.highest_score}% {qz.is_passed ? '(Lulus ✓)' : '(Belum Lulus)'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" />
                      {qz.type === 'assessment' ? 'Kuis Penilaian' : 'Kuis Bab'}
                      {qz.max_attempts ? ` • ${qz.attempts_count}/${qz.max_attempts}x` : ''}
                    </span>

                    {qz.can_take ? (
                      <Link href={`/student/kuis/${qz.id}`}>
                        <Button
                          size="sm"
                          className="h-6 text-[11px] px-2.5 gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Mulai Kuis <ChevronRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    ) : qz.status === 'sudah_dikerjakan' ? (
                      <Link href={`/student/kuis/${qz.id}`}>
                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2.5 gap-1">
                          Lihat Hasil <ChevronRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    ) : qz.status === 'belum_dibuka' ? (
                      <Button size="sm" variant="outline" disabled className="h-6 text-[11px] px-2.5 opacity-60">
                        Belum Dibuka
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled className="h-6 text-[11px] px-2.5 opacity-60">
                        Kuis Ditutup
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
