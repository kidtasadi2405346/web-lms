import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "supabase/migrations/0015_quiz_feedback_constraints.sql",
  ),
  "utf8",
);

describe("migration 0015 quiz feedback constraints", () => {
  it("limits question explanations to 1,000 characters", () => {
    expect(migration).toMatch(/char_length\(explanation\) <= 1000/i);
  });

  it("restricts review scheduling to feedback-enabled assessments after open_at", () => {
    expect(migration).toMatch(
      /type = 'assessment'[\s\S]*feedback_mode <> 'none'[\s\S]*review_at >= open_at/i,
    );
  });

  it("can be safely reapplied", () => {
    expect(migration.match(/drop constraint if exists/gi)).toHaveLength(2);
  });
});
