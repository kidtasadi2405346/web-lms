'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Download,
  FileQuestion,
  GraduationCap,
  HelpCircle,
  RotateCcw,
  Search,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import type { StudentGradebookItem, GradebookSummary } from '@/lib/types'

interface SubjectOption {
  id: string
  name: string
}

interface QuizHeaderInfo {
  id: string
  title: string
  passingScore: number
  moduleTitle: string
}

interface GradebookClientProps {
  classId: string
  className: string
  referralCode: string
  taughtSubjects: SubjectOption[]
  selectedSubjectId: string
  quizzesList: QuizHeaderInfo[]
  totalMaterialsInScope: number
  students: StudentGradebookItem[]
  summary: GradebookSummary
}

export function GradebookClient({
  classId,
  className,
  referralCode,
  taughtSubjects,
  selectedSubjectId,
  quizzesList,
  totalMaterialsInScope,
  students,
  summary,
}: GradebookClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'attempted' | 'not_attempted' | 'all_passed'>('all')
  const [selectedStudent, setSelectedStudent] = useState<StudentGradebookItem | null>(null)

  // Filter siswa berdasarkan kata kunci pencarian dan status filter
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // 1. Search filter
      const matchesSearch =
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      // 2. Status filter
      if (statusFilter === 'attempted') {
        return s.average_quiz_score !== null
      }
      if (statusFilter === 'not_attempted') {
        return s.average_quiz_score === null
      }
      if (statusFilter === 'all_passed') {
        return s.all_quizzes_passed
      }

      return true
    })
  }, [students, searchQuery, statusFilter])

  // Fungsi Ekspor CSV Sederhana
  function exportToCSV() {
    if (students.length === 0) {
      alert('Belum ada data siswa untuk diekspor.')
      return
    }

    // Header baris CSV
    const headers = [
      'No',
      'Nama Siswa',
      'Email',
      'Tanggal Bergabung',
      'Progres Materi (%)',
      'Materi Selesai',
      'Total Materi',
      'Rata-rata Nilai Kuis',
      'Status Kelulusan Kuis',
    ]

    // Tambahkan kolom dinamis untuk setiap kuis
    quizzesList.forEach((q) => {
      headers.push(
        `Kuis: ${q.title} (Skor Tertinggi)`,
        `Kuis: ${q.title} (Jumlah Percobaan)`,
        `Kuis: ${q.title} (Status KKM: ${q.passingScore})`
      )
    })

    // Baris data siswa
    const rows: string[][] = filteredStudents.map((s, idx) => {
      const rowData = [
        String(idx + 1),
        `"${s.full_name.replace(/"/g, '""')}"`,
        `"${s.email.replace(/"/g, '""')}"`,
        `"${new Date(s.enrolled_at).toLocaleDateString('id-ID')}"`,
        `${s.material_progress_percent}%`,
        String(s.completed_materials_count),
        String(s.total_materials_count),
        s.average_quiz_score !== null ? String(s.average_quiz_score) : 'Belum Dikerjakan',
        s.all_quizzes_passed ? 'Lulus Semua' : 'Belum Lulus Semua',
      ]

      // Isi nilai untuk tiap kuis
      quizzesList.forEach((q) => {
        const qSummary = s.quizzes.find((item) => item.quiz_id === q.id)
        if (qSummary && qSummary.highest_score !== null) {
          rowData.push(
            String(qSummary.highest_score),
            String(qSummary.attempts_count),
            qSummary.is_passed ? 'Lulus' : 'Belum Lulus'
          )
        } else {
          rowData.push('0', '0', 'Belum Mengerjakan')
        }
      })

      return rowData
    })

    // Gabungkan dengan pemisah koma dan baris baru
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')

    // Tambahkan UTF-8 BOM (\uFEFF) agar Microsoft Excel membuka karakter huruf dan simbol dengan benar
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().split('T')[0]
    const cleanClassName = className.replace(/[^a-zA-Z0-9_-]/g, '_')

    link.setAttribute('href', url)
    link.setAttribute('download', `Rekap_Nilai_${cleanClassName}_${dateStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header & Navigasi */}
      <div>
        <Link
          href={`/teacher/kelas/${classId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Modul & Materi Kelas
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Rekap Nilai & Progres Siswa</h1>
              <Badge variant="outline" className="font-mono text-xs">
                Kelas: {className}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pantau penyelesaian materi pembelajaran, skor tertinggi kuis, dan jumlah percobaan per siswa.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10 shadow-sm"
              disabled={students.length === 0}
            >
              <Download className="h-4 w-4" /> Ekspor CSV ({filteredStudents.length})
            </Button>
            <Button asChild variant="secondary" className="gap-2">
              <Link href={`/teacher/kelas/${classId}`}>
                <BookOpen className="h-4 w-4" /> Kelola Modul
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Mapel Guru (jika guru mengajar > 1 mapel di kelas ini) */}
      {taughtSubjects.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-medium text-muted-foreground">Mapel:</span>
          <Button
            size="sm"
            variant={selectedSubjectId === 'all' ? 'default' : 'outline'}
            className="h-8 text-xs"
            asChild
          >
            <Link href={`/teacher/kelas/${classId}/nilai`}>Semua Mapel</Link>
          </Button>
          {taughtSubjects.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={selectedSubjectId === s.id ? 'default' : 'outline'}
              className="h-8 text-xs"
              asChild
            >
              <Link href={`/teacher/kelas/${classId}/nilai?subject=${s.id}`}>{s.name}</Link>
            </Button>
          ))}
        </div>
      )}

      {/* Kartu Ringkasan Metrik Kelas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Siswa Terdaftar</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_students}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Kode Kelas: {referralCode}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Rata-rata Progres Materi</CardTitle>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.average_material_progress}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Dari total {totalMaterialsInScope} materi pembelajaran
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Rata-rata Nilai Kuis</CardTitle>
            <Trophy className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.average_quiz_score > 0 ? summary.average_quiz_score : '-'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Tersedia {quizzesList.length} kuis pilihan ganda
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Lulus Seluruh Kuis</CardTitle>
            <GraduationCap className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {summary.passed_students_count}{' '}
              <span className="text-xs font-normal text-muted-foreground">/ {summary.total_students} siswa</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary.total_students > 0
                ? `${Math.round((summary.passed_students_count / summary.total_students) * 100)}% siswa tuntas`
                : 'Belum ada siswa'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kontrol Pencarian & Filter */}
      <Card className="shadow-sm border">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Input Pencarian Nama Siswa */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan nama atau email siswa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs sm:text-sm h-9"
              />
            </div>

            {/* Filter Kategori Status */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0"
                onClick={() => setStatusFilter('all')}
              >
                Semua ({students.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'attempted' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0"
                onClick={() => setStatusFilter('attempted')}
              >
                Sudah Kuis ({students.filter((s) => s.average_quiz_score !== null).length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'not_attempted' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0"
                onClick={() => setStatusFilter('not_attempted')}
              >
                Belum Kuis ({students.filter((s) => s.average_quiz_score === null).length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={statusFilter === 'all_passed' ? 'default' : 'outline'}
                className="h-8 text-xs shrink-0"
                onClick={() => setStatusFilter('all_passed')}
              >
                Tuntas Lulus ({students.filter((s) => s.all_quizzes_passed).length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabel Rekap Siswa */}
      <Card className="shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                <th className="py-3 px-3.5 w-12 text-center">No</th>
                <th className="py-3 px-3.5 min-w-[200px]">Nama Siswa</th>
                <th className="py-3 px-3.5 min-w-[170px]">Progres Materi</th>
                <th className="py-3 px-3.5 min-w-[120px] text-center">Rata-rata Kuis</th>
                <th className="py-3 px-3.5 min-w-[180px]">Status Kuis</th>
                <th className="py-3 px-3.5 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground/60" />
                      <p className="font-medium text-sm text-foreground">Tidak ada siswa ditemukan</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        {searchQuery
                          ? `Tidak ditemukan siswa yang cocok dengan kata kunci "${searchQuery}".`
                          : `Belum ada siswa yang mendaftar ke kelas ini. Bagikan kode referral kelas "${referralCode}" kepada siswa.`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const initial = s.full_name.charAt(0).toUpperCase() || 'S'
                  const totalAttempts = s.quizzes.reduce((acc, q) => acc + q.attempts_count, 0)

                  return (
                    <tr
                      key={s.student_id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedStudent(s)}
                    >
                      {/* No */}
                      <td className="py-3 px-3.5 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>

                      {/* Info Siswa */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-xs text-primary">
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground">{s.full_name}</div>
                            <div className="text-[11px] text-muted-foreground">{s.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Progres Materi */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium">
                              {s.completed_materials_count} / {s.total_materials_count} selesai
                            </span>
                            <span
                              className={`font-semibold ${
                                s.material_progress_percent === 100
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {s.material_progress_percent}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                s.material_progress_percent === 100 ? 'bg-emerald-500' : 'bg-primary'
                              }`}
                              style={{ width: `${s.material_progress_percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Rata-rata Skor Kuis */}
                      <td className="py-3 px-3.5 text-center">
                        {s.average_quiz_score !== null ? (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`font-bold font-mono text-sm ${
                                s.average_quiz_score >= 70
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {s.average_quiz_score}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <RotateCcw className="h-2.5 w-2.5" /> {totalAttempts}x coba
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Belum Kuis
                          </Badge>
                        )}
                      </td>

                      {/* Status Kuis */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-1">
                          {quizzesList.length === 0 ? (
                            <span className="text-muted-foreground text-[11px]">Belum ada kuis</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              {s.quizzes.map((q) => {
                                const isAttempted = q.highest_score !== null
                                return (
                                  <Badge
                                    key={q.quiz_id}
                                    variant={q.is_passed ? 'default' : isAttempted ? 'secondary' : 'outline'}
                                    className={`text-[10px] font-mono gap-1 ${
                                      q.is_passed
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        : isAttempted
                                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30'
                                        : 'text-muted-foreground'
                                    }`}
                                    title={`${q.quiz_title}: Skor tertinggi ${q.highest_score ?? '-'} (KKM: ${q.passing_score}) • ${q.attempts_count}x pengerjaan`}
                                  >
                                    {isAttempted ? (
                                      <span>{q.highest_score}</span>
                                    ) : (
                                      <span>-</span>
                                    )}
                                    {q.is_passed && <CheckCircle2 className="h-2.5 w-2.5" />}
                                  </Badge>
                                )
                              })}
                            </div>
                          )}

                          <div>
                            {s.all_quizzes_passed ? (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Lulus Semua Kuis
                              </span>
                            ) : s.average_quiz_score !== null ? (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                Sebagian kuis belum tuntas KKM
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Tombol Aksi */}
                      <td className="py-3 px-3.5 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedStudent(s)
                          }}
                        >
                          Detail <ChevronRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Detail Rekap Siswa */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent ? `Rekap Belajar: ${selectedStudent.full_name}` : 'Detail Siswa'}
        description={`Email: ${selectedStudent?.email || ''} • Terdaftar sejak ${
          selectedStudent ? new Date(selectedStudent.enrolled_at).toLocaleDateString('id-ID') : ''
        }`}
        maxWidth="lg"
      >
        {selectedStudent && (
          <div className="space-y-5">
            {/* Kartu Ringkasan Siswa */}
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
              <div>
                <span className="text-[11px] text-muted-foreground block">Progres Materi</span>
                <span className="text-base font-bold text-foreground">
                  {selectedStudent.completed_materials_count} / {selectedStudent.total_materials_count}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  ({selectedStudent.material_progress_percent}%)
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Rata-rata Nilai</span>
                <span className="text-base font-bold text-primary font-mono">
                  {selectedStudent.average_quiz_score !== null ? selectedStudent.average_quiz_score : '-'}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {selectedStudent.quizzes.filter((q) => q.highest_score !== null).length} kuis dikerjakan
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Status Kelulusan</span>
                <span
                  className={`text-xs font-bold block mt-1 ${
                    selectedStudent.all_quizzes_passed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {selectedStudent.all_quizzes_passed ? 'TUNTAS LULUS' : 'BELUM TUNTAS'}
                </span>
              </div>
            </div>

            {/* Rincian Hasil Kuis Siswa */}
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <FileQuestion className="h-3.5 w-3.5 text-primary" />
                Rincian Evaluasi Kuis ({selectedStudent.quizzes.length})
              </h4>

              {selectedStudent.quizzes.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  Belum ada kuis yang dibuat pada mapel ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStudent.quizzes.map((q) => {
                    const isAttempted = q.highest_score !== null

                    return (
                      <div
                        key={q.quiz_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-2 bg-card text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground block">{q.quiz_title}</span>
                          <span className="text-[11px] text-muted-foreground block">
                            Modul: {q.module_title} • KKM: {q.passing_score}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          {isAttempted ? (
                            <>
                              <div className="text-right">
                                <span className="font-mono font-bold text-sm block">
                                  {q.highest_score}
                                </span>
                                <span className="text-[10px] text-muted-foreground block">
                                  {q.attempts_count}x percobaan
                                </span>
                              </div>
                              <Badge
                                variant={q.is_passed ? 'default' : 'secondary'}
                                className={`text-[10px] font-semibold gap-1 ${
                                  q.is_passed ? 'bg-emerald-600 text-white' : 'text-amber-700 bg-amber-500/15'
                                }`}
                              >
                                {q.is_passed ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" /> Lulus
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3" /> Remedial
                                  </>
                                )}
                              </Badge>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Belum Dikerjakan
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setSelectedStudent(null)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
