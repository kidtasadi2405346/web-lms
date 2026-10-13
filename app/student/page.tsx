import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { StudentModulesDashboard, type ModuleSummary } from './student-modules'
import { UpcomingTasksBlock, type UpcomingAssignmentItem, type ActiveQuizItem } from './upcoming-tasks'
import { getEffectiveDueAt, isAssignmentSubmittable, formatTimeRemaining } from '@/lib/assignment-utils'

export default async function StudentHome() {
  const profile = await requireRole('student')
  const supabase = await createClient()

  // 1. Ambil pendaftaran kelas siswa
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('class_id, classes (id, name, referral_code)')
    .eq('student_id', profile.id)
    .maybeSingle()

  const classData = (enrollment?.classes as unknown as { id: string; name: string; referral_code: string } | null) ?? null
  const classId = enrollment?.class_id

  let modules: ModuleSummary[] = []
  let upcomingAssignments: UpcomingAssignmentItem[] = []
  let activeQuizzes: ActiveQuizItem[] = []

  if (classId) {
    // 2. Query modul, materi, kuis, penyelesaian materi, progres kuis, dan tugas
    const [
      { data: rawModules },
      { data: completions },
      { data: rawQuizzes },
      { data: quizProgress },
      { data: rawAttempts },
      { data: rawAssignments },
      { data: mySubmissions },
      { data: myExtensions },
    ] = await Promise.all([
      supabase
        .from('modules')
        .select(`
          id,
          subject_id,
          title,
          description,
          order_index,
          subjects:subject_id (name),
          materials (
            id,
            title,
            order_index,
            video_url,
            content,
            simulations (id)
          )
        `)
        .eq('class_id', classId)
        .order('order_index', { ascending: true }),
      supabase
        .from('material_completions')
        .select('material_id')
        .eq('student_id', profile.id),
      supabase
        .from('quizzes')
        .select(`
          id,
          module_id,
          class_id,
          subject_id,
          type,
          title,
          description,
          passing_score,
          open_at,
          due_at,
          close_at,
          allow_late,
          max_attempts,
          order_index,
          subjects:subject_id (id, name),
          questions (count)
        `)
        .order('order_index', { ascending: true }),
      supabase
        .from('student_progress')
        .select('quiz_id, highest_score, is_passed')
        .eq('student_id', profile.id),
      supabase
        .from('quiz_attempts')
        .select('id, quiz_id, score, passed, attempted_at, is_late')
        .eq('student_id', profile.id),
      supabase
        .from('assignments')
        .select(`
          id,
          title,
          submission_type,
          open_at,
          due_at,
          close_at,
          allow_late,
          subjects:subject_id (name)
        `)
        .eq('class_id', classId),
      supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', profile.id),
      supabase
        .from('assignment_extensions')
        .select('assignment_id, new_due_at')
        .eq('student_id', profile.id),
    ])

    const completedMaterialsSet = new Set((completions ?? []).map((c: any) => c.material_id))
    const progressMap = new Map<string, { highest_score: number; is_passed: boolean }>()
    ;(quizProgress ?? []).forEach((p: any) => {
      progressMap.set(p.quiz_id, {
        highest_score: Number(p.highest_score),
        is_passed: Boolean(p.is_passed),
      })
    })

    // Kelompokkan kuis berdasarkan module_id
    const quizzesByModule = new Map<string, any[]>()
    ;(rawQuizzes ?? []).forEach((qz: any) => {
      const list = quizzesByModule.get(qz.module_id) || []
      list.push(qz)
      quizzesByModule.set(qz.module_id, list)
    })

    // Evaluasi status kunci materi dan kuis sekuensial per mapel
    // Modul diurutkan berdasarkan order_index.
    const subjectModuleChain = new Map<string, boolean>()

    modules = (rawModules ?? []).map((m: any) => {
      const subjectId = m.subject_id
      const sortedMaterials = (m.materials ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
      const moduleQuizzes = quizzesByModule.get(m.id) || []

      // Cek apakah modul sebelumnya di mapel ini sudah selesai (kuis lulus jika ada kuis)
      const prevModulePassed = subjectModuleChain.has(subjectId)
        ? subjectModuleChain.get(subjectId)!
        : true

      // Evaluasi materi
      let isPriorMaterialDone = prevModulePassed
      const processedMaterials = sortedMaterials.map((mat: any, idx: number) => {
        const isDone = completedMaterialsSet.has(mat.id)
        const isUnlocked = idx === 0 ? prevModulePassed : isPriorMaterialDone

        isPriorMaterialDone = isPriorMaterialDone && isDone

        return {
          id: mat.id,
          title: mat.title,
          order_index: mat.order_index,
          has_video: Boolean(mat.video_url && mat.video_url.trim().length > 0),
          has_content: Boolean(mat.content && mat.content.trim().length > 0),
          has_simulation: Boolean(mat.simulations && mat.simulations.length > 0),
          is_completed: isDone,
          is_unlocked: isUnlocked,
        }
      })

      // Seluruh materi di modul ini selesai jika setiap materi ada di completedMaterialsSet
      const allMaterialsInModuleDone =
        sortedMaterials.length === 0 ||
        sortedMaterials.every((mat: any) => completedMaterialsSet.has(mat.id))

      // Evaluasi kuis di modul ini
      let allQuizzesInModulePassed = true
      const processedQuizzes = moduleQuizzes.map((qz: any) => {
        const qzProg = progressMap.get(qz.id)
        const isPassed = qzProg?.is_passed ?? false
        const lastScore = qzProg?.highest_score ?? null

        // Kuis terbuka jika semua materi di bab ini sudah diselesaikan
        const isUnlocked = prevModulePassed && allMaterialsInModuleDone

        if (!isPassed) allQuizzesInModulePassed = false

        return {
          id: qz.id,
          title: qz.title,
          description: qz.description,
          passing_score: qz.passing_score,
          due_at: qz.due_at,
          type: qz.type ?? 'chapter',
          total_questions: qz.questions?.[0]?.count ?? 0,
          is_unlocked: isUnlocked,
          is_passed: isPassed,
          last_score: lastScore,
        }
      })

      // Jika modul ini memiliki kuis, modul berikutnya terbuka jika kuis lulus.
      // Jika tidak ada kuis, modul berikutnya terbuka jika materi selesai.
      const currentModuleFinished =
        moduleQuizzes.length > 0
          ? allMaterialsInModuleDone && allQuizzesInModulePassed
          : allMaterialsInModuleDone

      subjectModuleChain.set(subjectId, currentModuleFinished)

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        order_index: m.order_index,
        subject_name: m.subjects?.name ?? 'Mata Pelajaran',
        materials: processedMaterials,
        quizzes: processedQuizzes,
      }
    })

    // 3. Proses Tugas Mendatang yang belum dikumpulkan dan masih bisa dikumpulkan
    const submittedAssignmentIds = new Set((mySubmissions ?? []).map((s: any) => s.assignment_id))
    const extMap = new Map<string, string>()
    ;(myExtensions ?? []).forEach((e: any) => {
      extMap.set(e.assignment_id, e.new_due_at)
    })

    const now = new Date()

    upcomingAssignments = (rawAssignments ?? [])
      .filter((a: any) => !submittedAssignmentIds.has(a.id))
      .map((a: any) => {
        const extDue = extMap.get(a.id)
        const fakeExt = extDue ? { new_due_at: extDue, assignment_id: a.id, student_id: profile.id } : null
        const effectiveDue = getEffectiveDueAt(a.due_at, fakeExt)
        const submittable = isAssignmentSubmittable(a, fakeExt, now)
        const timeRemaining = formatTimeRemaining(effectiveDue, now)

        return {
          id: a.id,
          title: a.title,
          subject_name: a.subjects?.name ?? 'Mata Pelajaran',
          effective_due_at: effectiveDue.toISOString(),
          is_submittable: submittable.submittable,
          is_urgent: timeRemaining.isUrgent,
          time_remaining_text: timeRemaining.text,
          submission_type: a.submission_type,
          due_timestamp: effectiveDue.getTime(),
        }
      })
      .filter((a: any) => a.is_submittable)
      .sort((a: any, b: any) => a.due_timestamp - b.due_timestamp)
      .slice(0, 6)

    // 4. Kumpulkan kuis penilaian aktif & kuis bab yang perlu dikerjakan
    const attemptsByQuiz = new Map<string, any[]>()
    ;(rawAttempts ?? []).forEach((att: any) => {
      const list = attemptsByQuiz.get(att.quiz_id) || []
      list.push(att)
      attemptsByQuiz.set(att.quiz_id, list)
    })

    // Kuis Penilaian (Assessment) di kelas ini
    ;(rawQuizzes ?? [])
      .filter((q: any) => q.type === 'assessment' && (q.class_id === classId || !q.class_id))
      .forEach((qz: any) => {
        const atts = attemptsByQuiz.get(qz.id) || []
        const attemptsCount = atts.length
        const highestScore = atts.length > 0 ? Math.max(...atts.map((a: any) => Number(a.score))) : null
        const isPassed = atts.some((a: any) => Boolean(a.passed))
        const maxAtt = qz.max_attempts || 1

        let status: 'belum_dibuka' | 'terbuka' | 'ditutup' | 'sudah_dikerjakan' = 'terbuka'
        let statusLabel = 'Terbuka'
        let canTake = true

        if (attemptsCount >= maxAtt || isPassed) {
          status = 'sudah_dikerjakan'
          statusLabel = 'Sudah Dikerjakan'
          canTake = false
        } else if (qz.open_at && now < new Date(qz.open_at)) {
          status = 'belum_dibuka'
          statusLabel = 'Belum Dibuka'
          canTake = false
        } else if (
          (qz.close_at && now > new Date(qz.close_at)) ||
          (!qz.allow_late && qz.due_at && now > new Date(qz.due_at))
        ) {
          status = 'ditutup'
          statusLabel = 'Ditutup'
          canTake = false
        }

        activeQuizzes.push({
          id: qz.id,
          title: qz.title,
          type: 'assessment',
          subject_name: qz.subjects?.name ?? 'Mata Pelajaran',
          passing_score: qz.passing_score,
          total_questions: qz.questions?.[0]?.count ?? 0,
          status,
          status_label: statusLabel,
          open_at: qz.open_at,
          due_at: qz.due_at,
          close_at: qz.close_at,
          max_attempts: qz.max_attempts,
          attempts_count: attemptsCount,
          highest_score: highestScore,
          is_passed: isPassed,
          can_take: canTake,
        })
      })

    // Kuis Bab yang sudah terbuka tapi belum lulus
    modules.forEach((mod) => {
      ;(mod.quizzes ?? []).forEach((qz) => {
        if (qz.is_unlocked && !qz.is_passed) {
          activeQuizzes.push({
            id: qz.id,
            title: qz.title,
            type: 'chapter',
            module_title: mod.title,
            subject_name: mod.subject_name,
            passing_score: qz.passing_score,
            total_questions: qz.total_questions,
            status: 'terbuka',
            status_label: 'Kuis Bab',
            due_at: qz.due_at,
            attempts_count: 0,
            can_take: true,
          })
        }
      })
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Halo, {profile.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {classData ? `Ruang Belajar Siswa — Kelas ${classData.name}` : 'Anda belum terdaftar di kelas manapun.'}
        </p>
      </div>

      {classData && (
        <UpcomingTasksBlock
          assignments={upcomingAssignments}
          quizzes={activeQuizzes}
        />
      )}

      <Suspense fallback={<div className="h-40 rounded-xl border bg-muted/20 animate-pulse" />}>
        <StudentModulesDashboard
          className={classData?.name ?? '-'}
          referralCode={classData?.referral_code ?? '-'}
          modules={modules}
        />
      </Suspense>
    </div>
  )
}

