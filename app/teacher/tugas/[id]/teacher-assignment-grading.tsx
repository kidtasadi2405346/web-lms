'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Clock,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Award,
  Download,
  ExternalLink,
  Search,
  Sparkles,
  Loader2,
  UserCheck,
  Send,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import type { AssignmentItem, SubmissionItem, AssignmentExtensionItem, Profile } from '@/lib/types'
import {
  getEffectiveDueAt,
  formatLateDuration,
  formatDateTimeId,
} from '@/lib/assignment-utils'
import {
  gradeSubmissionAction,
  grantExtensionAction,
  deleteExtensionAction,
  getSubmissionSignedUrl,
} from '@/lib/actions/assignment'

export interface StudentRowData {
  student: Profile
  submission: SubmissionItem | null
  extension: AssignmentExtensionItem | null
}

interface TeacherAssignmentGradingProps {
  assignment: AssignmentItem & {
    classes?: { id: string; name: string }
    subjects?: { id: string; name: string }
    materials?: { id: string; title: string } | null
  }
  studentsData: StudentRowData[]
}

export function TeacherAssignmentGrading({ assignment, studentsData }: TeacherAssignmentGradingProps) {
  const router = useRouter()

  // Filter & Search states
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // State untuk form penilaian per siswa
  const [gradingState, setGradingState] = useState<Record<string, { score: string; feedback: string }>>(() => {
    const init: Record<string, { score: string; feedback: string }> = {}
    studentsData.forEach(({ student, submission }) => {
      init[student.id] = {
        score: submission?.score !== null && submission?.score !== undefined ? String(submission.score) : '',
        feedback: submission?.feedback || '',
      }
    })
    return init
  })

  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null)
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null)

  // State untuk Modal Perpanjangan (Extension)
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false)
  const [targetStudent, setTargetStudent] = useState<StudentRowData | null>(null)
  const [newDueAt, setNewDueAt] = useState('')
  const [extensionReason, setExtensionReason] = useState('')
  const [isSavingExtension, setIsSavingExtension] = useState(false)
  const [extensionError, setExtensionError] = useState<string | null>(null)

  // Helper konversi Date ke format datetime-local
  const toDateTimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Handle Unduh Berkas Siswa
  const handleDownloadFile = async (filePath: string) => {
    setDownloadingPath(filePath)
    try {
      const res = await getSubmissionSignedUrl(filePath)
      if (res.signedUrl) {
        window.open(res.signedUrl, '_blank')
      } else {
        alert(res.error || 'Gagal membuat tautan unduh berkas.')
      }
    } catch {
      alert('Terjadi kesalahan saat mengunduh berkas.')
    } finally {
      setDownloadingPath(null)
    }
  }

  // Handle Simpan Nilai & Komentar
  const handleSaveGrade = async (studentId: string, submissionId: string) => {
    const current = gradingState[studentId]
    if (!current || current.score === '') {
      alert('Silakan isi nilai terlebih dahulu.')
      return
    }

    setSavingSubmissionId(submissionId)
    const formData = new FormData()
    formData.set('score', current.score)
    formData.set('feedback', current.feedback)

    try {
      const res = await gradeSubmissionAction(submissionId, assignment.id, formData)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
    } catch {
      alert('Gagal menyimpan nilai.')
    } finally {
      setSavingSubmissionId(null)
    }
  }

  // Handle Buka Modal Perpanjangan
  const handleOpenExtensionModal = (row: StudentRowData) => {
    setTargetStudent(row)
    setExtensionError(null)

    if (row.extension?.new_due_at) {
      setNewDueAt(toDateTimeLocal(new Date(row.extension.new_due_at)))
      setExtensionReason(row.extension.reason || '')
    } else {
      // Default: 3 hari dari deadline saat ini
      const baseDue = new Date(assignment.due_at)
      const defaultNewDue = new Date(baseDue.getTime() + 3 * 24 * 60 * 60 * 1000)
      setNewDueAt(toDateTimeLocal(defaultNewDue))
      setExtensionReason('')
    }

    setIsExtensionModalOpen(true)
  }

  // Handle Simpan Perpanjangan
  const handleSaveExtension = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetStudent) return
    setIsSavingExtension(true)
    setExtensionError(null)

    const formData = new FormData()
    formData.set('new_due_at', newDueAt)
    formData.set('reason', extensionReason)

    try {
      const res = await grantExtensionAction(assignment.id, targetStudent.student.id, formData)
      if (res.error) {
        setExtensionError(res.error)
      } else {
        setIsExtensionModalOpen(false)
        router.refresh()
      }
    } catch (err) {
      setExtensionError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSavingExtension(false)
    }
  }

  // Handle Hapus/Cabut Perpanjangan
  const handleDeleteExtension = async (studentId: string) => {
    if (!confirm('Apakah Anda yakin ingin mencabut perpanjangan waktu untuk siswa ini?')) return

    try {
      const res = await deleteExtensionAction(assignment.id, studentId)
      if (res.error) {
        alert(res.error)
      } else {
        setIsExtensionModalOpen(false)
        router.refresh()
      }
    } catch {
      alert('Gagal mencabut perpanjangan.')
    }
  }

  // Evaluasi filter & statistik
  const totalStudents = studentsData.length
  const submittedCount = studentsData.filter((r) => r.submission !== null).length
  const notSubmittedCount = totalStudents - submittedCount
  const gradedCount = studentsData.filter((r) => r.submission?.score !== null && r.submission?.score !== undefined).length
  const pendingGradingCount = submittedCount - gradedCount
  const lateCount = studentsData.filter((r) => r.submission?.is_late).length

  const filteredStudents = studentsData.filter((row) => {
    const nameMatch =
      row.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.student.identity_number.toLowerCase().includes(searchQuery.toLowerCase())

    if (!nameMatch) return false

    if (filterStatus === 'all') return true
    if (filterStatus === 'not_submitted') return row.submission === null
    if (filterStatus === 'submitted') return row.submission !== null
    if (filterStatus === 'pending') return row.submission !== null && (row.submission.score === null || row.submission.score === undefined)
    if (filterStatus === 'graded') return row.submission !== null && row.submission.score !== null && row.submission.score !== undefined
    if (filterStatus === 'late') return row.submission?.is_late === true

    return true
  })

  return (
    <div className="space-y-6">
      {/* Tombol Navigasi Kembali */}
      <div>
        <Link
          href={`/teacher/kelas/${assignment.class_id}/tugas`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Kembali ke Daftar Tugas Kelas
        </Link>
      </div>

      {/* Header Info Tugas */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            Kelas {assignment.classes?.name ?? '-'}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {assignment.subjects?.name ?? 'Mata Pelajaran'}
          </span>
          {!assignment.allow_late && (
            <Badge variant="destructive" className="text-[10px]">
              Batas Waktu Ketat
            </Badge>
          )}
          {assignment.allow_late && assignment.close_at && (
            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
              Dengan Batas Akhir
            </Badge>
          )}
          {assignment.allow_late && !assignment.close_at && (
            <Badge variant="secondary" className="text-[10px]">
              Fleksibel
            </Badge>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{assignment.title}</h1>

        {assignment.description && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap max-w-4xl">
            {assignment.description}
          </p>
        )}
      </div>

      {/* Kartu Ringkasan Jadwal & Penalti */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Tenggat Waktu Umum</div>
          <div className="font-semibold text-xs mt-0.5 text-primary flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> {formatDateTimeId(assignment.due_at)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Batas Akhir (Close At)</div>
          <div className="font-semibold text-xs mt-0.5">
            {assignment.close_at ? formatDateTimeId(assignment.close_at) : 'Tidak ada (Fleksibel)'}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Saran Penalti Telat</div>
          <div className="font-semibold text-xs mt-0.5 text-amber-600 dark:text-amber-400">
            {assignment.late_penalty_percent > 0 ? `${assignment.late_penalty_percent}% (Pedoman Guru)` : '0% (Tanpa Penalti)'}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Nilai Maksimal</div>
          <div className="font-semibold text-xs mt-0.5">{assignment.max_score} Poin</div>
        </Card>
      </div>

      {/* Kartu Metrik Pengumpulan */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Total Siswa</div>
          <div className="text-xl font-bold mt-0.5">{totalStudents}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Terkumpul</div>
          <div className="text-xl font-bold mt-0.5 text-blue-600">{submittedCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Perlu Dinilai</div>
          <div className="text-xl font-bold mt-0.5 text-amber-600">{pendingGradingCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Sudah Dinilai</div>
          <div className="text-xl font-bold mt-0.5 text-emerald-600">{gradedCount}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Belum Mengumpulkan</div>
          <div className="text-xl font-bold mt-0.5 text-destructive">{notSubmittedCount}</div>
        </Card>
      </div>

      {/* Filter Bar & Pencarian */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-xl border">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
              filterStatus === 'all' ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Semua ({totalStudents})
          </button>
          <button
            onClick={() => setFilterStatus('not_submitted')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
              filterStatus === 'not_submitted'
                ? 'bg-background shadow-sm font-semibold text-destructive'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Belum Mengumpulkan ({notSubmittedCount})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
              filterStatus === 'pending'
                ? 'bg-background shadow-sm font-semibold text-amber-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Perlu Dinilai ({pendingGradingCount})
          </button>
          <button
            onClick={() => setFilterStatus('graded')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
              filterStatus === 'graded'
                ? 'bg-background shadow-sm font-semibold text-emerald-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sudah Dinilai ({gradedCount})
          </button>
          <button
            onClick={() => setFilterStatus('late')}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
              filterStatus === 'late'
                ? 'bg-background shadow-sm font-semibold text-orange-600'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Terlambat ({lateCount})
          </button>
        </div>

        {/* Input Cari Siswa */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari siswa atau NIS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Daftar Siswa dan Pengumpulan */}
      {filteredStudents.length === 0 ? (
        <Card className="border-dashed text-center py-12">
          <CardContent className="space-y-2">
            <UserCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Tidak ada siswa dengan filter ini.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredStudents.map((row) => {
            const { student, submission, extension } = row
            const effectiveDue = getEffectiveDueAt(assignment.due_at, extension)
            const hasSubmission = Boolean(submission)
            const isLate = submission?.is_late ?? false
            const isGraded = submission?.score !== null && submission?.score !== undefined

            const currentGrading = gradingState[student.id] || { score: '', feedback: '' }

            // Hitung saran penalti jika terlambat
            let penaltySuggestion: string | null = null
            if (isLate && assignment.late_penalty_percent > 0) {
              const deductedMax = Math.round(
                assignment.max_score - (assignment.max_score * assignment.late_penalty_percent) / 100,
              )
              penaltySuggestion = `Saran penalti telat -${assignment.late_penalty_percent}% (maksimum nilai yang disarankan: ${deductedMax})`
            }

            return (
              <Card
                key={student.id}
                className={`overflow-hidden transition-all ${
                  isGraded
                    ? 'border-emerald-500/30'
                    : hasSubmission
                    ? 'border-blue-500/30'
                    : 'border-border'
                }`}
              >
                <div className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Info Siswa & Pengumpulan */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground">{student.name}</h3>
                      <span className="font-mono text-xs text-muted-foreground">
                        NIS: {student.identity_number}
                      </span>

                      {/* Status Badges */}
                      {!submission ? (
                        <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px]">
                          Belum Mengumpulkan
                        </Badge>
                      ) : isLate ? (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                          <Clock className="h-3 w-3" />
                          {formatLateDuration(submission.submitted_at, effectiveDue)}
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600 text-white gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Tepat Waktu
                        </Badge>
                      )}

                      {/* Badge Perpanjangan */}
                      {extension && (
                        <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400 gap-1 text-[10px]">
                          <Sparkles className="h-3 w-3" /> Perpanjangan: {formatDateTimeId(extension.new_due_at)}
                        </Badge>
                      )}
                    </div>

                    {/* Rincian Berkas & Tautan Siswa */}
                    {submission ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className="text-muted-foreground">
                            Dikumpulkan: {formatDateTimeId(submission.submitted_at)}
                          </span>

                          {/* Tombol Unduh Berkas */}
                          {submission.file_path && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadFile(submission.file_path!)}
                              disabled={downloadingPath === submission.file_path}
                              className="h-7 gap-1 text-xs"
                            >
                              {downloadingPath === submission.file_path ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              Unduh Berkas ({submission.file_path.split('/').pop()})
                            </Button>
                          )}

                          {/* Tombol Buka Tautan */}
                          {submission.link_url && (
                            <a
                              href={submission.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" /> Buka Tautan
                            </a>
                          )}
                        </div>

                        {/* Saran Penalti jika terlambat */}
                        {penaltySuggestion && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {penaltySuggestion}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Siswa belum mengunggah berkas atau tautan tugas.
                      </p>
                    )}
                  </div>

                  {/* Tombol Beri Perpanjangan Waktu */}
                  <div className="shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenExtensionModal(row)}
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                      {extension ? 'Ubah Perpanjangan' : 'Beri Perpanjangan'}
                    </Button>
                  </div>
                </div>

                {/* Form Pengisian Nilai & Umpan Balik (Jika siswa sudah mengumpulkan) */}
                {submission && (
                  <div className="border-t bg-muted/15 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      {/* Input Skor */}
                      <div className="w-full sm:w-32 space-y-1">
                        <Label htmlFor={`score-${student.id}`} className="text-xs font-semibold">
                          Nilai (0 - {assignment.max_score})
                        </Label>
                        <Input
                          id={`score-${student.id}`}
                          type="number"
                          min="0"
                          max={assignment.max_score}
                          step="0.5"
                          placeholder="0"
                          value={currentGrading.score}
                          onChange={(e) =>
                            setGradingState((prev) => ({
                              ...prev,
                              [student.id]: {
                                score: e.target.value,
                                feedback: prev[student.id]?.feedback ?? '',
                              },
                            }))
                          }
                          className="text-xs h-9"
                        />
                      </div>

                      {/* Input Feedback */}
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`feedback-${student.id}`} className="text-xs font-semibold">
                          Komentar / Umpan Balik Guru
                        </Label>
                        <Textarea
                          id={`feedback-${student.id}`}
                          rows={2}
                          placeholder="Beri apresiasi atau catatan perbaikan untuk siswa..."
                          value={currentGrading.feedback}
                          onChange={(e) =>
                            setGradingState((prev) => ({
                              ...prev,
                              [student.id]: {
                                score: prev[student.id]?.score ?? '',
                                feedback: e.target.value,
                              },
                            }))
                          }
                          className="text-xs"
                        />
                      </div>

                      {/* Tombol Simpan Nilai */}
                      <div className="sm:self-end">
                        <Button
                          size="sm"
                          onClick={() => handleSaveGrade(student.id, submission.id)}
                          disabled={savingSubmissionId === submission.id}
                          className="h-9 gap-1.5 text-xs w-full sm:w-auto"
                        >
                          {savingSubmissionId === submission.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Simpan Nilai
                        </Button>
                      </div>
                    </div>

                    {isGraded && submission.graded_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Terakhir dinilai pada: {formatDateTimeId(submission.graded_at)}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Beri / Ubah Perpanjangan Waktu */}
      <Modal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        title={`Perpanjangan Waktu: ${targetStudent?.student.name || ''}`}
        description="Berikan batas waktu khusus untuk siswa ini tanpa mengubah deadline umum kelas."
        maxWidth="md"
      >
        <form onSubmit={handleSaveExtension} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="field-new-due" className="text-xs font-semibold">
              Batas Waktu Baru (New Due At)
            </Label>
            <Input
              id="field-new-due"
              type="datetime-local"
              value={newDueAt}
              onChange={(e) => setNewDueAt(e.target.value)}
              required
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="field-reason" className="text-xs font-semibold">
              Alasan Perpanjangan
            </Label>
            <Input
              id="field-reason"
              placeholder="Contoh: Izin sakit, kendala perangkat..."
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              className="text-xs"
            />
          </div>

          {extensionError && (
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{extensionError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            {targetStudent?.extension ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteExtension(targetStudent.student.id)}
                className="gap-1 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" /> Cabut Perpanjangan
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsExtensionModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSavingExtension} className="gap-1 text-xs">
                {isSavingExtension && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Simpan Perpanjangan
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
