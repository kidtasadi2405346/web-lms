// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PerQuestionQuizRunner } from "./per-question-quiz-runner";

const { startQuizMock, answerQuestionMock, finishQuizMock } = vi.hoisted(
  () => ({
    startQuizMock: vi.fn(),
    answerQuestionMock: vi.fn(),
    finishQuizMock: vi.fn(),
  }),
);

vi.mock("@/lib/actions/quiz", () => ({
  startQuizAction: startQuizMock,
  answerQuestionAction: answerQuestionMock,
  finishQuizAction: finishQuizMock,
}));

vi.mock("@/lib/sounds", () => ({
  playQuizSound: vi.fn(),
  prepareQuizAudio: vi.fn(),
}));

const quiz = {
  id: "quiz-1",
  title: "Kuis contoh",
  passing_score: 70,
  module_title: "Bab 1",
  subject_name: "Fisika",
  class_name: "Kelas X",
  sound_effects: false,
  shuffle_questions: false,
  shuffle_options: false,
};

const questions = [
  {
    id: "q1",
    question_text: "Pertanyaan satu?",
    options: [
      { key: "A", text: "Opsi A" },
      { key: "B", text: "Opsi B" },
    ],
    order_index: 0,
  },
  {
    id: "q2",
    question_text: "Pertanyaan dua?",
    options: [
      { key: "A", text: "Opsi C" },
      { key: "B", text: "Opsi D" },
    ],
    order_index: 1,
  },
];

beforeEach(() => {
  startQuizMock
    .mockReset()
    .mockResolvedValue({ success: true, attemptId: "attempt-1", answers: {} });
  answerQuestionMock.mockReset().mockResolvedValue({
    success: true,
    feedback: {
      is_correct: false,
      correct_answer: "B",
      explanation: "Alasan guru",
    },
  });
  finishQuizMock.mockReset().mockResolvedValue({
    success: true,
    result: {
      attempt_id: "attempt-1",
      score: 0,
      passing_score: 70,
      passed: false,
      total_questions: 1,
      correct_count: 0,
    },
  });
});

afterEach(cleanup);

describe("PerQuestionQuizRunner", () => {
  it("hides keys before answering, reveals one correction, locks the answer, and finishes", async () => {
    render(<PerQuestionQuizRunner quiz={quiz} questions={[questions[0]!]} />);
    await screen.findByText("Pertanyaan satu?");
    expect(screen.queryByText(/Kunci jawaban/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Opsi A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Jawab/ }));

    await screen.findByText("Opsi B");
    expect(screen.getByText("Kunci jawaban:", { exact: false })).toBeTruthy();
    expect(screen.getByText(/Alasan: Alasan guru/)).toBeTruthy();
    expect(answerQuestionMock).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: /Opsi A/ }).hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));
    await screen.findByText("Belum lulus");
    expect(finishQuizMock).toHaveBeenCalledWith("quiz-1", "attempt-1");
  });

  it("resumes at the first unanswered question without loading a key for it", async () => {
    startQuizMock.mockResolvedValueOnce({
      success: true,
      attemptId: "attempt-1",
      answers: { q1: "A" },
    });
    render(<PerQuestionQuizRunner quiz={quiz} questions={questions} />);

    await waitFor(() => expect(screen.getByText("Soal 2 dari 2")).toBeTruthy());
    expect(screen.getByText("Pertanyaan dua?")).toBeTruthy();
    expect(screen.queryByText(/Kunci jawaban/)).toBeNull();
  });

  it("skips already-saved questions when moving forward after a resumed answer", async () => {
    startQuizMock.mockResolvedValueOnce({
      success: true,
      attemptId: "attempt-1",
      answers: { q2: "B" },
    });
    render(<PerQuestionQuizRunner quiz={quiz} questions={questions} />);

    await screen.findByText("Pertanyaan satu?");
    fireEvent.click(screen.getByRole("button", { name: /Opsi A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Jawab/ }));
    await screen.findByText(/Jawaban Anda belum benar/);
    fireEvent.click(screen.getByRole("button", { name: "Lanjut" }));
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));

    await screen.findByText("Belum lulus");
    expect(finishQuizMock).toHaveBeenCalledOnce();
  });
});
