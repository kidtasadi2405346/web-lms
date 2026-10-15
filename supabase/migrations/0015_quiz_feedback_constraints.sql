-- Mini LMS - Migration 0015: Batas pembahasan kuis

alter table public.question_keys
  drop constraint if exists question_keys_explanation_max_length_check;

alter table public.question_keys
  add constraint question_keys_explanation_max_length_check
  check (explanation is null or char_length(explanation) <= 1000);

alter table public.quizzes
  drop constraint if exists quizzes_review_at_check;

alter table public.quizzes
  add constraint quizzes_review_at_check
  check (
    review_at is null or (
      type = 'assessment'
      and feedback_mode <> 'none'
      and (open_at is null or review_at >= open_at)
    )
  );
