'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { QuizSubmissionResult } from '@/lib/types'

export type ActionState = {
  success?: boolean
  error?: string | null
  data?: any
}

// ==============================================================================
// 1. MANAJEMEN KUIS OLEH GURU
// ==============================================================================

export async function createQuizAction(formData: FormData): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const type = ((formData.get('type') as string)?.trim() || 'chapter') as 'chapter' | 'assessment'
    const classId = (formData.get('class_id') as string)?.trim()
    const subjectId = (formData.get('subject_id') as string)?.trim() || null
    const moduleId = (formData.get('module_id') as string)?.trim() || null
    const materialId = (formData.get('material_id') as string)?.trim() || null
    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const passingScore = parseInt((formData.get('passing_score') as string) || '70', 10)
    const shuffleQuestions = formData.get('shuffle_questions') === 'true'
    const shuffleOptions = formData.get('shuffle_options') === 'true'

    const openAtRaw = (formData.get('open_at') as string)?.trim()
    const dueAtRaw = (formData.get('due_at') as string)?.trim()
    const closeAtRaw = (formData.get('close_at') as string)?.trim()
    const allowLate = formData.get('allow_late') === 'true'
    const maxAttemptsRaw = (formData.get('max_attempts') as string)?.trim()
    const maxAttempts = maxAttemptsRaw ? parseInt(maxAttemptsRaw, 10) : null

    if (!title) return { error: 'Judul kuis wajib diisi.' }
    if (isNaN(passingScore) || passingScore < 0 || passingScore > 100) {
      return { error: 'Nilai kelulusan (passing score) harus antara 0 dan 100.' }
    }

    if (type === 'assessment') {
      if (!classId) return { error: 'Kelas wajib ditentukan untuk kuis penilaian.' }
      if (!subjectId) return { error: 'Mata pelajaran wajib ditentukan untuk kuis penilaian.' }
    } else {
      if (!moduleId) return { error: 'Modul bab wajib ditentukan untuk kuis bab.' }
    }

    const openAt = openAtRaw ? new Date(openAtRaw).toISOString() : null
    const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : null
    const closeAt = closeAtRaw ? new Date(closeAtRaw).toISOString() : null

    if (openAt && dueAt && new Date(openAt) >= new Date(dueAt)) {
      return { error: 'Waktu buka kuis harus lebih awal dari tenggat waktu (due date).' }
    }
    if (dueAt && closeAt && new Date(closeAt) < new Date(dueAt)) {
      return { error: 'Batas akhir (tutup kuis) tidak boleh lebih awal dari tenggat waktu.' }
    }
    if (maxAttempts !== null && (isNaN(maxAttempts) || maxAttempts <= 0)) {
      return { error: 'Batas percobaan (max attempts) harus berupa angka positif.' }
    }

    const insertPayload: Record<string, any> = {
      type,
      class_id: classId || null,
      subject_id: subjectId,
      module_id: moduleId,
      material_id: materialId,
      title,
      description,
      passing_score: passingScore,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      open_at: openAt,
      due_at: dueAt,
      close_at: closeAt,
      allow_late: allowLate,
      max_attempts: maxAttempts,
    }

    const { error } = await supabase.from('quizzes').insert(insertPayload)

    if (error) return { error: error.message }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function updateQuizAction(quizId: string, classId: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const title = (formData.get('title') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const passingScore = parseInt((formData.get('passing_score') as string) || '70', 10)
    const shuffleQuestions = formData.get('shuffle_questions') === 'true'
    const shuffleOptions = formData.get('shuffle_options') === 'true'

    const openAtRaw = (formData.get('open_at') as string)?.trim()
    const dueAtRaw = (formData.get('due_at') as string)?.trim()
    const closeAtRaw = (formData.get('close_at') as string)?.trim()
    const allowLate = formData.get('allow_late') === 'true'
    const maxAttemptsRaw = (formData.get('max_attempts') as string)?.trim()
    const maxAttempts = maxAttemptsRaw ? parseInt(maxAttemptsRaw, 10) : null

    if (!title) return { error: 'Judul kuis wajib diisi.' }
    if (isNaN(passingScore) || passingScore < 0 || passingScore > 100) {
      return { error: 'Nilai kelulusan (passing score) harus antara 0 dan 100.' }
    }

    const openAt = openAtRaw ? new Date(openAtRaw).toISOString() : null
    const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : null
    const closeAt = closeAtRaw ? new Date(closeAtRaw).toISOString() : null

    if (openAt && dueAt && new Date(openAt) >= new Date(dueAt)) {
      return { error: 'Waktu buka kuis harus lebih awal dari tenggat waktu (due date).' }
    }
    if (dueAt && closeAt && new Date(closeAt) < new Date(dueAt)) {
      return { error: 'Batas akhir (tutup kuis) tidak boleh lebih awal dari tenggat waktu.' }
    }
    if (maxAttempts !== null && (isNaN(maxAttempts) || maxAttempts <= 0)) {
      return { error: 'Batas percobaan (max attempts) harus berupa angka positif.' }
    }

    const updatePayload: Record<string, any> = {
      title,
      description,
      passing_score: passingScore,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      open_at: openAt,
      due_at: dueAt,
      close_at: closeAt,
      allow_late: allowLate,
      max_attempts: maxAttempts,
    }

    const { error } = await supabase
      .from('quizzes')
      .update(updatePayload)
      .eq('id', quizId)

    if (error) return { error: error.message }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteQuizAction(quizId: string, classId: string): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const { error } = await supabase.from('quizzes').delete().eq('id', quizId)
    if (error) return { error: error.message }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

// ==============================================================================
// 2. MANAJEMEN SOAL & KUNCI JAWABAN (QUESTION_KEYS)
// ==============================================================================

export async function createQuestionAction(formData: FormData): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const classId = (formData.get('class_id') as string)?.trim()
    const quizId = (formData.get('quiz_id') as string)?.trim()
    const questionText = (formData.get('question_text') as string)?.trim()
    const optA = (formData.get('option_a') as string)?.trim()
    const optB = (formData.get('option_b') as string)?.trim()
    const optC = (formData.get('option_c') as string)?.trim()
    const optD = (formData.get('option_d') as string)?.trim()
    const correctOption = (formData.get('correct_option') as string)?.trim().toUpperCase()

    if (!quizId) return { error: 'Kuis wajib ditentukan.' }
    if (!questionText) return { error: 'Teks pertanyaan wajib diisi.' }
    if (!optA || !optB || !optC || !optD) {
      return { error: 'Semua pilihan jawaban (A, B, C, D) wajib diisi.' }
    }
    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      return { error: 'Kunci jawaban harus berupa salah satu dari A, B, C, atau D.' }
    }

    const options = [
      { key: 'A', text: optA },
      { key: 'B', text: optB },
      { key: 'C', text: optC },
      { key: 'D', text: optD },
    ]

    // 1. Simpan soal ke tabel questions
    const { data: newQuestion, error: qError } = await supabase
      .from('questions')
      .insert({
        quiz_id: quizId,
        question_text: questionText,
        options,
      })
      .select('id')
      .single()

    if (qError || !newQuestion) {
      return { error: qError?.message || 'Gagal menyimpan pertanyaan.' }
    }

    // 2. Simpan kunci jawaban ke tabel rahasia question_keys
    const { error: keyError } = await supabase.from('question_keys').insert({
      question_id: newQuestion.id,
      correct_option: correctOption,
    })

    if (keyError) {
      // Rollback pertanyaan jika kunci gagal disimpan
      await supabase.from('questions').delete().eq('id', newQuestion.id)
      return { error: `Gagal menyimpan kunci jawaban: ${keyError.message}` }
    }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function updateQuestionAction(questionId: string, classId: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const questionText = (formData.get('question_text') as string)?.trim()
    const optA = (formData.get('option_a') as string)?.trim()
    const optB = (formData.get('option_b') as string)?.trim()
    const optC = (formData.get('option_c') as string)?.trim()
    const optD = (formData.get('option_d') as string)?.trim()
    const correctOption = (formData.get('correct_option') as string)?.trim().toUpperCase()

    if (!questionText) return { error: 'Teks pertanyaan wajib diisi.' }
    if (!optA || !optB || !optC || !optD) {
      return { error: 'Semua pilihan jawaban (A, B, C, D) wajib diisi.' }
    }
    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      return { error: 'Kunci jawaban harus berupa salah satu dari A, B, C, atau D.' }
    }

    const options = [
      { key: 'A', text: optA },
      { key: 'B', text: optB },
      { key: 'C', text: optC },
      { key: 'D', text: optD },
    ]

    // 1. Update questions
    const { error: qError } = await supabase
      .from('questions')
      .update({
        question_text: questionText,
        options,
      })
      .eq('id', questionId)

    if (qError) return { error: qError.message }

    // 2. Update question_keys
    const { error: keyError } = await supabase
      .from('question_keys')
      .upsert({
        question_id: questionId,
        correct_option: correctOption,
      })

    if (keyError) return { error: keyError.message }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteQuestionAction(questionId: string, classId: string): Promise<ActionState> {
  try {
    await requireRole('teacher')
    const supabase = await createClient()

    const { error } = await supabase.from('questions').delete().eq('id', questionId)
    if (error) return { error: error.message }

    if (classId) revalidatePath(`/teacher/kelas/${classId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

// ==============================================================================
// 3. PENGERJAAN KUIS OLEH SISWA (RPC submit_quiz)
// ==============================================================================

export async function submitQuizAction(
  quizId: string,
  answers: Record<string, string>,
): Promise<{ success: boolean; result?: QuizSubmissionResult; error?: string }> {
  try {
    await requireRole('student')
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('submit_quiz', {
      p_quiz_id: quizId,
      p_answers: answers,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/student')
    revalidatePath(`/student/kuis/${quizId}`)
    return { success: true, result: data as QuizSubmissionResult }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan saat mengumpulkan kuis.' }
  }
}
