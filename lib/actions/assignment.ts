'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { DeadlineRuleType, SubmissionType } from '@/lib/types'

export type AssignmentActionState = {
  success?: boolean
  error?: string | null
  message?: string | null
  isLate?: boolean
  submissionId?: string
  signedUrl?: string
}

// ==============================================================================
// 1. GURU: CRUD TUGAS (ASSIGNMENTS)
// ==============================================================================

export async function createAssignmentAction(formData: FormData): Promise<AssignmentActionState> {
  try {
    const profile = await requireRole('teacher')
    const supabase = await createClient()

    const classId = (formData.get('class_id') as string)?.trim()
    const subjectId = (formData.get('subject_id') as string)?.trim()
    const materialId = (formData.get('material_id') as string)?.trim() || null
    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const submissionType = (formData.get('submission_type') as string)?.trim() as SubmissionType
    const deadlineRule = (formData.get('deadline_rule') as string)?.trim() as DeadlineRuleType
    const openAtStr = (formData.get('open_at') as string)?.trim()
    const dueAtStr = (formData.get('due_at') as string)?.trim()
    const closeAtStr = (formData.get('close_at') as string)?.trim() || null
    const latePenalty = parseInt((formData.get('late_penalty_percent') as string) || '0', 10)
    const maxScore = parseInt((formData.get('max_score') as string) || '100', 10)

    if (!classId || !subjectId) return { error: 'Kelas dan Mata Pelajaran wajib ditentukan.' }
    if (!title) return { error: 'Judul tugas wajib diisi.' }
    if (!openAtStr || !dueAtStr) return { error: 'Waktu buka dan tenggat waktu (due_at) wajib diisi.' }

    const openAt = new Date(openAtStr)
    const dueAt = new Date(dueAtStr)

    if (openAt >= dueAt) {
      return { error: 'Waktu buka harus lebih awal dari tenggat waktu (due_at).' }
    }

    let allowLate = true
    let closeAt: string | null = null

    if (deadlineRule === 'strict') {
      allowLate = false
      closeAt = null
    } else if (deadlineRule === 'with_close') {
      allowLate = true
      if (!closeAtStr) {
        return { error: 'Batas akhir (close_at) wajib diisi untuk mode Dengan Batas Akhir.' }
      }
      const closeDate = new Date(closeAtStr)
      if (closeDate < dueAt) {
        return { error: 'Batas akhir (close_at) harus sama atau setelah tenggat waktu (due_at).' }
      }
      closeAt = closeDate.toISOString()
    } else {
      // flexible
      allowLate = true
      closeAt = null
    }

    const { error } = await supabase.from('assignments').insert({
      class_id: classId,
      subject_id: subjectId,
      material_id: materialId,
      title,
      description,
      submission_type: submissionType || 'both',
      open_at: openAt.toISOString(),
      due_at: dueAt.toISOString(),
      close_at: closeAt,
      allow_late: allowLate,
      late_penalty_percent: isNaN(latePenalty) ? 0 : Math.min(100, Math.max(0, latePenalty)),
      max_score: isNaN(maxScore) || maxScore <= 0 ? 100 : maxScore,
      created_by: profile.id,
    })

    if (error) return { error: error.message }

    revalidatePath(`/teacher/kelas/${classId}/tugas`)
    revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true, message: 'Tugas berhasil dibuat.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function updateAssignmentAction(
  assignmentId: string,
  classId: string,
  formData: FormData,
): Promise<AssignmentActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const materialId = (formData.get('material_id') as string)?.trim() || null
    const submissionType = (formData.get('submission_type') as string)?.trim() as SubmissionType
    const deadlineRule = (formData.get('deadline_rule') as string)?.trim() as DeadlineRuleType
    const openAtStr = (formData.get('open_at') as string)?.trim()
    const dueAtStr = (formData.get('due_at') as string)?.trim()
    const closeAtStr = (formData.get('close_at') as string)?.trim() || null
    const latePenalty = parseInt((formData.get('late_penalty_percent') as string) || '0', 10)
    const maxScore = parseInt((formData.get('max_score') as string) || '100', 10)

    if (!title) return { error: 'Judul tugas wajib diisi.' }
    if (!openAtStr || !dueAtStr) return { error: 'Waktu buka dan tenggat waktu wajib diisi.' }

    const openAt = new Date(openAtStr)
    const dueAt = new Date(dueAtStr)

    if (openAt >= dueAt) {
      return { error: 'Waktu buka harus lebih awal dari tenggat waktu (due_at).' }
    }

    let allowLate = true
    let closeAt: string | null = null

    if (deadlineRule === 'strict') {
      allowLate = false
      closeAt = null
    } else if (deadlineRule === 'with_close') {
      allowLate = true
      if (!closeAtStr) {
        return { error: 'Batas akhir (close_at) wajib diisi untuk mode Dengan Batas Akhir.' }
      }
      const closeDate = new Date(closeAtStr)
      if (closeDate < dueAt) {
        return { error: 'Batas akhir (close_at) harus sama atau setelah tenggat waktu (due_at).' }
      }
      closeAt = closeDate.toISOString()
    } else {
      allowLate = true
      closeAt = null
    }

    const { error } = await supabase
      .from('assignments')
      .update({
        title,
        description,
        material_id: materialId,
        submission_type: submissionType || 'both',
        open_at: openAt.toISOString(),
        due_at: dueAt.toISOString(),
        close_at: closeAt,
        allow_late: allowLate,
        late_penalty_percent: isNaN(latePenalty) ? 0 : Math.min(100, Math.max(0, latePenalty)),
        max_score: isNaN(maxScore) || maxScore <= 0 ? 100 : maxScore,
      })
      .eq('id', assignmentId)

    if (error) return { error: error.message }

    revalidatePath(`/teacher/kelas/${classId}/tugas`)
    revalidatePath(`/teacher/tugas/${assignmentId}`)
    return { success: true, message: 'Tugas berhasil diperbarui.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteAssignmentAction(assignmentId: string, classId: string): Promise<AssignmentActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId)
    if (error) return { error: error.message }

    revalidatePath(`/teacher/kelas/${classId}/tugas`)
    return { success: true, message: 'Tugas berhasil dihapus.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

// ==============================================================================
// 2. GURU: PENILAIAN SUBMISSION & PERPANJANGAN (EXTENSIONS)
// ==============================================================================

export async function gradeSubmissionAction(
  submissionId: string,
  assignmentId: string,
  formData: FormData,
): Promise<AssignmentActionState> {
  try {
    const profile = await requireRole('teacher')
    const supabase = await createClient()

    const scoreRaw = formData.get('score') as string
    const feedback = (formData.get('feedback') as string)?.trim() || null

    if (scoreRaw === null || scoreRaw === undefined || scoreRaw.trim() === '') {
      return { error: 'Nilai wajib diisi.' }
    }

    const score = parseFloat(scoreRaw)
    if (isNaN(score) || score < 0) {
      return { error: 'Nilai harus berupa angka tidak negatif.' }
    }

    const { error } = await supabase
      .from('submissions')
      .update({
        score,
        feedback,
        graded_by: profile.id,
        graded_at: new Date().toISOString(),
      })
      .eq('id', submissionId)

    if (error) return { error: error.message }

    revalidatePath(`/teacher/tugas/${assignmentId}`)
    return { success: true, message: 'Nilai dan komentar berhasil disimpan.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function grantExtensionAction(
  assignmentId: string,
  studentId: string,
  formData: FormData,
): Promise<AssignmentActionState> {
  try {
    const profile = await requireRole('teacher')
    const supabase = await createClient()

    const newDueAtStr = (formData.get('new_due_at') as string)?.trim()
    const reason = (formData.get('reason') as string)?.trim() || null

    if (!newDueAtStr) {
      return { error: 'Batas waktu baru (new_due_at) wajib diisi.' }
    }

    const newDueAt = new Date(newDueAtStr)

    const { error } = await supabase.from('assignment_extensions').upsert({
      assignment_id: assignmentId,
      student_id: studentId,
      new_due_at: newDueAt.toISOString(),
      reason,
      granted_by: profile.id,
      created_at: new Date().toISOString(),
    })

    if (error) return { error: error.message }

    revalidatePath(`/teacher/tugas/${assignmentId}`)
    return { success: true, message: 'Perpanjangan batas waktu berhasil diberikan.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteExtensionAction(
  assignmentId: string,
  studentId: string,
): Promise<AssignmentActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const { error } = await supabase
      .from('assignment_extensions')
      .delete()
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)

    if (error) return { error: error.message }

    revalidatePath(`/teacher/tugas/${assignmentId}`)
    return { success: true, message: 'Perpanjangan batas waktu berhasil dicabut.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

/**
 * Generate signed URL agar guru atau siswa dapat mengunduh berkas submissions.
 */
export async function getSubmissionSignedUrl(filePath: string): Promise<AssignmentActionState> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('submissions')
      .createSignedUrl(filePath, 60 * 60) // Berlaku 1 jam

    if (error) return { error: error.message }
    return { success: true, signedUrl: data.signedUrl }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

// ==============================================================================
// 3. SISWA: PENGUMPULAN TUGAS (RPC submit_assignment)
// ==============================================================================

export async function submitAssignmentAction(
  assignmentId: string,
  filePath?: string | null,
  linkUrl?: string | null,
): Promise<AssignmentActionState> {
  try {
    await requireRole('student')
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('submit_assignment', {
      p_assignment_id: assignmentId,
      p_file_path: filePath ?? null,
      p_link_url: linkUrl ?? null,
    })

    if (error) {
      return { error: error.message }
    }

    const result = data as {
      submission_id: string
      is_late: boolean
      message: string
    }

    revalidatePath('/student')
    revalidatePath('/student/tugas')
    revalidatePath(`/student/tugas/${assignmentId}`)
    return {
      success: true,
      submissionId: result?.submission_id,
      isLate: result?.is_late,
      message: result?.message || 'Tugas berhasil dikumpulkan.',
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}
