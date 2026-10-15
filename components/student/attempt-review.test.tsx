// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AttemptReview, type AttemptReviewItem } from "./attempt-review";

const items: AttemptReviewItem[] = [
  {
    question_id: "q1",
    question_text: "Soal pertama?",
    options: [
      { key: "A", text: "Jawaban satu" },
      { key: "B", text: "Jawaban dua" },
    ],
    student_answer: "A",
    correct_option: "A",
    is_correct: true,
    explanation: "Alasan pertama",
    order_index: 0,
  },
  {
    question_id: "q2",
    question_text: "Soal kedua?",
    options: [
      { key: "A", text: "Pilihan tiga" },
      { key: "B", text: "Pilihan empat" },
    ],
    student_answer: "A",
    correct_option: "B",
    is_correct: false,
    explanation: "Alasan kedua",
    order_index: 1,
  },
];

afterEach(cleanup);

describe("AttemptReview", () => {
  it("shows student answers, keys, explanations, and explicit correctness text", () => {
    render(<AttemptReview quizId="quiz" items={items} />);
    expect(screen.getAllByText("Jawaban Anda:")).toHaveLength(2);
    expect(screen.getAllByText("Kunci jawaban:")).toHaveLength(2);
    expect(screen.getByText("Alasan: Alasan pertama")).toBeTruthy();
    expect(screen.getByText("Benar")).toBeTruthy();
    expect(screen.getByText("Salah")).toBeTruthy();
  });

  it("filters to incorrect answers only", () => {
    render(<AttemptReview quizId="quiz" items={items} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Hanya yang salah/ }));
    expect(screen.queryByText(/Soal pertama/)).toBeNull();
    expect(screen.getByText(/Soal kedua/)).toBeTruthy();
    expect(screen.getByText("Alasan: Alasan kedua")).toBeTruthy();
  });
});
