import type { Role } from '@/lib/roles'

export type Profile = {
  id: string
  name: string
  role: Role
  identity_number: string
  created_at?: string
}

export type ClassItem = {
  id: string
  name: string
  referral_code: string
  created_at?: string
}

export type SubjectItem = {
  id: string
  name: string
  created_at?: string
}

export type TeacherAssignment = {
  id: string
  teacher_id: string
  subject_id: string
  class_id: string
  created_at?: string
  teacher?: Profile
  subject?: SubjectItem
  class?: ClassItem
}

export type ModuleItem = {
  id: string
  class_id: string
  subject_id: string
  title: string
  description?: string | null
  order_index: number
  created_by?: string | null
  created_at?: string
  materials?: MaterialItem[]
  quizzes?: QuizItem[]
}

export type SimulationConfig = {
  url: string
}

export type SimulationItem = {
  id: string
  material_id: string
  title: string
  type: 'embed'
  config: SimulationConfig
  order_index: number
  created_by?: string | null
  created_at?: string
}

export type MaterialItem = {
  id: string
  module_id: string
  title: string
  content?: string | null
  video_url?: string | null
  order_index: number
  created_at?: string
  simulations?: SimulationItem[]
}

export type QuestionOption = {
  key: string
  text: string
}

export type QuestionItem = {
  id: string
  quiz_id: string
  question_text: string
  options: QuestionOption[]
  order_index: number
  created_at?: string
  correct_option?: string // Hanya ada untuk guru/admin
}

export type QuizType = 'chapter' | 'assessment'

export type QuizItem = {
  id: string
  module_id?: string | null
  material_id?: string | null
  class_id?: string | null
  subject_id?: string | null
  type?: QuizType
  title: string
  description?: string | null
  passing_score: number
  open_at?: string | null
  due_at?: string | null
  close_at?: string | null
  allow_late?: boolean
  max_attempts?: number | null
  shuffle_questions?: boolean
  shuffle_options?: boolean
  order_index?: number
  created_at?: string
  questions?: QuestionItem[]
  // Joined relations
  modules?: ModuleItem | null
  classes?: ClassItem | null
  subjects?: SubjectItem | null
  materials?: MaterialItem | null
}

export type QuizAttemptItem = {
  id: string
  quiz_id: string
  student_id: string
  score: number
  passed: boolean
  answers: Record<string, string>
  attempted_at: string
  is_late?: boolean
}

export type StudentProgressItem = {
  student_id: string
  quiz_id: string
  module_id: string
  highest_score: number
  is_passed: boolean
  updated_at: string
}

export type QuizSubmissionResult = {
  attempt_id: string
  score: number
  passing_score: number
  passed: boolean
  total_questions: number
  correct_count: number
  is_late?: boolean
  type?: QuizType
  attempts_left?: number | null
}

export type StudentQuizSummary = {
  quiz_id: string
  quiz_title: string
  module_title: string
  passing_score: number
  attempts_count: number
  highest_score: number | null
  is_passed: boolean
  last_attempt_at: string | null
}

export type StudentGradebookItem = {
  student_id: string
  full_name: string
  email: string
  enrolled_at: string
  completed_materials_count: number
  total_materials_count: number
  material_progress_percent: number
  quizzes: StudentQuizSummary[]
  average_quiz_score: number | null
  all_quizzes_passed: boolean
}

export type GradebookSummary = {
  total_students: number
  average_material_progress: number
  average_quiz_score: number
  passed_students_count: number
}

export type SubmissionType = 'file' | 'link' | 'both'
export type DeadlineRuleType = 'flexible' | 'with_close' | 'strict'

export type AssignmentItem = {
  id: string
  class_id: string
  subject_id: string
  material_id?: string | null
  title: string
  description?: string | null
  submission_type: SubmissionType
  open_at: string
  due_at: string
  close_at?: string | null
  allow_late: boolean
  late_penalty_percent: number
  max_score: number
  created_by?: string | null
  created_at?: string
  // Relational joins
  classes?: ClassItem
  subjects?: SubjectItem
  materials?: {
    id: string
    title: string
    simulations?: { id: string; title: string }[]
  } | null
  submissions?: SubmissionItem[]
  extensions?: AssignmentExtensionItem[]
}

export type SubmissionItem = {
  id: string
  assignment_id: string
  student_id: string
  file_path?: string | null
  link_url?: string | null
  submitted_at: string
  is_late: boolean
  score?: number | null
  feedback?: string | null
  graded_by?: string | null
  graded_at?: string | null
  student?: Profile
  grader?: Profile
}

export type AssignmentExtensionItem = {
  assignment_id: string
  student_id: string
  new_due_at: string
  reason?: string | null
  granted_by?: string | null
  created_at?: string
  student?: Profile
}

export type StudentAssignmentStatus =
  | 'not_submitted'
  | 'submitted'
  | 'late'
  | 'graded'
  | 'closed'


