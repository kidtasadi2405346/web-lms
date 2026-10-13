'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Users, KeyRound } from 'lucide-react'
import { createTeacherAccountAction, deleteTeacherAction } from '@/lib/actions/admin'

type TeacherData = {
  id: string
  name: string
  identity_number: string
  created_at: string
  assignment_count: number
}

export function TeachersManager({ initialTeachers }: { initialTeachers: TeacherData[] }) {
  const [teachers] = useState<TeacherData[]>(initialTeachers)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TeacherData | null>(null)

  const [name, setName] = useState('')
  const [nip, setNip] = useState('')
  const [password, setPassword] = useState('guru123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAddModal() {
    setName('')
    setNip('')
    setPassword('guru123')
    setError(null)
    setIsAddOpen(true)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', name)
    formData.append('nip', nip)
    formData.append('password', password)

    const res = await createTeacherAccountAction(formData)
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

    const res = await deleteTeacherAction(deleteTarget.id)
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
          <h1 className="text-2xl font-bold tracking-tight">Akun Guru</h1>
          <p className="text-sm text-muted-foreground">
            Daftarkan akun staf guru baru dan kelola data pengajar sekolah.
          </p>
        </div>
        <Button onClick={openAddModal} className="gap-2">
          <Plus className="h-4 w-4" /> Buat Akun Guru
        </Button>
      </div>

      {teachers.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-2">Belum ada guru terdaftar</CardTitle>
            <CardDescription>
              Buat akun guru pertama untuk menugaskan mata pelajaran dan pengelolaan modul.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openAddModal} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Daftarkan Guru Baru
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => (
            <Card key={t.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {t.assignment_count} Penugasan Kelas/Mapel
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    NIP: {t.identity_number}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <span>Login dengan NIP: <strong className="text-foreground">{t.identity_number}</strong></span>
                </div>

                <div className="flex items-center justify-end border-t pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus Akun
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tambah Guru */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Buat Akun Guru Baru"
        description="Lengkapi nama, NIP, dan password awal untuk akun guru."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="t-name">Nama Lengkap Guru (beserta gelar)</Label>
            <Input
              id="t-name"
              placeholder="Contoh: Dra. Siti Rahmawati, M.Pd."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-nip">NIP / Nomor Identitas Pegawai (3–30 karakter)</Label>
            <Input
              id="t-nip"
              placeholder="Contoh: 198503152010012003 atau GURU01"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Nomor ini akan digunakan guru sebagai username login di halaman masuk.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-pwd">Password Awal (minimal 6 karakter)</Label>
            <Input
              id="t-pwd"
              type="text"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Berikan password ini kepada guru terkait untuk login pertama kali.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Mendaftarkan...' : 'Daftarkan Akun Guru'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Guru */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Akun Guru"
        description="Apakah Anda yakin ingin menghapus akun guru ini?"
      >
        <div className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
          <p className="text-sm">
            Guru <strong>{deleteTarget?.name}</strong> (NIP: {deleteTarget?.identity_number}) akan dihapus.
            Seluruh penugasan mengajar dan modul yang dibuat guru ini mungkin terpengaruh.
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
