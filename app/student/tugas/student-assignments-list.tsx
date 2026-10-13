'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Award,
  Link as LinkIcon,
  UploadCloud,
  ChevronRight,
  BookOpen,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AssignmentItem, SubmissionItem, AssignmentExtensionItem, StudentAssignmentStatus } from '@/lib/types'
import {
  getEffectiveDueAt,
  getStudentAssignmentStatus,
  isLateStillSubmittable,
  formatTimeRemaining,
  formatDateTimeId,
} from '@/lib/assignment-utils'

interface ExtendedAssignment extends AssignmentItem {
  userSubmission?: SubmissionItem | null
  userExtension?: AssignmentExtensionItem | null
}

interface StudentAssignmentsListProps {
  assignments: ExtendedAssignment[]
  classNameStr: string
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'Semua', value: 'all' },
  { label: 'Belum dikumpulkan', value: 'not_submitted' },
  { label: 'Terkumpul', value: 'submitted' },
  { label: 'Terlambat', value: 'late' },
  { label: 'Sudah dinilai', value: 'graded' },
  { label: 'Ditutup', value: 'closed' },
]

export function StudentAssignmentsList({ assignments, classNameStr }: StudentAssignmentsListProps) {
  const [activeFilter, setActiveFilter] = useState('all')
  const now = new Date()

  const processedList = assignments.map((assignment) => {
    const status = getStudentAssignmentStatus(
      assignment,
      assignment.userSubmission,
      assignment.userExtension,
      now,
    )
    const effectiveDueAt = getEffectiveDueAt(assignment.due_at, assignment.userExtension)
    const lateSubmittable = isLateStillSubmittable(assignment, assignment.userExtension, now)
    const timeRemaining = formatTimeRemaining(effectiveDueAt, now)

    return {
      ...assignment,
      status,
      effectiveDueAt,
      lateSubmittable,
      timeRemaining,
    }
  })

  const filteredList = processedList.filter((item) => {
    if (activeFilter === 'all') return true
    return item.status === activeFilter
  })

  const countByStatus = {
    all: processedList.length,
    not_submitted: processedList.filter((a) => a.status === 'not_submitted').length,
    submitted: processedList.filter((a) => a.status === 'submitted').length,
    late: processedList.filter((a) => a.status === 'late').length,
    graded: processedList.filter((a) => a.status === 'graded').length,
    closed: processedList.filter((a) => a.status === 'closed').length,
  }

  const renderStatusBadge = (status: StudentAssignmentStatus, lateSubmittable: boolean) => {
    switch (status) {
      case 'graded':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
            <Award className="h-3 w-3" /> Sudah Dinilai
          </Badge>
        )
      case 'submitted':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" /> Terkumpul (Tepat Waktu)
          </Badge>
        )
      case 'late':
        return (
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" /> Terlambat
          </Badge>
        )
      case 'closed':
        return (
          <Badge variant="secondary" className="gap-1 text-muted-foreground">
            <XCircle className="h-3 w-3" /> Ditutup
          </Badge>
        )
      case 'not_submitted':
      default:
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 gap-1">
              <Clock className="h-3 w-3" /> Belum Dikumpulkan
            </Badge>
            {lateSubmittable && (
              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-[10px]">
                <AlertTriangle className="h-2.5 w-2.5" /> Terlambat - masih bisa dikumpulkan
              </Badge>
            )}
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tugas & Penugasan</h1>
          <p className="text-sm text-muted-foreground">
            Daftar tugas kelas {classNameStr} yang perlu dikerjakan, sedang berlangsung, dan hasil penilaian.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-xl border">
        {STATUS_FILTERS.map((f) => {
          const count = countByStatus[f.value as keyof typeof countByStatus] ?? 0
          const isActive = activeFilter === f.value
          return (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-primary/10 text-primary font-bold' : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* List Tugas */}
      {filteredList.length === 0 ? (
        <Card className="border-dashed text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Tidak ada tugas dengan status ini.</p>
              <p className="text-xs text-muted-foreground">
                Silakan pilih filter lain atau cek kembali tugas mendatang Anda.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredList.map((item) => {
            const hasSubmission = Boolean(item.userSubmission)
            const isGraded = item.status === 'graded'
            const isUrgent = item.timeRemaining.isUrgent && item.status === 'not_submitted'

            return (
              <Card
                key={item.id}
                className={`group transition-all hover:shadow-md ${
                  isUrgent
                    ? 'border-amber-500/60 bg-amber-500/[0.02]'
                    : isGraded
                    ? 'border-emerald-500/30'
                    : 'hover:border-primary/40'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {item.subjects?.name ?? 'Mata Pelajaran'}
                        </span>
                        {renderStatusBadge(item.status, item.lateSubmittable)}
                      </div>
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        <Link href={`/student/tugas/${item.id}`} className="hover:underline">
                          {item.title}
                        </Link>
                      </CardTitle>
                      {item.description && (
                        <CardDescription className="line-clamp-2 text-xs">
                          {item.description}
                        </CardDescription>
                      )}
                    </div>

                    {/* Deadline & Countdown */}
                    <div className="sm:text-right shrink-0 space-y-1">
                      <div className="text-xs font-medium flex items-center sm:justify-end gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Tenggat: {formatDateTimeId(item.effectiveDueAt)}</span>
                      </div>
                      {item.userExtension && (
                        <p className="text-[11px] text-primary font-medium">
                          ★ Perpanjangan khusus disetujui
                        </p>
                      )}
                      {item.status === 'not_submitted' && !item.timeRemaining.isPast && (
                        <div
                          className={`text-xs font-semibold ${
                            isUrgent ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-muted-foreground'
                          }`}
                        >
                          {item.timeRemaining.text}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-3 mt-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Submission Type Info */}
                      <span className="flex items-center gap-1">
                        {item.submission_type === 'file' && (
                          <>
                            <UploadCloud className="h-3.5 w-3.5 text-primary" /> Pengumpulan Berkas
                          </>
                        )}
                        {item.submission_type === 'link' && (
                          <>
                            <LinkIcon className="h-3.5 w-3.5 text-primary" /> Pengumpulan Tautan
                          </>
                        )}
                        {item.submission_type === 'both' && (
                          <>
                            <UploadCloud className="h-3.5 w-3.5 text-primary" /> Berkas & Tautan
                          </>
                        )}
                      </span>

                      {/* Skor Maksimal */}
                      <span>Nilai Maks: {item.max_score}</span>

                      {/* Tautan Materi Terkait jika ada */}
                      {item.materials && (
                        <Link
                          href={`/student/materi/${item.materials.id}`}
                          className="flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Materi: {item.materials.title}</span>
                          {item.materials.simulations && item.materials.simulations.length > 0 && (
                            <span className="text-[10px] px-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                              +Simulasi
                            </span>
                          )}
                        </Link>
                      )}
                    </div>

                    {/* Action Link & Nilai Result */}
                    <div className="flex items-center gap-3">
                      {isGraded && item.userSubmission?.score !== null && (
                        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          Skor: {item.userSubmission?.score} / {item.max_score}
                        </span>
                      )}

                      <Link href={`/student/tugas/${item.id}`}>
                        <Button size="sm" variant={hasSubmission ? 'outline' : 'default'} className="gap-1 text-xs">
                          {hasSubmission ? 'Lihat Pengumpulan' : 'Buka Tugas'}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
