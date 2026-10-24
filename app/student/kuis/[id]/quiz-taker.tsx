"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileQuestion,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { submitQuizAction } from "@/lib/actions/quiz";
import type { QuizSubmissionResult } from "@/lib/types";
import { playQuizSound, prepareQuizAudio } from "@/lib/sounds";
import { PerQuestionQuizRunner } from "@/components/student/per-question-quiz-runner";
import { useProfilePreferences } from "@/components/layout/profile-preferences";

type QuestionItem = {
  id: string;
  question_text: string;
  options: { key: string; text: string }[];
  order_index: number;
};

interface QuizTakerProps {
  quiz: {
    id: string;
    title: string;
    description?: string | null;
    passing_score: number;
    module_id: string;
    module_title: string;
    subject_name: string;
    class_name: string;
    feedback_mode?: "none" | "after_submit" | "per_question";
    review_at?: string | null;
    sound_effects?: boolean;
    shuffle_questions?: boolean;
    shuffle_options?: boolean;
  };
  questions: QuestionItem[];
  previousAttempt?: {
    attempt_id: string;
    score: number;
    passed: boolean;
    attempted_at: string;
  } | null;
  nextModuleId?: string | null;
}

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const itemI = arr[i];
    const itemJ = arr[j];
    if (itemI !== undefined && itemJ !== undefined) {
      arr[i] = itemJ;
      arr[j] = itemI;
    }
  }
  return arr;
}

function prepareDisplayQuestions(
  items: QuestionItem[],
  shuffleQuestions: boolean,
  shuffleOptions: boolean,
): QuestionItem[] {
  let list = items.map((q) => ({
    ...q,
    options: shuffleOptions ? shuffleArray(q.options) : [...q.options],
  }));
  if (shuffleQuestions) {
    list = shuffleArray(list);
  }
  return list;
}

export function QuizTaker({
  quiz,
  questions,
  previousAttempt,
  nextModuleId,
}: QuizTakerProps) {
  const router = useRouter();
  const { audioEnabled } = useProfilePreferences();
  const [displayQuestions, setDisplayQuestions] =
    useState<QuestionItem[]>(questions);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    try {
      setSoundMuted(
        window.localStorage.getItem("mini-lms-quiz-sound-muted") === "true",
      );
    } catch {
      setSoundMuted(false);
    }
  }, []);

  // Shuffle pada client-side saat komponen dimuat untuk menghindari hydration mismatch
  useEffect(() => {
    setDisplayQuestions(
      prepareDisplayQuestions(
        questions,
        Boolean(quiz.shuffle_questions),
        Boolean(quiz.shuffle_options),
      ),
    );
  }, [questions, quiz.shuffle_questions, quiz.shuffle_options]);

  if (quiz.feedback_mode === "per_question") {
    return (
      <PerQuestionQuizRunner
        quiz={{
          id: quiz.id,
          title: quiz.title,
          passing_score: quiz.passing_score,
          module_title: quiz.module_title,
          subject_name: quiz.subject_name,
          class_name: quiz.class_name,
          sound_effects: quiz.sound_effects === true,
          shuffle_questions: quiz.shuffle_questions === true,
          shuffle_options: quiz.shuffle_options === true,
        }}
        questions={questions}
      />
    );
  }

  // Status pengerjaan
  const totalQuestions = displayQuestions.length;
  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = totalQuestions > 0 && answeredCount === totalQuestions;

  function selectOption(questionId: string, optionKey: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  }

  async function handleSubmit() {
    if (!isAllAnswered) {
      setError(
        `Anda baru menjawab ${answeredCount} dari ${totalQuestions} soal. Harap jawab seluruh soal terlebih dahulu.`,
      );
      return;
    }

    prepareQuizAudio(quiz.sound_effects === true && audioEnabled && !soundMuted);
    setSubmitting(true);
    setError(null);

    const res = await submitQuizAction(quiz.id, answers);
    setSubmitting(false);

    if (!res.success || !res.result) {
      setError(res.error || "Gagal mengumpulkan kuis. Coba lagi.");
      return;
    }

    setResult(res.result);
    setIsResultModalOpen(true);
    playQuizSound(
      res.result.passed ? "passed" : "not-passed",
      quiz.sound_effects === true && audioEnabled && !soundMuted,
    );
  }

  function toggleSound() {
    setSoundMuted((muted) => {
      const nextMuted = !muted;
      try {
        window.localStorage.setItem(
          "mini-lms-quiz-sound-muted",
          String(nextMuted),
        );
      } catch {
        // Audio preference remains available for this page even if storage is blocked.
      }
      return nextMuted;
    });
  }

  function handleRetryRemedial() {
    setAnswers({});
    setResult(null);
    setIsResultModalOpen(false);
    // Acak ulang susunan soal dan opsi untuk pengerjaan remedial berikutnya
    setDisplayQuestions(
      prepareDisplayQuestions(
        questions,
        Boolean(quiz.shuffle_questions),
        Boolean(quiz.shuffle_options),
      ),
    );
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/student" className="hover:text-foreground">
          Kelas {quiz.class_name}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{quiz.subject_name}</span>
        <span>/</span>
        <span className="truncate max-w-xs">{quiz.module_title}</span>
      </div>

      {/* Header Kuis */}
      <Card className="border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {quiz.subject_name}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {quiz.module_title}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight mt-1 flex items-center gap-2">
                <FileQuestion className="h-6 w-6 text-primary" />
                {quiz.title}
              </CardTitle>
              {quiz.description && (
                <CardDescription className="text-sm mt-1">
                  {quiz.description}
                </CardDescription>
              )}
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <Badge className="font-mono text-xs">
                Passing Score: {quiz.passing_score}%
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!audioEnabled}
                aria-pressed={audioEnabled && !soundMuted}
                aria-label={
                  !audioEnabled
                    ? "Efek audio dinonaktifkan dari pengaturan profil"
                    : soundMuted
                      ? "Aktifkan suara kuis"
                      : "Bisukan suara kuis"
                }
                title={
                  !audioEnabled
                    ? "Efek audio dinonaktifkan dari pengaturan profil"
                    : soundMuted
                      ? "Aktifkan suara kuis"
                      : "Bisukan suara kuis"
                }
                onClick={toggleSound}
              >
                {soundMuted || !audioEnabled ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                Suara {soundMuted || !audioEnabled ? "mati" : "aktif"}
              </Button>
              <div className="flex flex-wrap items-center gap-1">
                {quiz.shuffle_questions && (
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  >
                    <Shuffle className="h-2.5 w-2.5" /> Acak Soal
                  </Badge>
                )}
                {quiz.shuffle_options && (
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 text-sky-600 dark:text-sky-400 border-sky-500/30"
                  >
                    <Shuffle className="h-2.5 w-2.5" /> Acak Pilihan
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Total {totalQuestions} Soal
              </span>
            </div>
          </div>
        </CardHeader>

        {/* Banner Riwayat Terakhir jika ada */}
        {previousAttempt && (
          <CardContent className="pt-0">
            <div
              className={`flex flex-col gap-2 rounded-lg p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between border ${
                previousAttempt.passed
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {previousAttempt.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                )}
                <span>
                  {previousAttempt.passed
                    ? `Anda telah LULUS kuis ini dengan nilai ${previousAttempt.score} (KKM: ${quiz.passing_score}).`
                    : `Nilai Anda sebelumnya: ${previousAttempt.score} (KKM: ${quiz.passing_score}). Anda dapat mengulang kuis untuk remedial.`}
                </span>
              </div>
              <Badge
                variant={previousAttempt.passed ? "default" : "secondary"}
                className="self-start sm:self-auto"
              >
                {previousAttempt.passed ? "Lulus ✓" : "Perlu Remedial"}
              </Badge>
            </div>
            {quiz.feedback_mode === "after_submit" && (
              <Link
                href={`/student/kuis/${quiz.id}/review/${previousAttempt.attempt_id}`}
                className="mt-3 inline-block"
              >
                <Button variant="outline">Lihat pembahasan</Button>
              </Link>
            )}
          </CardContent>
        )}
      </Card>

      {/* Indikator Progres Menjawab */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 text-xs">
        <span className="font-medium text-muted-foreground">
          Progres Pengisian:{" "}
          <strong className="text-foreground">{answeredCount}</strong> dari{" "}
          {totalQuestions} soal
        </span>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{
              width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Daftar Soal */}
      {totalQuestions === 0 ? (
        <Card className="border-dashed text-center py-8">
          <CardHeader>
            <CardTitle className="text-base">
              Belum ada soal pada kuis ini
            </CardTitle>
            <CardDescription>
              Guru belum mengunggah butir soal untuk kuis ini.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayQuestions.map((q, qIdx) => {
            const selected = answers[q.id];

            return (
              <Card key={q.id} className="overflow-hidden border shadow-sm">
                <CardHeader className="bg-muted/20 pb-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {qIdx + 1}
                    </span>
                    <p className="font-medium text-sm text-foreground leading-relaxed">
                      {q.question_text}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selected === opt.key;
                      const displayKey = quiz.shuffle_options
                        ? (OPTION_LABELS[optIdx] ?? opt.key)
                        : opt.key;

                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => selectOption(q.id, opt.key)}
                          className={`flex items-center gap-3 rounded-lg border p-3 text-left text-xs transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary"
                              : "border-input bg-card hover:border-primary/40 hover:bg-muted/50"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-bold text-xs ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {displayKey}
                          </span>
                          <span className="leading-snug">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Tombol Kirim */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
            <Link href="/student">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali
              </Button>
            </Link>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !isAllAnswered}
              className="gap-2"
            >
              {submitting ? "Menilai Jawaban..." : "Kirim Jawaban Kuis"}
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL HASIL PENILAIAN KUIS */}
      {/* ==================================================================== */}
      <Modal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        title={
          result?.passed
            ? "Selamat, Anda Lulus!"
            : "Hasil Kuis — Perlu Remedial"
        }
        maxWidth="md"
      >
        <div className="space-y-5 text-center py-2">
          {result?.passed ? (
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Trophy className="h-8 w-8" />
            </div>
          ) : (
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RotateCcw className="h-8 w-8" />
            </div>
          )}

          <div>
            <p className="text-4xl font-extrabold tracking-tight">
              {result?.score}{" "}
              <span className="text-lg font-normal text-muted-foreground">
                / 100
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Jawaban Benar: {result?.correct_count} dari{" "}
              {result?.total_questions} Soal (KKM: {result?.passing_score}%)
            </p>
          </div>

          <div
            className={`rounded-lg p-3 text-xs border ${
              result?.passed
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                : "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300"
            }`}
          >
            {result?.passed ? (
              <p>
                Hebat! Nilai Anda memenuhi standar kelulusan. Materi pada
                modul/bab selanjutnya kini otomatis terbuka!
              </p>
            ) : (
              <p>
                Nilai Anda belum mencapai KKM ({result?.passing_score}%). Jangan
                berkecil hati, pelajari kembali materi dan klik tombol remedial
                di bawah untuk mengulang kuis.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {quiz.feedback_mode === "after_submit" && result?.attempt_id && (
              <Link
                href={`/student/kuis/${quiz.id}/review/${result.attempt_id}`}
                className="w-full"
              >
                <Button variant="outline" className="w-full">
                  Lihat pembahasan
                </Button>
              </Link>
            )}
            {result?.passed ? (
              <Link href="/student" className="w-full">
                <Button className="w-full gap-2">
                  Lanjut ke Pembelajaran Berikutnya{" "}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button
                onClick={handleRetryRemedial}
                variant="default"
                className="w-full gap-2"
              >
                <RotateCcw className="h-4 w-4" /> Ulangi Kuis (Remedial)
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setIsResultModalOpen(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
