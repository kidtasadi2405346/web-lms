import { z } from 'zod'

export const quizSchema = z
  .object({
    type: z.enum(['chapter', 'assessment']).default('chapter'),
    class_id: z.string().uuid().nullable().optional(),
    subject_id: z.string().uuid().nullable().optional(),
    module_id: z.string().uuid().nullable().optional(),
    material_id: z.string().uuid().nullable().optional(),
    title: z.string().min(1, 'Judul kuis wajib diisi'),
    description: z.string().nullable().optional(),
    passing_score: z.number().min(0).max(100, 'Nilai kelulusan harus antara 0 dan 100'),
    open_at: z.string().datetime({ offset: true }).nullable().optional(),
    due_at: z.string().datetime({ offset: true }).nullable().optional(),
    close_at: z.string().datetime({ offset: true }).nullable().optional(),
    allow_late: z.boolean().default(false),
    max_attempts: z.number().int().positive('Batas percobaan harus berupa bilangan bulat positif').nullable().optional(),
    shuffle_questions: z.boolean().default(false),
    shuffle_options: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.type === 'chapter') {
        return Boolean(data.module_id || data.material_id)
      }
      return Boolean(data.class_id && data.subject_id)
    },
    {
      message: 'Kuis bab wajib terhubung ke modul/materi, sedangkan kuis penilaian wajib memiliki kelas dan mata pelajaran.',
      path: ['type'],
    }
  )
  .refine(
    (data) => {
      if (data.open_at && data.due_at) {
        return new Date(data.open_at) < new Date(data.due_at)
      }
      return true
    },
    {
      message: 'Waktu buka kuis (open_at) harus lebih awal dari tenggat waktu (due_at).',
      path: ['open_at'],
    }
  )
  .refine(
    (data) => {
      if (data.due_at && data.close_at) {
        return new Date(data.close_at) >= new Date(data.due_at)
      }
      return true
    },
    {
      message: 'Batas penutupan kuis (close_at) tidak boleh lebih awal dari tenggat waktu (due_at).',
      path: ['close_at'],
    }
  )

export type QuizFormValues = z.infer<typeof quizSchema>
