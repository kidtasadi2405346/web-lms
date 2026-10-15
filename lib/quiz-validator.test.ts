import { describe, expect, it } from "vitest";
import { quizSchema } from "./quiz-validator";

const chapterData = {
  type: "chapter" as const,
  module_id: "123e4567-e89b-12d3-a456-426614174000",
  title: "Kuis bab",
  passing_score: 70,
  feedback_mode: "per_question" as const,
  shuffle_questions: false,
  shuffle_options: false,
};

describe("quizSchema", () => {
  it("menerima feedback per-question untuk kuis bab", () => {
    const result = quizSchema.safeParse(chapterData);
    expect(result.success).toBe(true);
  });

  it("menolak feedback per-question untuk kuis penilaian", () => {
    const result = quizSchema.safeParse({
      ...chapterData,
      type: "assessment",
      class_id: "123e4567-e89b-12d3-a456-426614174001",
      subject_id: "123e4567-e89b-12d3-a456-426614174002",
      feedback_mode: "per_question",
    });
    expect(result.success).toBe(false);
  });

  it("menolak review_at sebelum open_at", () => {
    const result = quizSchema.safeParse({
      ...chapterData,
      open_at: "2026-01-05T08:00:00.000Z",
      review_at: "2026-01-04T08:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
