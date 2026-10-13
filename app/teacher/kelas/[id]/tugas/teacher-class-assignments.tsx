'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Plus,
  Clock,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  BookOpen,
  UploadCloud,
  Link as LinkIcon,
  Users,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import type { AssignmentItem, DeadlineRuleType, SubmissionType } from '@/lib/types'
import { formatDateTimeId } from '@/lib/assignment-utils'
import { createAssignmentAction, updateAssignmentAction, deleteAssignmentAction } from '@/lib/actions/assignment'

interface SubjectOption {
  id: string
  name: string
}

interface MaterialOption {
  id: string
  title: string
  subject_id: string
  module_title: string
}

interface AssignmentWithStats extends AssignmentItem {
  submissions_count: number
  graded_count: number
  total_students: number
}

interface TeacherClassAssignmentsProps {
  classId: string
  classNameStr: string
  taughtSubjects: SubjectOption[]
  materials: MaterialOption[]
  assignments: AssignmentWithStats[]
}

export function TeacherClassAssignments({
  classId,
  classNameStr,
  taughtSubjects,
  materials,
  assignments,
}: TeacherClassAssignmentsProps) {
  const router = useRouter()

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<AssignmentItem | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form State
  const [subjectId, setSubjectId] = useState(taughtSubjects[0]?.id || '')
  const [materialId, setMaterialId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submissionType, setSubmissionType] = useState<SubmissionType>('both')
  const [deadlineRule, setDeadlineRule] = useState<DeadlineRuleType>('flexible')
  const [openAt, setOpenAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [closeAt, setCloseAt] = useState('')
  const [latePenalty, setLatePenalty] = useState('0')
  const [maxScore, setMaxScore] = useState('100')

  // Helper untuk format ISO ke datetime-local (YYYY-MM-DDTHH:mm)
  const toDateTimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleOpenCreateModal = () => {
    setEditingAssignment(null)
    setSubjectId(taughtSubjects[0]?.id || '')
    setMaterialId('')
    setTitle('')
    setDescription('')
    setSubmissionType('both')
    setDeadlineRule('flexible')

    const now = new Date()
    const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    setOpenAt(toDateTimeLocal(now))
    setDueAt(toDateTimeLocal(inAWeek))
    setCloseAt('')
    setLatePenalty('0')
    setMaxScore('100')
    setErrorMessage(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (assignment: AssignmentItem) => {
    setEditingAssignment(assignment)
    setSubjectId(assignment.subject_id)
    setMaterialId(assignment.material_id || '')
    setTitle(assignment.title)
    setDescription(assignment.description || '')
    setSubmissionType(assignment.submission_type)

    if (!assignment.allow_late) {
      setDeadlineRule('strict')
    } else if (assignment.close_at) {
      setDeadlineRule('with_close')
    } else {
      setDeadlineRule('flexible')
    }

    setOpenAt(toDateTimeLocal(new Date(assignment.open_at)))
    setDueAt(toDateTimeLocal(new Date(assignment.due_at)))
    setCloseAt(assignment.close_at ? toDateTimeLocal(new Date(assignment.close_at)) : '')
    setLatePenalty(String(assignment.late_penalty_percent))
    setMaxScore(String(assignment.max_score))
    setErrorMessage(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const formData = new FormData()
    formData.set('class_id', classId)
    formData.set('subject_id', subjectId)
    if (materialId) formData.set('material_id', materialId)
    formData.set('title', title)
    formData.set('description', description)
    formData.set('submission_type', submissionType)
    formData.set('deadline_rule', deadlineRule)
    formData.set('open_at', openAt)
    formData.set('due_at', dueAt)
    if (deadlineRule === 'with_close' && closeAt) {
      formData.set('close_at', closeAt)
    }
    formData.set('late_penalty_percent', latePenalty)
    formData.set('max_score', maxScore)

    try {
      const res = editingAssignment
        ? await updateAssignmentAction(editingAssignment.id, classId, formData)
        : await createAssignmentAction(formData)

      if (res.error) {
        setErrorMessage(res.error)
      } else {
        setIsModalOpen(false)
        router.refresh()
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus tugas ini? Semua pengumpulan siswa pada tugas ini juga akan terhapus.')) {
      return
    }

    setIsDeleting(assignmentId)
    try {
      const res = await deleteAssignmentAction(assignmentId, classId)
      if (res.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
    } catch {
      alert('Gagal menghapus tugas.')
    } finally {
      setIsDeleting(null)
    }
  }

  const filteredMaterials = materials.filter((m) => m.subject_id === subjectId)

  return (
    <div className="space-y-6">
      {/* Top Nav / Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href={`/teacher/kelas/${classId}`} className="hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Kelola Modul Kelas {classNameStr}
        </Link>
      </div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tugas & Penugasan — Kelas {classNameStr}</h1>
          <p className="text-sm text-muted-foreground">
            Buat tugas baru, tentukan aturan batas waktu, kaitkan ke materi, dan nilai pengumpulan siswa.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} className="gap-2 text-xs shrink-0">
          <Plus className="h-4 w-4" /> Buat Tugas Baru
        </Button>
      </div>

      {/* List Tugas */}
      {assignments.length === 0 ? (
        <Card className="border-dashed text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Belum ada tugas di kelas ini.</p>
              <p className="text-xs text-muted-foreground">
                Klik tombol &quot;Buat Tugas Baru&quot; untuk mulai memberikan tugas dengan batas waktu.
              </p>
            </div>
            <Button onClick={handleOpenCreateModal} variant="outline" size="sm" className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Buat Tugas Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignments.map((assignment) => {
            const isStrict = !assignment.allow_late
            const hasClose = assignment.allow_late && Boolean(assignment.close_at)

            return (
              <Card key={assignment.id} className="group hover:border-primary/50 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {assignment.subjects?.name ?? 'Mata Pelajaran'}
                        </span>
                        {isStrict ? (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <ShieldAlert className="h-2.5 w-2.5" /> Batas Waktu Ketat
                          </Badge>
                        ) : hasClose ? (
                          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 gap-1">
                            <Clock className="h-2.5 w-2.5" /> Dengan Batas Akhir
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Clock className="h-2.5 w-2.5" /> Fleksibel
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Nilai Maks: {assignment.max_score}
                        </span>
                      </div>
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        <Link href={`/teacher/tugas/${assignment.id}`} className="hover:underline">
                          {assignment.title}
                        </Link>
                      </CardTitle>
                      {assignment.description && (
                        <CardDescription className="line-clamp-2 text-xs">
                          {assignment.description}
                        </CardDescription>
                      )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 sm:self-start">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEditModal(assignment)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Edit Tugas"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(assignment.id)}
                        disabled={isDeleting === assignment.id}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        title="Hapus Tugas"
                      >
                        {isDeleting === assignment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-3 mt-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Submission type */}
                      <span className="flex items-center gap-1">
                        {assignment.submission_type === 'file' && <UploadCloud className="h-3.5 w-3.5" />}
                        {assignment.submission_type === 'link' && <LinkIcon className="h-3.5 w-3.5" />}
                        {assignment.submission_type === 'both' && <UploadCloud className="h-3.5 w-3.5" />}
                        <span className="capitalize">{assignment.submission_type}</span>
                      </span>

                      {/* Tenggat */}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        Tenggat: {formatDateTimeId(assignment.due_at)}
                      </span>

                      {/* Batas akhir jika ada */}
                      {assignment.close_at && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">
                          (Tutup: {formatDateTimeId(assignment.close_at)})
                        </span>
                      )}

                      {/* Materi Terkait */}
                      {assignment.materials && (
                        <span className="flex items-center gap-1 text-primary">
                          <BookOpen className="h-3.5 w-3.5" />
                          Materi: {assignment.materials.title}
                        </span>
                      )}
                    </div>

                    {/* Stats & Nav */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {assignment.submissions_count} / {assignment.total_students} Terkumpul
                        {assignment.graded_count > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[11px] ml-1">
                            ({assignment.graded_count} dinilai)
                          </span>
                        )}
                      </span>

                      <Link href={`/teacher/tugas/${assignment.id}`}>
                        <Button size="sm" className="gap-1 text-xs">
                          Kelola & Nilai <ChevronRight className="h-3.5 w-3.5" />
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

      {/* Modal Buat / Edit Tugas */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? 'Edit Tugas' : 'Buat Tugas Baru'}
        description={`Atur instruksi penugasan, opsi pengumpulan berkas/link, dan batas waktu untuk siswa kelas ${classNameStr}.`}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Pilihan Mata Pelajaran */}
          <div className="space-y-1.5">
            <Label htmlFor="field-subject" className="text-xs font-semibold">
              Mata Pelajaran
            </Label>
            <select
              id="field-subject"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value)
                setMaterialId('')
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
              required
            >
              {taughtSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Judul Tugas */}
          <div className="space-y-1.5">
            <Label htmlFor="field-title" className="text-xs font-semibold">
              Judul Tugas
            </Label>
            <Input
              id="field-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Tugas Praktikum 1 — Analisis Rangkaian Listrik"
              required
              className="text-xs"
            />
          </div>

          {/* Deskripsi / Instruksi */}
          <div className="space-y-1.5">
            <Label htmlFor="field-desc" className="text-xs font-semibold">
              Instruksi / Deskripsi Tugas
            </Label>
            <Textarea
              id="field-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tuliskan petunjuk pengerjaan, format laporan, kriteria penilaian..."
              rows={3}
              className="text-xs"
            />
          </div>

          {/* Opsi Kaitkan ke Materi */}
          <div className="space-y-1.5">
            <Label htmlFor="field-material" className="text-xs font-semibold">
              Kaitkan ke Materi (Opsional)
            </Label>
            <select
              id="field-material"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">-- Tidak dikaitkan ke materi --</option>
              {filteredMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.module_title} — {m.title}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Jika dikaitkan, siswa akan melihat tautan langsung ke materi (termasuk simulasinya) pada halaman tugas.
            </p>
          </div>

          {/* Jenis Pengumpulan (File, Link, Both) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Jenis Pengumpulan yang Diterima</Label>
            <div className="grid grid-cols-3 gap-2">
              <label
                className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                  submissionType === 'file'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="sub_type"
                  value="file"
                  checked={submissionType === 'file'}
                  onChange={() => setSubmissionType('file')}
                  className="sr-only"
                />
                <UploadCloud className="h-3.5 w-3.5" /> Berkas Saja
              </label>

              <label
                className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                  submissionType === 'link'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="sub_type"
                  value="link"
                  checked={submissionType === 'link'}
                  onChange={() => setSubmissionType('link')}
                  className="sr-only"
                />
                <LinkIcon className="h-3.5 w-3.5" /> Tautan Saja
              </label>

              <label
                className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                  submissionType === 'both'
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="sub_type"
                  value="both"
                  checked={submissionType === 'both'}
                  onChange={() => setSubmissionType('both')}
                  className="sr-only"
                />
                Keduanya (Wajib)
              </label>
            </div>
          </div>

          {/* OPSI SEDERHANA JENIS BATAS WAKTU */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold">Jenis Batas Waktu</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer space-y-0.5 text-xs transition-all ${
                  deadlineRule === 'flexible'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="deadline_rule"
                  value="flexible"
                  checked={deadlineRule === 'flexible'}
                  onChange={() => setDeadlineRule('flexible')}
                  className="sr-only"
                />
                <div className="font-semibold text-foreground">1. Fleksibel</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Diterima kapan saja. Lewat tenggat ditandai terlambat.
                </div>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer space-y-0.5 text-xs transition-all ${
                  deadlineRule === 'with_close'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="deadline_rule"
                  value="with_close"
                  checked={deadlineRule === 'with_close'}
                  onChange={() => setDeadlineRule('with_close')}
                  className="sr-only"
                />
                <div className="font-semibold text-foreground">2. Dengan Batas Akhir</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Diterima terlambat hingga tanggal batas akhir (close_at).
                </div>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer space-y-0.5 text-xs transition-all ${
                  deadlineRule === 'strict'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="deadline_rule"
                  value="strict"
                  checked={deadlineRule === 'strict'}
                  onChange={() => setDeadlineRule('strict')}
                  className="sr-only"
                />
                <div className="font-semibold text-foreground">3. Ketat</div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Ditolak langsung setelah tenggat waktu berakhir.
                </div>
              </label>
            </div>
          </div>

          {/* Form Tanggal Waktu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="field-open" className="text-xs font-semibold">
                Waktu Dibuka (Open At)
              </Label>
              <Input
                id="field-open"
                type="datetime-local"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-due" className="text-xs font-semibold">
                Tenggat Waktu (Due At)
              </Label>
              <Input
                id="field-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                required
                className="text-xs"
              />
            </div>
          </div>

          {/* Batas Akhir (close_at) hanya tampil jika mode "Dengan Batas Akhir" */}
          {deadlineRule === 'with_close' && (
            <div className="space-y-1.5 p-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.04]">
              <Label htmlFor="field-close" className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Batas Akhir Penerimaan (Close At)
              </Label>
              <Input
                id="field-close"
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                required
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Setelah waktu ini tercapai, pengumpulan baru maupun revisi akan ditolak sistem.
              </p>
            </div>
          )}

          {/* Skor Maks & Saran Penalti */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="field-score" className="text-xs font-semibold">
                Nilai Maksimal
              </Label>
              <Input
                id="field-score"
                type="number"
                min="1"
                max="1000"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-penalty" className="text-xs font-semibold">
                Saran Penalti Telat (%)
              </Label>
              <Input
                id="field-penalty"
                type="number"
                min="0"
                max="100"
                value={latePenalty}
                onChange={(e) => setLatePenalty(e.target.value)}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Hanya sebagai saran bagi guru; pemotongan nilai tidak otomatis.
              </p>
            </div>
          </div>

          {/* Pesan Error */}
          {errorMessage && (
            <div className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5 text-xs">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingAssignment ? 'Simpan Perubahan' : 'Buat Tugas'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
