'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Award,
  Link as LinkIcon,
  UploadCloud,
  ChevronLeft,
  BookOpen,
  Download,
  ExternalLink,
  Sparkles,
  Loader2,
  FileCheck,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AssignmentItem, SubmissionItem, AssignmentExtensionItem, Profile } from '@/lib/types'
import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_FILE_TYPES_LABEL,
  MAX_FILE_SIZE_BYTES,
  getEffectiveDueAt,
  getStudentAssignmentStatus,
  isAssignmentSubmittable,
  isLateStillSubmittable,
  formatLateDuration,
  formatTimeRemaining,
  formatDateTimeId,
} from '@/lib/assignment-utils'
import { submitAssignmentAction, getSubmissionSignedUrl } from '@/lib/actions/assignment'
import { createClient } from '@/lib/supabase/client'

interface StudentAssignmentDetailProps {
  assignment: AssignmentItem & {
    materials?: {
      id: string
      title: string
      simulations?: { id: string; title: string }[]
    } | null
    subjects?: { id: string; name: string } | null
  }
  submission: SubmissionItem | null
  extension: AssignmentExtensionItem | null
  studentProfile: Profile
}

export function StudentAssignmentDetail({
  assignment,
  submission,
  extension,
  studentProfile,
}: StudentAssignmentDetailProps) {
  const router = useRouter()
  const now = new Date()

  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [linkUrl, setLinkUrl] = useState(submission?.link_url || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const effectiveDueAt = getEffectiveDueAt(assignment.due_at, extension)
  const status = getStudentAssignmentStatus(assignment, submission, extension, now)
  const submittableCheck = isAssignmentSubmittable(assignment, extension, now)
  const lateSubmittable = isLateStillSubmittable(assignment, extension, now)
  const timeRemaining = formatTimeRemaining(effectiveDueAt, now)
  const isPastDue = now > effectiveDueAt

  const hasSubmission = Boolean(submission)
  const isGraded = submission?.score !== null && submission?.score !== undefined

  // Handle file download
  const handleDownloadFile = async () => {
    if (!submission?.file_path) return
    setIsDownloading(true)
    try {
      const res = await getSubmissionSignedUrl(submission.file_path)
      if (res.signedUrl) {
        window.open(res.signedUrl, '_blank')
      } else {
        setErrorMessage(res.error || 'Gagal membuat tautan unduhan.')
      }
    } catch {
      setErrorMessage('Terjadi kesalahan saat mengunduh berkas.')
    } finally {
      setIsDownloading(false)
    }
  }

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validasi ukuran
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`Ukuran file maksimal adalah 10 MB. File yang Anda pilih berukuran ${(file.size / (1024 * 1024)).toFixed(1)} MB.`)
      setSelectedFile(null)
      return
    }

    // Validasi ekstensi
    const lowerName = file.name.toLowerCase()
    const isValidExt = ALLOWED_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
    if (!isValidExt) {
      setErrorMessage(`Format file tidak didukung. Format yang diizinkan: ${ALLOWED_FILE_TYPES_LABEL}.`)
      setSelectedFile(null)
      return
    }

    setErrorMessage(null)
    setSelectedFile(file)
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    // Validasi form lokal
    const requiresFile = assignment.submission_type === 'file' || assignment.submission_type === 'both'
    const requiresLink = assignment.submission_type === 'link' || assignment.submission_type === 'both'

    if (requiresFile && !selectedFile && !submission?.file_path) {
      setErrorMessage('Silakan pilih file tugas yang ingin diunggah.')
      return
    }

    if (requiresLink && (!linkUrl || !linkUrl.trim())) {
      setErrorMessage('Tautan (link) wajib diisi.')
      return
    }

    if (requiresLink && linkUrl && !linkUrl.trim().toLowerCase().startsWith('https://')) {
      setErrorMessage('Tautan (link) harus diawali dengan https://')
      return
    }

    setIsSubmitting(true)

    try {
      let finalFilePath = submission?.file_path || null

      // Jika ada file baru dipilih, upload ke Supabase Storage
      if (selectedFile) {
        const supabase = createClient()
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `${assignment.id}/${studentProfile.id}/${Date.now()}_${cleanName}`

        const { error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(filePath, selectedFile, { upsert: true })

        if (uploadError) {
          throw new Error(`Gagal mengunggah berkas: ${uploadError.message}`)
        }

        finalFilePath = filePath
      }

      // Panggil RPC submit_assignment melalui Server Action
      const res = await submitAssignmentAction(
        assignment.id,
        finalFilePath,
        requiresLink ? linkUrl.trim() : null,
      )

      if (res.error) {
        setErrorMessage(res.error)
      } else {
        setSuccessMessage(res.message || 'Tugas berhasil dikumpulkan!')
        setSelectedFile(null)
        router.refresh()
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat mengumpulkan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Tombol Kembali */}
      <div>
        <Link
          href="/student/tugas"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Kembali ke Daftar Tugas
        </Link>
      </div>

      {/* Header Tugas */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            {assignment.subjects?.name ?? 'Mata Pelajaran'}
          </span>
          {status === 'graded' && (
            <Badge className="bg-emerald-600 text-white gap-1">
              <Award className="h-3 w-3" /> Sudah Dinilai
            </Badge>
          )}
          {status === 'submitted' && (
            <Badge className="bg-blue-600 text-white gap-1">
              <CheckCircle2 className="h-3 w-3" /> Terkumpul Tepat Waktu
            </Badge>
          )}
          {status === 'late' && (
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" /> Terkumpul Terlambat
            </Badge>
          )}
          {status === 'closed' && (
            <Badge variant="secondary" className="gap-1 text-muted-foreground">
              <XCircle className="h-3 w-3" /> Ditutup
            </Badge>
          )}
          {status === 'not_submitted' && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 gap-1">
              <Clock className="h-3 w-3" /> Belum Dikumpulkan
            </Badge>
          )}
          {lateSubmittable && (
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-[10px]">
              <AlertTriangle className="h-2.5 w-2.5" /> Terlambat - masih bisa dikumpulkan
            </Badge>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{assignment.title}</h1>

        {assignment.description && (
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed mt-2 pt-2 border-t">
            {assignment.description}
          </div>
        )}
      </div>

      {/* Banner Tautan Materi Terkait jika ada */}
      {assignment.materials && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Materi Terkait: {assignment.materials.title}
                </span>
                {assignment.materials.simulations && assignment.materials.simulations.length > 0 && (
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 gap-1 text-[10px]">
                    <Sparkles className="h-3 w-3" /> Tersedia Simulasi
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Disarankan untuk mempelajari materi terlebih dahulu sebelum mengerjakan tugas ini.
              </p>
            </div>
            <Link href={`/student/materi/${assignment.materials.id}`}>
              <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0">
                <BookOpen className="h-3.5 w-3.5" /> Buka Materi
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Info Batas Waktu & Ketentuan */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Waktu Dibuka</div>
          <div className="font-semibold text-xs mt-0.5">{formatDateTimeId(assignment.open_at)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Tenggat Waktu (Deadline)</div>
          <div className="font-semibold text-xs mt-0.5 text-primary">
            {formatDateTimeId(effectiveDueAt)}
          </div>
          {extension && (
            <div className="text-[10px] text-primary font-medium mt-0.5">
              ★ Diperpanjang guru
            </div>
          )}
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Batas Akhir (Close)</div>
          <div className="font-semibold text-xs mt-0.5">
            {assignment.close_at
              ? formatDateTimeId(assignment.close_at)
              : assignment.allow_late
              ? 'Fleksibel'
              : 'Sama dengan Deadline'}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Nilai Maksimal</div>
          <div className="font-semibold text-xs mt-0.5">{assignment.max_score} Poin</div>
          {assignment.late_penalty_percent > 0 && (
            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
              Saran penalti telat: -{assignment.late_penalty_percent}%
            </div>
          )}
        </Card>
      </div>

      {/* Informasi Perpanjangan Khusus jika ada */}
      {extension && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.04] p-4 text-xs space-y-1">
          <div className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Anda Mendapatkan Perpanjangan Waktu Khusus
          </div>
          <p className="text-muted-foreground">
            Batas waktu baru Anda: <span className="font-semibold text-foreground">{formatDateTimeId(extension.new_due_at)}</span>.
          </p>
          {extension.reason && (
            <p className="text-muted-foreground">
              Alasan: <span className="italic">{extension.reason}</span>
            </p>
          )}
        </div>
      )}

      {/* Bagian Hasil Penilaian (Jika sudah dinilai guru) */}
      {isGraded && submission && (
        <Card className="border-emerald-500/40 bg-emerald-500/[0.03]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Award className="h-5 w-5" /> Hasil Penilaian Guru
              </CardTitle>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {submission.score}
                </span>
                <span className="text-xs text-muted-foreground"> / {assignment.max_score}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {submission.feedback ? (
              <div className="p-3 rounded-lg bg-background border space-y-1">
                <div className="font-semibold text-muted-foreground">Umpan Balik Guru:</div>
                <div className="whitespace-pre-wrap text-foreground">{submission.feedback}</div>
              </div>
            ) : (
              <p className="text-muted-foreground italic">Belum ada catatan umpan balik dari guru.</p>
            )}
            {submission.graded_at && (
              <p className="text-[10px] text-muted-foreground">
                Dinilai pada: {formatDateTimeId(submission.graded_at)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Riwayat Pengumpulan Terakhir jika sudah mengumpulkan */}
      {submission && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-primary" /> Pengumpulan Anda Saat Ini
              </CardTitle>
              <div className="flex items-center gap-2 text-xs">
                {submission.is_late ? (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <Clock className="h-3 w-3" /> {formatLateDuration(submission.submitted_at, effectiveDueAt)}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 text-white gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> Tepat Waktu
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription className="text-xs">
              Dikirim pada: {formatDateTimeId(submission.submitted_at)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {submission.file_path && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-2 truncate mr-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate font-mono">{submission.file_path.split('/').pop()}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadFile}
                  disabled={isDownloading}
                  className="gap-1 text-xs shrink-0"
                >
                  {isDownloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Unduh Berkas
                </Button>
              </div>
            )}

            {submission.link_url && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-2 truncate mr-2">
                  <LinkIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate font-mono">{submission.link_url}</span>
                </div>
                <a
                  href={submission.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent hover:text-accent-foreground shrink-0 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Buka Tautan
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form Pengumpulan / Pengumpulan Ulang */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {hasSubmission ? 'Kumpulkan Ulang Tugas' : 'Kirim Pengumpulan Tugas'}
          </CardTitle>
          <CardDescription className="text-xs">
            {hasSubmission
              ? 'Anda dapat mengumpulkan ulang selama batas waktu masih mengizinkan. Pengumpulan baru akan menimpa pengumpulan lama.'
              : 'Pastikan file dan tautan yang diisi sudah sesuai instruksi guru.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!submittableCheck.submittable ? (
            <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive space-y-1 text-xs">
              <div className="font-semibold flex items-center gap-1.5">
                <XCircle className="h-4 w-4" /> Pengumpulan Telah Ditutup
              </div>
              <p>{submittableCheck.reason || 'Batas waktu pengumpulan telah berakhir.'}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Alert Keterlambatan jika saat ini lewat deadline tapi masih bisa submit */}
              {isPastDue && (
                <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.05] text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Perhatian: Keterlambatan Pengumpulan.</span>
                    <p className="mt-0.5">
                      Waktu sekarang telah melewati tenggat waktu ({formatDateTimeId(effectiveDueAt)}).
                      Tugas ini akan ditandai sebagai <span className="font-bold underline">Terlambat</span>.
                    </p>
                  </div>
                </div>
              )}

              {/* Input File jika submission_type file atau both */}
              {(assignment.submission_type === 'file' || assignment.submission_type === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="assignment-file" className="text-xs font-semibold">
                    Unggah Berkas Tugas (Maks. 10 MB)
                  </Label>
                  <div className="flex flex-col gap-2">
                    <Input
                      id="assignment-file"
                      type="file"
                      onChange={handleFileChange}
                      accept={ALLOWED_FILE_EXTENSIONS.join(',')}
                      className="cursor-pointer file:cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Format yang diizinkan: {ALLOWED_FILE_TYPES_LABEL}</span>
                      {selectedFile && (
                        <span className="text-primary font-medium">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB terpilih
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Input Link jika submission_type link atau both */}
              {(assignment.submission_type === 'link' || assignment.submission_type === 'both') && (
                <div className="space-y-2">
                  <Label htmlFor="assignment-link" className="text-xs font-semibold">
                    Tautan / URL Tugas (Harus berawalan https://)
                  </Label>
                  <Input
                    id="assignment-link"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://github.com/... atau https://docs.google.com/..."
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Contoh: repositori GitHub, link Google Drive, atau link website live demo.
                  </p>
                </div>
              )}

              {/* Feedback Error / Sukses */}
              {errorMessage && (
                <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto gap-2 text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Mengumpulkan Tugas...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    {hasSubmission ? 'Kumpulkan Ulang Sekarang' : 'Kumpulkan Tugas'}
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
