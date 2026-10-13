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

export type ActiveQuizItem = {
  id: string
  title: string
  module_title: string
  subject_name: string
  passing_score: number
  total_questions: number
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
          <Link href="/student/tugas">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
              Lihat Semua Tugas <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </Link>
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
                    Tenggat: {formatDateTimeId(item.effective_due_at)}
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

            {/* Kuis Penilaian yang Sedang Dibuka */}
            {quizzes.map((qz) => (
              <div
                key={qz.id}
                className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/[0.02] flex flex-col justify-between gap-2.5 transition-all hover:shadow-sm hover:border-purple-500/50"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      {qz.subject_name}
                    </span>
                    <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-600 dark:text-purple-400">
                      Passing Grade: {qz.passing_score}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground line-clamp-1">{qz.title}</h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    Modul: {qz.module_title} ({qz.total_questions} Soal)
                  </p>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" /> Kuis Penilaian
                  </span>
                  <Link href={`/student/kuis/${qz.id}`}>
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2.5 gap-1 border-purple-500/40 hover:bg-purple-500/10 text-purple-700 dark:text-purple-300">
                      Mulai Kuis <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
