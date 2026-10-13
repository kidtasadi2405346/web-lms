import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { GradebookClient } from './gradebook-client'
import type { StudentGradebookItem, GradebookSummary, StudentQuizSummary } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ subject?: string }>
}

export default async function TeacherClassGradebookPage({ params, searchParams }: PageProps) {
  const profile = await requireRole('teacher')
  const { id: classId } = await params
  const { subject: subjectParam } = await searchParams

  const supabase = await createClient()

  // 1. Ambil informasi kelas
  const { data: classData } = await supabase
    .from('classes')
    .select('id, name, referral_code')
    .eq('id', classId)
    .maybeSingle()

  if (!classData) {
    redirect('/teacher')
  }

  // 2. Verifikasi penugasan guru di kelas ini dan ambil daftar mapel yang diajarkan
  const { data: assignments } = await supabase
    .from('teacher_assignments')
    .select('subject_id, subjects (id, name)')
    .eq('teacher_id', profile.id)
    .eq('class_id', classId)

  if (!assignments || assignments.length === 0) {
    // Guru tidak memiliki izin mengajar di kelas ini
    redirect('/teacher')
  }

  const taughtSubjects = assignments
    .map((a: any) => ({
      id: a.subject_id,
      name: a.subjects?.name ?? 'Mata Pelajaran',
    }))
    .filter((s, idx, arr) => arr.findIndex((item) => item.id === s.id) === idx)

  // Tentukan mata pelajaran yang aktif (all atau spesifik)
  const selectedSubjectId =
    subjectParam && taughtSubjects.some((s) => s.id === subjectParam)
      ? subjectParam
      : 'all'

  const activeSubjectIds =
    selectedSubjectId === 'all'
      ? taughtSubjects.map((s) => s.id)
      : [selectedSubjectId]

  // 3. Ambil daftar siswa yang terdaftar di kelas ini (RLS enrollments_select_teacher)
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      student_id,
      enrolled_at,
      profiles:student_id (
        id,
        full_name,
        email,
        role
      )
    `)
    .eq('class_id', classId)
    .order('enrolled_at', { ascending: true })

  const rawStudents = (enrollments ?? []).map((e: any) => ({
    id: e.student_id,
    full_name: e.profiles?.full_name ?? 'Siswa',
    email: e.profiles?.email ?? '-',
    enrolled_at: e.enrolled_at,
  }))

  // 4. Ambil modul, materi, dan kuis untuk mata pelajaran yang aktif di kelas ini
  const { data: modules } = await supabase
    .from('modules')
    .select(`
      id,
      title,
      subject_id,
      order_index,
      materials (
        id,
        title,
        order_index
      ),
      quizzes (
        id,
        title,
        passing_score,
        order_index
      )
    `)
    .eq('class_id', classId)
    .in('subject_id', activeSubjectIds)
    .order('order_index', { ascending: true })

  // Kumpulkan seluruh ID materi dan kuis dalam lingkup mapel ini
  const allMaterials: { id: string; title: string; moduleId: string; moduleTitle: string }[] = []
  const allQuizzes: { id: string; title: string; passingScore: number; moduleId: string; moduleTitle: string }[] = []

  for (const m of modules ?? []) {
    for (const mat of (m.materials ?? []).sort((a: any, b: any) => a.order_index - b.order_index)) {
      allMaterials.push({
        id: mat.id,
        title: mat.title,
        moduleId: m.id,
        moduleTitle: m.title,
      })
    }
    for (const qz of (m.quizzes ?? []).sort((a: any, b: any) => a.order_index - b.order_index)) {
      allQuizzes.push({
        id: qz.id,
        title: qz.title,
        passingScore: qz.passing_score,
        moduleId: m.id,
        moduleTitle: m.title,
      })
    }
  }

  const materialIds = allMaterials.map((m) => m.id)
  const quizIds = allQuizzes.map((q) => q.id)

  // 5. Ambil data penyelesaian materi (material_completions)
  const completionsMap = new Map<string, Set<string>>()
  if (materialIds.length > 0 && rawStudents.length > 0) {
    const { data: completions } = await supabase
      .from('material_completions')
      .select('student_id, material_id, completed_at')
      .in('material_id', materialIds)

    for (const c of completions ?? []) {
      if (!completionsMap.has(c.student_id)) {
        completionsMap.set(c.student_id, new Set())
      }
      completionsMap.get(c.student_id)!.add(c.material_id)
    }
  }

  // 6. Ambil data percobaan kuis (quiz_attempts)
  type StudentQuizData = {
    attempts: any[]
    highestScore: number | null
    passed: boolean
    lastAttemptAt: string | null
  }
  const attemptsMap = new Map<string, Map<string, StudentQuizData>>()

  if (quizIds.length > 0 && rawStudents.length > 0) {
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('id, quiz_id, student_id, score, passed, attempted_at')
      .in('quiz_id', quizIds)
      .order('attempted_at', { ascending: true })

    for (const att of attempts ?? []) {
      if (!attemptsMap.has(att.student_id)) {
        attemptsMap.set(att.student_id, new Map())
      }
      const studentQuizMap = attemptsMap.get(att.student_id)!
      if (!studentQuizMap.has(att.quiz_id)) {
        studentQuizMap.set(att.quiz_id, {
          attempts: [],
          highestScore: null,
          passed: false,
          lastAttemptAt: null,
        })
      }
      const qData = studentQuizMap.get(att.quiz_id)!
      qData.attempts.push(att)
      const scoreNum = Number(att.score)
      if (qData.highestScore === null || scoreNum > qData.highestScore) {
        qData.highestScore = scoreNum
      }
      if (att.passed) {
        qData.passed = true
      }
      qData.lastAttemptAt = att.attempted_at
    }
  }

  // 7. Bentuk rekap per siswa (StudentGradebookItem)
  const gradebookItems: StudentGradebookItem[] = rawStudents.map((s) => {
    const completedMats = completionsMap.get(s.id) || new Set()
    const completedCount = completedMats.size
    const totalMats = allMaterials.length
    const matProgressPct =
      totalMats > 0 ? Math.round((completedCount / totalMats) * 100) : totalMats === 0 ? 100 : 0

    const quizzesSummary: StudentQuizSummary[] = allQuizzes.map((q) => {
      const qData = attemptsMap.get(s.id)?.get(q.id)
      const attemptsCount = qData?.attempts.length || 0
      const highestScore = qData?.highestScore ?? null
      const isPassed = qData?.passed ?? false

      return {
        quiz_id: q.id,
        quiz_title: q.title,
        module_title: q.moduleTitle,
        passing_score: q.passingScore,
        attempts_count: attemptsCount,
        highest_score: highestScore,
        is_passed: isPassed,
        last_attempt_at: qData?.lastAttemptAt ?? null,
      }
    })

    const attemptedQuizzes = quizzesSummary.filter((q) => q.highest_score !== null)
    const avgScore =
      attemptedQuizzes.length > 0
        ? Math.round(
            attemptedQuizzes.reduce((sum, q) => sum + (q.highest_score || 0), 0) /
              attemptedQuizzes.length
          )
        : null

    const allQuizzesPassed =
      allQuizzes.length > 0 &&
      allQuizzes.every((q) => {
        const summary = quizzesSummary.find((sq) => sq.quiz_id === q.id)
        return summary?.is_passed
      })

    return {
      student_id: s.id,
      full_name: s.full_name,
      email: s.email,
      enrolled_at: s.enrolled_at,
      completed_materials_count: completedCount,
      total_materials_count: totalMats,
      material_progress_percent: matProgressPct,
      quizzes: quizzesSummary,
      average_quiz_score: avgScore,
      all_quizzes_passed: allQuizzesPassed,
    }
  })

  // 8. Hitung metrik ringkasan kelas
  const totalStudents = gradebookItems.length
  const avgMatProgress =
    totalStudents > 0
      ? Math.round(
          gradebookItems.reduce((acc, s) => acc + s.material_progress_percent, 0) / totalStudents
        )
      : 0

  const studentsWithQuizScore = gradebookItems.filter((s) => s.average_quiz_score !== null)
  const avgQuizScore =
    studentsWithQuizScore.length > 0
      ? Math.round(
          studentsWithQuizScore.reduce((acc, s) => acc + (s.average_quiz_score || 0), 0) /
            studentsWithQuizScore.length
        )
      : 0

  const passedStudentsCount = gradebookItems.filter((s) => s.all_quizzes_passed).length

  const summary: GradebookSummary = {
    total_students: totalStudents,
    average_material_progress: avgMatProgress,
    average_quiz_score: avgQuizScore,
    passed_students_count: passedStudentsCount,
  }

  const quizzesListHeader = allQuizzes.map((q) => ({
    id: q.id,
    title: q.title,
    passingScore: q.passingScore,
    moduleTitle: q.moduleTitle,
  }))

  return (
    <GradebookClient
      classId={classId}
      className={classData.name}
      referralCode={classData.referral_code}
      taughtSubjects={taughtSubjects}
      selectedSubjectId={selectedSubjectId}
      quizzesList={quizzesListHeader}
      totalMaterialsInScope={allMaterials.length}
      students={gradebookItems}
      summary={summary}
    />
  )
}
