import { notFound, redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { QuizTaker } from './quiz-taker'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StudentQuizPage({ params }: PageProps) {
  const profile = await requireRole('student')
  const { id: quizId } = await params

  const supabase = await createClient()

  // 1. Ambil data kuis dan modul terkait
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select(`
      id,
      title,
      description,
      passing_score,
      module_id,
      shuffle_questions,
      shuffle_options,
      modules:module_id (
        id,
        title,
        class_id,
        subject_id,
        subjects:subject_id (name),
        classes:class_id (name)
      )
    `)
    .eq('id', quizId)
    .maybeSingle()

  if (quizError || !quiz) {
    redirect('/student')
  }

  const moduleData = quiz.modules as any

  // 2. Ambil butir soal (tanpa kunci jawaban karena RLS melindunginya)
  const { data: rawQuestions } = await supabase
    .from('questions')
    .select('id, question_text, options, order_index')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true })

  const questions = (rawQuestions ?? []).map((q: any) => ({
    id: q.id,
    question_text: q.question_text,
    options: Array.isArray(q.options) ? q.options : [],
    order_index: q.order_index,
  }))

  // 3. Ambil riwayat pengerjaan terakhir siswa jika ada
  const { data: lastAttempt } = await supabase
    .from('quiz_attempts')
    .select('score, passed, attempted_at')
    .eq('quiz_id', quizId)
    .eq('student_id', profile.id)
    .order('attempted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <QuizTaker
      quiz={{
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        passing_score: quiz.passing_score,
        module_id: quiz.module_id,
        module_title: moduleData?.title ?? 'Modul',
        subject_name: moduleData?.subjects?.name ?? 'Mata Pelajaran',
        class_name: moduleData?.classes?.name ?? 'Kelas',
        shuffle_questions: Boolean(quiz.shuffle_questions),
        shuffle_options: Boolean(quiz.shuffle_options),
      }}
      questions={questions}
      previousAttempt={
        lastAttempt
          ? {
              score: Number(lastAttempt.score),
              passed: Boolean(lastAttempt.passed),
              attempted_at: lastAttempt.attempted_at,
            }
          : null
      }
    />
  )
}
