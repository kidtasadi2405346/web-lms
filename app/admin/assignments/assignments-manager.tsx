'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, UserCheck, BookOpen, School, User } from 'lucide-react'
import { createAssignmentAction, deleteAssignmentAction } from '@/lib/actions/admin'

type AssignmentData = {
  id: string
  teacher_id: string
  teacher_name: string
  teacher_nip: string
  subject_id: string
  subject_name: string
  class_id: string
  class_name: string
  referral_code: string
}

type Option = { id: string; name: string; extra?: string }

interface AssignmentsManagerProps {
  initialAssignments: AssignmentData[]
  teachers: Option[]
  subjects: Option[]
  classes: Option[]
}

export function AssignmentsManager({
  initialAssignments,
  teachers,
  subjects,
  classes,
}: AssignmentsManagerProps) {
  const [assignments] = useState<AssignmentData[]>(initialAssignments)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AssignmentData | null>(null)

  const [teacherId, setTeacherId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [classId, setClassId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAddModal() {
    setTeacherId(teachers[0]?.id || '')
    setSubjectId(subjects[0]?.id || '')
    setClassId(classes[0]?.id || '')
    setError(null)
    setIsAddOpen(true)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('teacher_id', teacherId)
    formData.append('subject_id', subjectId)
    formData.append('class_id', classId)

    const res = await createAssignmentAction(formData)
    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setIsAddOpen(false)
    window.location.reload()
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setLoading(true)
    setError(null)

    const res = await deleteAssignmentAction(deleteTarget.id)
    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setDeleteTarget(null)
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Penugasan Guru</h1>
          <p className="text-sm text-muted-foreground">
            Atur guru yang mengajar mata pelajaran tertentu di kelas yang ditentukan.
          </p>
        </div>
        <Button onClick={openAddModal} className="gap-2" disabled={teachers.length === 0 || subjects.length === 0 || classes.length === 0}>
          <Plus className="h-4 w-4" /> Tambah Penugasan
        </Button>
      </div>

      {teachers.length === 0 || subjects.length === 0 || classes.length === 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base text-amber-600 dark:text-amber-400">Data Master Belum Lengkap</CardTitle>
            <CardDescription>
              Untuk membuat penugasan guru, pastikan minimal ada 1 Kelas, 1 Mata Pelajaran, dan 1 Akun Guru yang sudah dibuat di sistem.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {assignments.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <UserCheck className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-2">Belum ada penugasan guru</CardTitle>
            <CardDescription>
              Tugaskan guru ke kelas dan mata pelajaran agar guru dapat mulai membuat modul belajar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openAddModal} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Tugaskan Guru Sekarang
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <Card key={a.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-primary" />
                      {a.subject_name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1 flex items-center gap-1">
                      <School className="h-3.5 w-3.5" /> Kelas {a.class_name}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {a.referral_code}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2.5 text-xs">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-foreground">{a.teacher_name}</p>
                    <p className="font-mono text-muted-foreground">NIP: {a.teacher_nip}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end border-t pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus Penugasan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tambah Penugasan */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Tambah Penugasan Guru"
        description="Pilih guru, mata pelajaran, dan kelas target."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="sel-teacher">Pilih Guru</Label>
            <select
              id="sel-teacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (NIP: {t.extra})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sel-subject">Pilih Mata Pelajaran</Label>
            <select
              id="sel-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sel-class">Pilih Kelas</Label>
            <select
              id="sel-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              required
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Kode: {c.extra})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Tugaskan Guru'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Penugasan */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Penugasan Guru"
        description="Apakah Anda yakin ingin membatalkan penugasan ini?"
      >
        <div className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
          <p className="text-sm">
            Penugasan guru <strong>{deleteTarget?.teacher_name}</strong> untuk mata pelajaran{' '}
            <strong>{deleteTarget?.subject_name}</strong> di kelas <strong>{deleteTarget?.class_name}</strong> akan
            dihapus.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
