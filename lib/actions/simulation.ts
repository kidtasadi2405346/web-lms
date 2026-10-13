'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { simulationEmbedConfigSchema, ALLOWED_SIMULATION_DOMAINS } from '@/lib/simulations/embed'
import type { SimulationItem } from '@/lib/types'

export type ActionState = {
  success?: boolean
  error?: string | null
  data?: any
}

const ALLOWED_DOMAINS_TEXT = ALLOWED_SIMULATION_DOMAINS.join(', ')

/**
 * Mengambil daftar simulasi untuk suatu materi.
 * Memakai client Supabase user sehingga RLS berlaku penuh (siswa harus lulus materi sebelumnya, guru harus ditugaskan).
 */
export async function listSimulationsByMaterial(materialId: string): Promise<SimulationItem[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('material_id', materialId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Gagal mengambil daftar simulasi:', error.message)
      return []
    }

    return (data as SimulationItem[]) || []
  } catch (err) {
    console.error('Kesalahan sistem listSimulationsByMaterial:', err)
    return []
  }
}

/**
 * Membuat simulasi embed baru untuk materi.
 * Wajib divalidasi dengan Zod schema di server.
 */
export async function createSimulationAction(formData: FormData): Promise<ActionState> {
  try {
    const profile = await requireRole('teacher')
    const supabase = await createClient()

    const materialId = (formData.get('material_id') as string)?.trim()
    const title = (formData.get('title') as string)?.trim()
    const urlRaw = (formData.get('url') as string)?.trim()
    const classId = (formData.get('class_id') as string)?.trim()

    if (!materialId) {
      return { error: 'ID Materi tidak valid.' }
    }
    if (!title) {
      return { error: 'Judul simulasi wajib diisi.' }
    }
    if (!urlRaw) {
      return { error: `URL embed simulasi wajib diisi. Domain yang diizinkan: ${ALLOWED_DOMAINS_TEXT}` }
    }

    // Validasi Zod di sisi server
    const parseResult = simulationEmbedConfigSchema.safeParse({ url: urlRaw })
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'URL embed simulasi tidak valid.'
      return {
        error: `${msg} Domain yang diizinkan: ${ALLOWED_DOMAINS_TEXT}`,
      }
    }

    // Dapatkan urutan order_index berikutnya
    const { data: lastSim } = await supabase
      .from('simulations')
      .select('order_index')
      .eq('material_id', materialId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (lastSim?.order_index ?? -1) + 1

    const { error: insertError } = await supabase.from('simulations').insert({
      material_id: materialId,
      title,
      type: 'embed',
      config: { url: parseResult.data.url },
      order_index: nextOrder,
      created_by: profile.id,
    })

    if (insertError) {
      return { error: `Gagal menyimpan simulasi: ${insertError.message}` }
    }

    if (classId) {
      revalidatePath(`/teacher/kelas/${classId}`)
    }
    revalidatePath(`/student/materi/${materialId}`)

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat membuat simulasi.' }
  }
}

/**
 * Memperbarui data simulasi (judul & URL embed).
 * Wajib divalidasi dengan Zod schema di server.
 */
export async function updateSimulationAction(
  simulationId: string,
  materialId: string,
  formData: FormData,
  classId?: string,
): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const title = (formData.get('title') as string)?.trim()
    const urlRaw = (formData.get('url') as string)?.trim()

    if (!title) {
      return { error: 'Judul simulasi wajib diisi.' }
    }
    if (!urlRaw) {
      return { error: `URL embed simulasi wajib diisi. Domain yang diizinkan: ${ALLOWED_DOMAINS_TEXT}` }
    }

    // Validasi Zod di sisi server
    const parseResult = simulationEmbedConfigSchema.safeParse({ url: urlRaw })
    if (!parseResult.success) {
      const msg = parseResult.error.issues[0]?.message || 'URL embed simulasi tidak valid.'
      return {
        error: `${msg} Domain yang diizinkan: ${ALLOWED_DOMAINS_TEXT}`,
      }
    }

    const { error: updateError } = await supabase
      .from('simulations')
      .update({
        title,
        config: { url: parseResult.data.url },
      })
      .eq('id', simulationId)

    if (updateError) {
      return { error: `Gagal memperbarui simulasi: ${updateError.message}` }
    }

    if (classId) {
      revalidatePath(`/teacher/kelas/${classId}`)
    }
    revalidatePath(`/student/materi/${materialId}`)

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memperbarui simulasi.' }
  }
}

/**
 * Menghapus simulasi dari materi.
 */
export async function deleteSimulationAction(
  simulationId: string,
  materialId: string,
  classId?: string,
): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const { error: deleteError } = await supabase
      .from('simulations')
      .delete()
      .eq('id', simulationId)

    if (deleteError) {
      return { error: `Gagal menghapus simulasi: ${deleteError.message}` }
    }

    if (classId) {
      revalidatePath(`/teacher/kelas/${classId}`)
    }
    revalidatePath(`/student/materi/${materialId}`)

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menghapus simulasi.' }
  }
}

/**
 * Mengubah urutan simulasi dalam satu materi.
 */
export async function reorderSimulationsAction(
  materialId: string,
  orderedIds: string[],
  classId?: string,
): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    if (!orderedIds || orderedIds.length === 0) {
      return { success: true }
    }

    // Perbarui urutan satu per satu sesuai index
    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index]
      const { error } = await supabase
        .from('simulations')
        .update({ order_index: index })
        .eq('id', id)
        .eq('material_id', materialId)

      if (error) {
        return { error: `Gagal memperbarui urutan simulasi: ${error.message}` }
      }
    }

    if (classId) {
      revalidatePath(`/teacher/kelas/${classId}`)
    }
    revalidatePath(`/student/materi/${materialId}`)

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat mengubah urutan simulasi.' }
  }
}
