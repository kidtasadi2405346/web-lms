'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export type ActionState = {
  success?: boolean
  error?: string | null
}

// ==============================================================================
// 1. MODUL (CRUD)
// ==============================================================================

export async function createModuleAction(formData: FormData): Promise<ActionState> {
  try {
    const profile = await requireRole('teacher')
    const supabase = await createClient()

    const classId = (formData.get('class_id') as string)?.trim()
    const subjectId = (formData.get('subject_id') as string)?.trim()
    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null

    if (!classId || !subjectId) return { error: 'Kelas dan Mata Pelajaran wajib ditentukan.' }
    if (!title) return { error: 'Judul modul wajib diisi.' }

    // Ambil order_index terakhir di kelas dan mapel ini
    const { data: lastModule } = await supabase
      .from('modules')
      .select('order_index')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (lastModule?.order_index ?? -1) + 1

    const { error } = await supabase.from('modules').insert({
      class_id: classId,
      subject_id: subjectId,
      title,
      description,
      order_index: nextOrder,
      created_by: profile.id,
    })

    if (error) return { error: error.message }

    revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function updateModuleAction(moduleId: string, classId: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null

    if (!title) return { error: 'Judul modul wajib diisi.' }

    const { error } = await supabase
      .from('modules')
      .update({ title, description })
      .eq('id', moduleId)

    if (error) return { error: error.message }

    revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteModuleAction(moduleId: string, classId: string): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const { error } = await supabase.from('modules').delete().eq('id', moduleId)
    if (error) return { error: error.message }

    revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

// ==============================================================================
// 2. MATERI (CRUD)
// ==============================================================================

export async function createMaterialAction(formData: FormData): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const classId = (formData.get('class_id') as string)?.trim()
    const moduleId = (formData.get('module_id') as string)?.trim()
    const title = (formData.get('title') as string)?.trim()
    const content = (formData.get('content') as string)?.trim() || ''
    const videoUrl = (formData.get('video_url') as string)?.trim() || null

    if (!moduleId) return { error: 'Modul wajib ditentukan.' }
    if (!title) return { error: 'Judul materi wajib diisi.' }

    // Ambil order_index terakhir di modul ini
    const { data: lastMaterial } = await supabase
      .from('materials')
      .select('order_index')
      .eq('module_id', moduleId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (lastMaterial?.order_index ?? -1) + 1

    const { error } = await supabase.from('materials').insert({
      module_id: moduleId,
      title,
      content,
      video_url: videoUrl,
      order_index: nextOrder,
    })

    if (error) return { error: error.message }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function updateMaterialAction(materialId: string, classId: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const title = (formData.get('title') as string)?.trim()
    const content = (formData.get('content') as string)?.trim() || ''
    const videoUrl = (formData.get('video_url') as string)?.trim() || null

    if (!title) return { error: 'Judul materi wajib diisi.' }

    const { error } = await supabase
      .from('materials')
      .update({
        title,
        content,
        video_url: videoUrl,
      })
      .eq('id', materialId)

    if (error) return { error: error.message }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteMaterialAction(materialId: string, classId: string): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const { error } = await supabase.from('materials').delete().eq('id', materialId)
    if (error) return { error: error.message }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}
