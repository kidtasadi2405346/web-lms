import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QuizTaker } from "./quiz-taker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { formatDateTimeWib } from "@/lib/assignment-utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentQuizPage({ params }: PageProps) {
  const profile = await requireRole("student");
  const { id: quizId } = await params;

  const supabase = await createClient();

  // 1. Ambil data kuis dan modul / kelas / mapel terkait
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select(
      `
      id,
      title,
      description,
      passing_score,
      module_id,
      class_id,
      subject_id,
      type,
      open_at,
      due_at,
      close_at,
      allow_late,
      max_attempts,
      sound_effects,
      feedback_mode,
      review_at,
      shuffle_questions,
      shuffle_options,
      subjects:subject_id (name),
      classes:class_id (name),
      modules:module_id (
        id,
        title,
        class_id,
        subject_id,
        subjects:subject_id (name),
        classes:class_id (name)
      )
    `,
    )
    .eq("id", quizId)
    .maybeSingle();

  if (quizError || !quiz) {
    redirect("/student");
  }

  const isAssessment = quiz.type === "assessment";
  const moduleData = quiz.modules as any;
  const subjectName =
    moduleData?.subjects?.name ||
    (quiz.subjects as any)?.name ||
    "Mata Pelajaran";
  const className =
    moduleData?.classes?.name || (quiz.classes as any)?.name || "Kelas";
  const now = new Date();

  // 2. Ambil riwayat percobaan siswa
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, score, passed, attempted_at, is_late")
    .eq("quiz_id", quizId)
    .eq("student_id", profile.id)
    .order("attempted_at", { ascending: false });

  const attemptCount = attempts?.length || 0;
  const lastAttempt = attempts?.[0] || null;
  const highestScore =
    attempts && attempts.length > 0
      ? Math.max(...attempts.map((a: any) => Number(a.score)))
      : null;
  const hasPassed = attempts?.some((a: any) => a.passed) || false;

  // 3. Validasi status jendela waktu untuk kuis penilaian
  if (isAssessment) {
    // A. Belum dibuka
    if (quiz.open_at && now < new Date(quiz.open_at)) {
      return (
        <div className="mx-auto max-w-xl py-12 px-4">
          <Card className="border-amber-500/30 bg-amber-500/[0.03] text-center p-6 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <Lock className="h-7 w-7" />
            </div>
            <div>
              <Badge
                variant="outline"
                className="text-xs mb-2 border-amber-500/40 text-amber-700 dark:text-amber-300"
              >
                Kuis Penilaian
              </Badge>
              <h2 className="text-xl font-bold text-foreground">
                {quiz.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Kuis ini belum dibuka. Soal akan dapat diakses mulai:
              </p>
              <p className="text-base font-semibold text-amber-700 dark:text-amber-400 mt-2">
                {formatDateTimeWib(quiz.open_at)}
              </p>
            </div>
            <div className="pt-4 border-t">
              <Link href="/student/kuis">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Kuis
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      );
    }

    // B. Batas percobaan tercapai
    const maxAtt = quiz.max_attempts || 1;
    if (attemptCount >= maxAtt) {
      return (
        <div className="mx-auto max-w-xl py-12 px-4">
          <Card className="text-center p-6 space-y-4 shadow-sm">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                hasPassed
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <Badge variant="secondary" className="text-xs mb-2">
                Percobaan Selesai ({attemptCount}/{maxAtt})
              </Badge>
              <h2 className="text-xl font-bold text-foreground">
                {quiz.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Anda telah menyelesaikan seluruh kesempatan pengerjaan kuis
                penilaian ini.
              </p>
              <div className="mt-4 rounded-xl border bg-muted/30 p-4 inline-block text-left min-w-[240px]">
                <p className="text-xs text-muted-foreground">
                  Nilai Terbaik Anda:
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {highestScore}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  KKM: {quiz.passing_score}% • Status:{" "}
                  <span
                    className={
                      hasPassed
                        ? "text-emerald-600 font-semibold"
                        : "text-rose-600 font-semibold"
                    }
                  >
                    {hasPassed ? "Lulus ✓" : "Belum Lulus"}
                  </span>
                </p>
              </div>
              {quiz.feedback_mode === "after_submit" && lastAttempt && (
                <div className="mt-3">
                  <Link
                    href={`/student/kuis/${quiz.id}/review/${lastAttempt.id}`}
                  >
                    <Button variant="outline">Lihat pembahasan</Button>
                  </Link>
                </div>
              )}
            </div>
            <div className="pt-4 border-t">
              <Link href="/student/kuis">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Kuis
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      );
    }

    // C. Kuis ditutup (lewat close_at atau lewat due_at pada mode ketat)
    const isClosed =
      (quiz.close_at && now > new Date(quiz.close_at)) ||
      (!quiz.allow_late && quiz.due_at && now > new Date(quiz.due_at));

    if (isClosed) {
      return (
        <div className="mx-auto max-w-xl py-12 px-4">
          <Card className="border-destructive/30 bg-destructive/[0.02] text-center p-6 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <Badge variant="destructive" className="text-xs mb-2">
                Kuis Ditutup
              </Badge>
              <h2 className="text-xl font-bold text-foreground">
                {quiz.title}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Batas waktu pengerjaan kuis penilaian ini telah berakhir.
              </p>
              {quiz.due_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Tenggat:{" "}
                  <span className="font-semibold">
                    {formatDateTimeWib(quiz.due_at)}
                  </span>
                </p>
              )}
            </div>
            <div className="pt-4 border-t">
              <Link href="/student/kuis">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Kuis
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      );
    }
  }

  // 4. Ambil butir soal (tanpa kunci jawaban karena RLS melindunginya)
  const { data: rawQuestions } = await supabase
    .from("questions")
    .select("id, question_text, options, order_index")
    .eq("quiz_id", quizId)
    .order("order_index", { ascending: true });

  const questions = (rawQuestions ?? []).map((q: any) => ({
    id: q.id,
    question_text: q.question_text,
    options: Array.isArray(q.options) ? q.options : [],
    order_index: q.order_index,
  }));

  return (
    <QuizTaker
      quiz={{
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        passing_score: quiz.passing_score,
        module_id: quiz.module_id || "",
        module_title:
          moduleData?.title ?? (isAssessment ? "Ujian / Penilaian" : "Modul"),
        subject_name: subjectName,
        class_name: className,
        feedback_mode: quiz.feedback_mode ?? "none",
        review_at: quiz.review_at,
        sound_effects: Boolean(quiz.sound_effects),
        shuffle_questions: Boolean(quiz.shuffle_questions),
        shuffle_options: Boolean(quiz.shuffle_options),
      }}
      questions={questions}
      previousAttempt={
        lastAttempt
          ? {
              attempt_id: lastAttempt.id,
              score: Number(lastAttempt.score),
              passed: Boolean(lastAttempt.passed),
              attempted_at: lastAttempt.attempted_at,
            }
          : null
      }
    />
  );
}
