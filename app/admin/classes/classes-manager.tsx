'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Check, Copy, Edit2, Plus, School, Trash2 } from 'lucide-react'
import { createClassAction, updateClassAction, deleteClassAction } from '@/lib/actions/admin'

type ClassData = {
  id: string
  name: string
  referral_code: string
  created_at: string
  student_count: number
}

export function ClassesManager({ initialClasses }: { initialClasses: ClassData[] }) {
  const [classes] = useState<ClassData[]>(initialClasses)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ClassData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClassData | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAddModal() {
    setName('')
    setReferralCode('')
    setError(null)
    setIsAddOpen(true)
  }

  function openEditModal(c: ClassData) {
    setEditTarget(c)
    setName(c.name)
    setReferralCode(c.referral_code)
    setError(null)
  }

  function generateCode(nameVal: string) {
    const sanitized = nameVal.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    setReferralCode(`${sanitized || 'CLS'}-${suffix}`)
  }

  async function handleCopy(code: string) {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', name)
    formData.append('referral_code', referralCode)

    const res = await createClassAction(formData)
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
    formData.append('referral_code', referralCode)

    const res = await updateClassAction(editTarget.id, formData)
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

    const res = await deleteClassAction(deleteTarget.id)
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
          <h1 className="text-2xl font-bold tracking-tight">Kelola Kelas</h1>
          <p className="text-sm text-muted-foreground">
            Tambah, ubah, dan bagikan kode referral kelas untuk pendaftaran mandiri siswa.
          </p>
        </div>
        <Button onClick={openAddModal} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Kelas
        </Button>
      </div>

      {classes.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <School className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mt-2">Belum ada kelas</CardTitle>
            <CardDescription>
              Buat kelas pertama untuk mulai menerima pendaftaran siswa dan penugasan guru.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openAddModal} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Buat Kelas Baru
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id} className="relative overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{cls.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {cls.student_count} Siswa Terdaftar
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {cls.referral_code}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-2 text-xs">
                  <span className="text-muted-foreground">Kode Siswa:</span>
                  <div className="flex items-center gap-1.5 font-mono font-semibold">
                    <span>{cls.referral_code}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleCopy(cls.referral_code)}
                      title="Salin Kode Referral"
                    >
                      {copiedCode === cls.referral_code ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => openEditModal(cls)}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Ubah
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTarget(cls)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Tambah Kelas */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Tambah Kelas Baru"
        description="Buat kelas baru beserta kode referral unik untuk pendaftaran siswa."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="name">Nama Kelas</Label>
            <Input
              id="name"
              placeholder="Contoh: X IPA 1, XII IPS 2"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!referralCode) generateCode(e.target.value)
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="referral_code">Kode Referral (4–20 Karakter Huruf Besar)</Label>
              <button
                type="button"
                className="text-xs text-primary underline hover:text-primary/80"
                onClick={() => generateCode(name)}
              >
                Acak Kode
              </button>
            </div>
            <Input
              id="referral_code"
              placeholder="Contoh: XIPA1-2026"
              className="font-mono uppercase"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              required
            />
            <p className="text-xs text-muted-foreground">
              Siswa wajib memasukkan kode ini saat mendaftar akun di form registrasi.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Kelas'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Kelas */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Ubah Data Kelas"
        description="Perbarui nama kelas atau kode referral."
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

          <div className="space-y-2">
            <Label htmlFor="edit-name">Nama Kelas</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-referral_code">Kode Referral</Label>
            <Input
              id="edit-referral_code"
              className="font-mono uppercase"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
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

      {/* Modal Hapus Kelas */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Kelas"
        description="Apakah Anda yakin ingin menghapus kelas ini?"
      >
        <div className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
          <p className="text-sm">
            Kelas <strong>{deleteTarget?.name}</strong> akan dihapus. Perhatian: Jika masih ada siswa terdaftar,
            penghapusan mungkin ditolak oleh basis data untuk menjaga integritas data siswa.
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
