"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ListFilter, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AttemptReviewItem = {
  question_id: string;
  question_text: string;
  options: { key: string; text: string }[];
  student_answer: string;
  correct_option: string;
  is_correct: boolean;
  explanation: string | null;
  order_index: number;
};

interface AttemptReviewProps {
  quizId: string;
  items: AttemptReviewItem[];
}

export function AttemptReview({ quizId, items }: AttemptReviewProps) {
  const [onlyIncorrect, setOnlyIncorrect] = useState(false);
  const displayedItems = onlyIncorrect
    ? items.filter((item) => !item.is_correct)
    : items;
  const correctCount = items.filter((item) => item.is_correct).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/student/kuis/${quizId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke kuis
          </Link>
          <h1 className="mt-3 text-xl font-semibold">Tinjauan jawaban</h1>
          <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
            Hasil: {correctCount} benar dari {items.length} soal.
          </p>
        </div>
        <Badge variant="outline">Pembahasan</Badge>
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={onlyIncorrect}
          onChange={(event) => setOnlyIncorrect(event.target.checked)}
        />
        <ListFilter className="h-4 w-4" />
        Hanya yang salah
      </label>

      {displayedItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Tidak ada soal salah untuk ditampilkan.
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {displayedItems.map((item, index) => {
            const selected = item.options.find(
              (option) => option.key === item.student_answer,
            );
            const correct = item.options.find(
              (option) => option.key === item.correct_option,
            );
            return (
              <li key={item.question_id}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-start gap-2 text-base">
                      {item.is_correct ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                      )}
                      <span>
                        {index + 1}. {item.question_text}
                      </span>
                    </CardTitle>
                    <p className="ml-7 text-sm font-medium">
                      {item.is_correct ? "Benar" : "Salah"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p className="rounded-md border p-3">
                        Jawaban Anda:{" "}
                        <strong>
                          {selected
                            ? `${selected.key}. ${selected.text}`
                            : "Belum dijawab"}
                        </strong>
                      </p>
                      <p className="rounded-md border border-emerald-700/30 p-3">
                        Kunci jawaban:{" "}
                        <strong>
                          {correct
                            ? `${correct.key}. ${correct.text}`
                            : item.correct_option}
                        </strong>
                      </p>
                    </div>
                    {item.explanation && (
                      <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">
                        Alasan: {item.explanation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <div>
        <Link href={`/student/kuis/${quizId}`}>
          <Button variant="outline">Kembali ke kuis</Button>
        </Link>
      </div>
    </div>
  );
}
