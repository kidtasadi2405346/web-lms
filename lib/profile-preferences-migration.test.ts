import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/0016_profile_preferences.sql"),
  "utf8",
);

describe("migration 0016 profile preferences", () => {
  it("adds validated, uniquely indexed profile preferences", () => {
    expect(migration).toMatch(/add column if not exists username text/i);
    expect(migration).toMatch(/add column if not exists avatar_url text/i);
    expect(migration).toMatch(/theme in \('light', 'dark', 'system'\)/i);
    expect(migration).toMatch(/audio_enabled boolean not null default true/i);
    expect(migration).toMatch(/create unique index if not exists profiles_username_unique_idx/i);
  });

  it("allows users to update only preference columns on their own profile", () => {
    expect(migration).toMatch(/using \(id = auth\.uid\(\)\)[\s\S]*with check \(id = auth\.uid\(\)\)/i);
    expect(migration).toMatch(
      /grant update \(username, avatar_url, theme, audio_enabled\)\s+on public\.profiles to authenticated/i,
    );
    expect(migration).toMatch(/revoke update on public\.profiles from authenticated/i);
  });

  it("limits avatar storage to 2 MB and owner-scoped writes", () => {
    expect(migration).toMatch(/'profile-avatars'[\s\S]*2097152/i);
    expect(migration).toMatch(
      /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i,
    );
  });
});
