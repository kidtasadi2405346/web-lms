'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { BookOpen, Edit2, Plus, Trash2 } from 'lucide-react'
import { createSubjectAction, updateSubjectAction, deleteSubjectAction } from '@/lib/actions/admin'

type SubjectData = {
  id: string
  name: string
  created_at: string
}

export function SubjectsManager({ initialSubjects }: { initialSubjects: SubjectData[] }) {
  const [subjects] = useState<SubjectData[]>(initialSubjects)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SubjectData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SubjectData | null>(null)

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAddModal() {
    setName('')
    setError(null)
    setIsAddOpen(true)
  }

  function openEditModal(s: SubjectData) {
    setEditTarget(s)
    setName(s.name)
    setError(null)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', name)

    const res = await createSubjectAction(formData)
    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setIsAddOpen(false)
    window.location.reload()
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editTarget) return

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', name)

    const res = await updateSubjectAction(editTarget.id, formData)
    setLoading(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setEditTarget(null)
    window.location.reload()
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setLoading(true)
    setError(null)

    const res = await deleteSubjectAction(deleteTarget.id)
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
          <h1 className="text-2xl font-bold tracking-tight">Mata Pelajaran</h1>
          <p className="text-sm text-muted-foreground">
            Kelola daftar mata pelajaran yang diajarkan di sekolah.
          </p>
        </div>
        <Button onClick={openAddModal} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Mata Pelajaran
        </Button>
      </div>

      {subjects.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-2">Belum ada mata pelajaran</CardTitle>
            <CardDescription>
              Tambahkan mata pelajaran untuk mulai menugaskan guru dan membuat materi modul.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openAddModal} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Buat Mata Pelajaran Baru
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((sub) => (
            <Card key={sub.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{sub.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-end gap-1 border-t pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => openEditModal(sub)}
                >
                  <Edit2 className="h-3.5 w-3.5" /> Ubah
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(sub)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tambah Mapel */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Tambah Mata Pelajaran"
        description="Masukkan nama mata pelajaran baru."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="sub-name">Nama Mata Pelajaran</Label>
            <Input
              id="sub-name"
              placeholder="Contoh: Matematika, Fisika, Bahasa Indonesia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Mapel */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Ubah Mata Pelajaran"
        description="Perbarui nama mata pelajaran."
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="edit-sub-name">Nama Mata Pelajaran</Label>
            <Input
              id="edit-sub-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Memperbarui...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Mapel */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Mata Pelajaran"
        description="Apakah Anda yakin ingin menghapus mata pelajaran ini?"
      >
        <div className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
          <p className="text-sm">
            Mata pelajaran <strong>{deleteTarget?.name}</strong> akan dihapus. Perhatian: modul dan penugasan yang
            menggunakan mata pelajaran ini juga akan terhapus.
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
