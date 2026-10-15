"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileQuestion,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  answerQuestionAction,
  finishQuizAction,
  startQuizAction,
  type PerQuestionAnswerFeedback,
} from "@/lib/actions/quiz";
import { playQuizSound, prepareQuizAudio } from "@/lib/sounds";
import type { QuizSubmissionResult } from "@/lib/types";

type QuestionItem = {
  id: string;
  question_text: string;
  options: { key: string; text: string }[];
  order_index: number;
};

interface PerQuestionQuizRunnerProps {
  quiz: {
    id: string;
    title: string;
    passing_score: number;
    module_title: string;
    subject_name: string;
    class_name: string;
    sound_effects: boolean;
    shuffle_questions: boolean;
    shuffle_options: boolean;
  };
  questions: QuestionItem[];
}

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function prepareQuestions(
  items: QuestionItem[],
  shuffleQuestions: boolean,
  shuffleOptions: boolean,
) {
  const result = items.map((question) => ({
    ...question,
    options: shuffleOptions
      ? shuffled(question.options)
      : [...question.options],
  }));
  return shuffleQuestions ? shuffled(result) : result;
}

export function PerQuestionQuizRunner({
  quiz,
  questions,
}: PerQuestionQuizRunnerProps) {
  const [displayQuestions, setDisplayQuestions] = useState<QuestionItem[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [feedback, setFeedback] = useState<
    (PerQuestionAnswerFeedback & { student_answer: string }) | null
  >(null);
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSoundMuted(
        window.localStorage.getItem("mini-lms-quiz-sound-muted") === "true",
      );
    } catch {
      setSoundMuted(false);
    }

    let cancelled = false;
    async function resumeAttempt() {
      const response = await startQuizAction(quiz.id);
      if (cancelled) return;
      if (!response.success || !response.attemptId) {
        setError(response.error || "Kuis gagal dimulai.");
        setLoading(false);
        return;
      }
      const orderedQuestions = prepareQuestions(
        questions,
        quiz.shuffle_questions,
        quiz.shuffle_options,
      );
      const answers = response.answers ?? {};
      const nextQuestion = orderedQuestions.findIndex(
        (question) => !(question.id in answers),
      );
      setDisplayQuestions(orderedQuestions);
      setAttemptId(response.attemptId);
      setSavedAnswers(answers);
      setQuestionIndex(
        nextQuestion < 0 ? orderedQuestions.length : nextQuestion,
      );
      setLoading(false);
    }
    void resumeAttempt();
    return () => {
      cancelled = true;
    };
  }, [quiz.id, quiz.shuffle_options, quiz.shuffle_questions, questions]);

  function toggleSound() {
    setSoundMuted((muted) => {
      const nextMuted = !muted;
      try {
        window.localStorage.setItem(
          "mini-lms-quiz-sound-muted",
          String(nextMuted),
        );
      } catch {
        // The preference can remain session-local if storage is unavailable.
      }
      return nextMuted;
    });
  }

  async function handleAnswer() {
    const question = displayQuestions[questionIndex];
    if (!attemptId || !question || !selectedAnswer || feedback) return;
    prepareQuizAudio(quiz.sound_effects && !soundMuted);
    setWorking(true);
    setError(null);
    const response = await answerQuestionAction(
      attemptId,
      question.id,
      selectedAnswer,
    );
    setWorking(false);
    if (!response.success || !response.feedback) {
      setError(response.error || "Jawaban gagal disimpan.");
      return;
    }
    const revealed = { ...response.feedback, student_answer: selectedAnswer };
    setFeedback(revealed);
    setSavedAnswers((current) => ({
      ...current,
      [question.id]: selectedAnswer,
    }));
    playQuizSound(
      revealed.is_correct ? "correct" : "incorrect",
      quiz.sound_effects && !soundMuted,
    );
  }

  async function handleFinish() {
    if (!attemptId) return;
    prepareQuizAudio(quiz.sound_effects && !soundMuted);
    setWorking(true);
    setError(null);
    const response = await finishQuizAction(quiz.id, attemptId);
    setWorking(false);
    if (!response.success || !response.result) {
      setError(response.error || "Kuis gagal diselesaikan.");
      return;
    }
    setResult(response.result);
    playQuizSound(
      response.result.passed ? "passed" : "not-passed",
      quiz.sound_effects && !soundMuted,
    );
  }

  function handleNext() {
    const currentQuestion = displayQuestions[questionIndex];
    if (!currentQuestion || !feedback) return;
    const nextAnswers = {
      ...savedAnswers,
      [currentQuestion.id]: feedback.student_answer,
    };
    setSavedAnswers(nextAnswers);
    setFeedback(null);
    setSelectedAnswer("");
    const nextQuestion = displayQuestions.findIndex(
      (question) => !(question.id in nextAnswers),
    );
    setQuestionIndex(nextQuestion < 0 ? displayQuestions.length : nextQuestion);
  }

  const question = displayQuestions[questionIndex];
  const isComplete =
    !loading &&
    displayQuestions.length > 0 &&
    questionIndex >= displayQuestions.length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {quiz.class_name} · {quiz.subject_name} · {quiz.module_title}
          </p>
          <h1 className="mt-1 text-xl font-semibold">{quiz.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Mode per soal</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={!soundMuted}
            onClick={toggleSound}
          >
            {soundMuted ? "Suara mati" : "Suara aktif"}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Memuat percobaan kuis...
          </CardContent>
        </Card>
      ) : error && !attemptId ? (
        <Card className="border-destructive/40">
          <CardContent className="space-y-3 py-6 text-sm">
            <p role="alert" className="text-destructive">
              {error}
            </p>
            <Link href="/student/kuis">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke daftar kuis
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : result ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full ${result.passed ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}
            >
              {result.passed ? (
                <Trophy className="h-7 w-7" />
              ) : (
                <RotateCcw className="h-7 w-7" />
              )}
            </div>
            <CardTitle aria-live="polite">
              {result.passed ? "Lulus" : "Belum lulus"}
            </CardTitle>
            <CardDescription>
              Nilai {result.score} dari 100 · {result.correct_count} benar dari{" "}
              {result.total_questions} soal · KKM {result.passing_score}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/student/kuis">
              <Button variant="outline">Kembali ke daftar kuis</Button>
            </Link>
          </CardContent>
        </Card>
      ) : displayQuestions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm">
            Kuis ini belum memiliki soal.
          </CardContent>
        </Card>
      ) : isComplete ? (
        <Card>
          <CardHeader>
            <CardTitle>Semua jawaban sudah tersimpan</CardTitle>
            <CardDescription>
              Anda dapat menyelesaikan percobaan kuis ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={handleFinish} disabled={working}>
              {working ? "Menyelesaikan..." : "Selesai"}
            </Button>
          </CardContent>
        </Card>
      ) : question ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {questionIndex + 1}
              </span>
              <div className="space-y-1">
                <CardTitle className="text-base">
                  {question.question_text}
                </CardTitle>
                <CardDescription>
                  Soal {questionIndex + 1} dari {displayQuestions.length}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const studentChoice =
                feedback &&
                question.options.find(
                  (option) => option.key === feedback.student_answer,
                );
              const correctChoice =
                feedback &&
                question.options.find(
                  (option) => option.key === feedback.correct_answer,
                );
              return feedback ? (
                <div
                  aria-live="polite"
                  className={`space-y-2 rounded-md border p-3 ${feedback.is_correct ? "border-emerald-600/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {feedback.is_correct ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    {feedback.is_correct
                      ? "Jawaban Anda benar."
                      : "Jawaban Anda belum benar."}
                  </p>
                  <p className="text-sm">
                    Jawaban Anda:{" "}
                    <strong>
                      {studentChoice?.text ?? feedback.student_answer}
                    </strong>
                  </p>
                  <p className="text-sm">
                    Kunci jawaban:{" "}
                    <strong>
                      {correctChoice?.text ?? feedback.correct_answer}
                    </strong>
                  </p>
                  {feedback.explanation && (
                    <p className="whitespace-pre-wrap text-sm">
                      Alasan: {feedback.explanation}
                    </p>
                  )}
                </div>
              ) : null;
            })()}
            <div className="grid gap-2 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => {
                const isSelected = selectedAnswer === option.key;
                const isStudentAnswer = feedback?.student_answer === option.key;
                const isCorrectAnswer = feedback?.correct_answer === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={Boolean(feedback) || working}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedAnswer(option.key)}
                    className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm disabled:cursor-default ${isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"} ${feedback && isCorrectAnswer ? "border-emerald-600" : ""} ${feedback && isStudentAnswer && !feedback.is_correct ? "border-destructive" : ""}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-semibold">
                      {quiz.shuffle_options
                        ? (OPTION_LABELS[optionIndex] ?? option.key)
                        : option.key}
                    </span>
                    <span className="flex-1">{option.text}</span>
                    {feedback && isCorrectAnswer && (
                      <span className="text-xs font-semibold text-emerald-700">
                        Kunci benar
                      </span>
                    )}
                    {feedback && isStudentAnswer && !feedback.is_correct && (
                      <span className="text-xs font-semibold text-destructive">
                        Jawaban Anda
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                <AlertCircle className="mr-1 inline h-4 w-4" />
                {error}
              </p>
            )}

            <div className="flex justify-between gap-2 border-t pt-4">
              <Link href="/student/kuis">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Keluar
                </Button>
              </Link>
              {!feedback ? (
                <Button
                  onClick={handleAnswer}
                  disabled={working || !selectedAnswer}
                >
                  {working ? "Memeriksa..." : "Jawab"}
                  <FileQuestion className="ml-2 h-4 w-4" />
                </Button>
              ) : questionIndex === displayQuestions.length - 1 ? (
                <Button onClick={handleFinish} disabled={working}>
                  {working ? "Menyelesaikan..." : "Selesai"}
                </Button>
              ) : (
                <Button onClick={handleNext}>Lanjut</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
