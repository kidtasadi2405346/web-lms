'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import {
  parseEmbedUrl,
  ALLOWED_SIMULATION_DOMAINS,
} from '@/lib/simulations/embed'
import {
  createSimulationAction,
  updateSimulationAction,
  deleteSimulationAction,
  reorderSimulationsAction,
} from '@/lib/actions/simulation'
import type { SimulationItem } from '@/lib/types'
import {
  Cpu,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

interface SimulationManagerModalProps {
  isOpen: boolean
  onClose: () => void
  materialId: string
  materialTitle: string
  classId: string
  initialSimulations: SimulationItem[]
}

export function SimulationManagerModal({
  isOpen,
  onClose,
  materialId,
  materialTitle,
  classId,
  initialSimulations,
}: SimulationManagerModalProps) {
  const router = useRouter()
  const [simulations, setSimulations] = useState<SimulationItem[]>(initialSimulations)
  const [editingSimulation, setEditingSimulation] = useState<SimulationItem | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync state if initialSimulations changes
  if (initialSimulations !== simulations && !isAdding && !editingSimulation) {
    setSimulations(initialSimulations)
  }

  const resetForm = () => {
    setTitle('')
    setUrl('')
    setErrorMsg(null)
    setIsAdding(false)
    setEditingSimulation(null)
  }

  const handleStartAdd = () => {
    resetForm()
    setIsAdding(true)
  }

  const handleStartEdit = (sim: SimulationItem) => {
    resetForm()
    setEditingSimulation(sim)
    setTitle(sim.title)
    setUrl(sim.config?.url || '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const trimmedTitle = title.trim()
    const trimmedUrl = url.trim()

    if (!trimmedTitle) {
      setErrorMsg('Judul simulasi wajib diisi.')
      return
    }

    if (!trimmedUrl) {
      setErrorMsg('URL embed simulasi wajib diisi.')
      return
    }

    // Client-side quick check
    const clientCheck = parseEmbedUrl(trimmedUrl)
    if (!clientCheck.ok) {
      setErrorMsg(clientCheck.reason)
      return
    }

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('material_id', materialId)
    formData.append('title', trimmedTitle)
    formData.append('url', trimmedUrl)
    formData.append('class_id', classId)

    try {
      if (editingSimulation) {
        const res = await updateSimulationAction(
          editingSimulation.id,
          materialId,
          formData,
          classId,
        )
        if (res.error) {
          setErrorMsg(res.error)
          setIsSubmitting(false)
          return
        }
      } else {
        const res = await createSimulationAction(formData)
        if (res.error) {
          setErrorMsg(res.error)
          setIsSubmitting(false)
          return
        }
      }

      resetForm()
      router.refresh()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (simId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus simulasi ini?')) return

    setIsSubmitting(true)
    try {
      const res = await deleteSimulationAction(simId, materialId, classId)
      if (res.error) {
        alert(res.error)
        setIsSubmitting(false)
        return
      }
      setSimulations((prev) => prev.filter((s) => s.id !== simId))
      router.refresh()
    } catch (err) {
      alert('Gagal menghapus simulasi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= simulations.length) return

    const newSims = [...simulations]
    const currentItem = newSims[index]
    const targetItem = newSims[targetIndex]
    if (!currentItem || !targetItem) return

    newSims[index] = targetItem
    newSims[targetIndex] = currentItem

    setSimulations(newSims)
    const orderedIds = newSims.map((s) => s.id)

    const res = await reorderSimulationsAction(materialId, orderedIds, classId)
    if (res.error) {
      alert(res.error)
      // Rollback
      setSimulations(simulations)
    } else {
      router.refresh()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm()
        onClose()
      }}
      title={`Kelola Simulasi: ${materialTitle}`}
      description="Tambahkan simulasi interaktif (PhET, Falstad, Tinkercad) ke dalam materi pembelajaran."
      maxWidth="2xl"
    >
      <div className="space-y-5 py-2">
        {/* Banner Domain yang diizinkan */}
        <div className="rounded-lg border bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Cpu className="h-4 w-4 text-primary" /> Daftar Domain Simulasi yang Diizinkan:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ALLOWED_SIMULATION_DOMAINS.map((domain) => (
              <Badge key={domain} variant="secondary" className="font-mono text-xs">
                https://{domain}
              </Badge>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Contoh: PhET Interactive Simulations, Sirkuit Elektronika Falstad, atau 3D/Circuits Tinkercad.
          </p>
        </div>

        {/* Form Tambah/Edit Simulasi */}
        {(isAdding || editingSimulation) ? (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4 bg-card">
            <div className="flex items-center justify-between pb-2 border-b">
              <h4 className="text-sm font-semibold text-foreground">
                {editingSimulation ? 'Ubah Simulasi' : 'Tambah Simulasi Baru'}
              </h4>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm} disabled={isSubmitting}>
                Batal
              </Button>
            </div>

            {errorMsg && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{errorMsg}</p>
                  <p className="text-[11px] opacity-90">
                    Pastikan URL dimulai dengan <code>https://</code> dan berasal dari salah satu domain: {ALLOWED_SIMULATION_DOMAINS.join(', ')}.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="sim-title" className="text-xs">
                Judul Simulasi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sim-title"
                placeholder="Contoh: Simulasi Rangkaian RLC AC PhET"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                className="text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sim-url" className="text-xs">
                URL Embed Simulasi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sim-url"
                type="url"
                placeholder="https://phet.colorado.edu/sims/html/... atau https://falstad.com/circuit/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isSubmitting}
                className="text-sm font-mono text-xs"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Gunakan tautan langsung embed simulasi dari PhET, Falstad, atau Tinkercad.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={isSubmitting}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingSimulation ? 'Simpan Perubahan' : 'Tambahkan Simulasi'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleStartAdd}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah Simulasi
            </Button>
          </div>
        )}

        {/* Daftar Simulasi */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Daftar Simulasi ({simulations.length})
          </h4>

          {simulations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              Belum ada simulasi embed untuk materi ini. Klik <strong>&quot;Tambah Simulasi&quot;</strong> di atas.
            </div>
          ) : (
            <div className="space-y-2">
              {simulations.map((sim, index) => (
                <div
                  key={sim.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{sim.title}</p>
                      <a
                        href={sim.config?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 font-mono truncate max-w-sm mt-0.5"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{sim.config?.url}</span>
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0 || isSubmitting}
                      title="Pindahkan ke atas"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === simulations.length - 1 || isSubmitting}
                      title="Pindahkan ke bawah"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleStartEdit(sim)}
                      disabled={isSubmitting}
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(sim.id)}
                      disabled={isSubmitting}
                      title="Hapus Simulasi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
