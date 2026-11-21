import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// AC-9.2: no secrets in the repo; .env.local is git-ignored; .env.example documents required vars.
describe("environment configuration (AC-9.2)", () => {
  it(".env.example documents the required variables", () => {
    const example = readFileSync(".env.example", "utf8");
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
      expect(example).toMatch(new RegExp(`^${key}=`, "m"));
    }
  });

  it(".env.local is git-ignored and .env.example is not", () => {
    const check = (path: string) => {
      try {
        execFileSync("git", ["check-ignore", "-q", path]);
        return true;
      } catch {
        return false;
      }
    };
    expect(check(".env.local")).toBe(true);
    expect(check(".env.example")).toBe(false);
  });
});
