import Link from "next/link";
import { ArrowLeft, Clock3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AttemptReview,
  type AttemptReviewItem,
} from "@/components/student/attempt-review";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string; attemptId: string }>;
}

export default async function QuizAttemptReviewPage({ params }: PageProps) {
  await requireRole("student");
  const { id: quizId, attemptId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt_review", {
    p_attempt_id: attemptId,
  });

  if (error) {
    const scheduledAt = error.message.match(/dibuka pada (.+?) WIB/i)?.[1];
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card
          className={
            scheduledAt ? "border-amber-500/30" : "border-destructive/30"
          }
        >
          <CardHeader>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${scheduledAt ? "bg-amber-500/10 text-amber-700" : "bg-destructive/10 text-destructive"}`}
            >
              {scheduledAt ? (
                <Clock3 className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
            <CardTitle>
              {scheduledAt
                ? "Pembahasan belum dibuka"
                : "Pembahasan tidak tersedia"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p role="alert" className="text-sm">
              {scheduledAt
                ? `Pembahasan dibuka pada ${scheduledAt} WIB.`
                : error.message.includes("tidak menyediakan pembahasan")
                  ? "Kuis ini tidak menyediakan pembahasan."
                  : "Percobaan tidak ditemukan atau pembahasan belum dapat dibuka."}
            </p>
            <Link href={`/student/kuis/${quizId}`}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke kuis
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = Array.isArray(data) ? (data as AttemptReviewItem[]) : [];
  return <AttemptReview quizId={quizId} items={items} />;
}
