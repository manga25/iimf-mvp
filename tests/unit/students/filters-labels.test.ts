import { describe, expect, it } from "vitest";
import { escapeLike, parseFilters } from "@/lib/students/filters";
import { formatHours, goalDetail } from "@/lib/students/labels";

describe("parseFilters", () => {
  it("defaults to active students of every goal (AC-2.6: the default list is active only)", () => {
    expect(parseFilters({})).toEqual({ q: "", goal: null, status: "active" });
  });

  it("reads valid values and ignores unknown ones", () => {
    expect(parseFilters({ q: "  Ana ", goal: "individual", status: "inactive" })).toEqual({ q: "Ana", goal: "individual", status: "inactive" });
    expect(parseFilters({ goal: "music", status: "deleted" })).toEqual({ q: "", goal: null, status: "active" });
    expect(parseFilters({ q: ["Rui", "x"], status: "all" })).toMatchObject({ q: "Rui", status: "all" });
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});

describe("labels", () => {
  it("describes the goal with its level or year", () => {
    expect(goalDetail({ goal: "cambridge", cefr_level: "B2", school_year: null })).toBe("Cambridge · B2");
    expect(goalDetail({ goal: "school_support", cefr_level: null, school_year: 7 })).toBe("School Support · Year 7");
    expect(goalDetail({ goal: "individual", cefr_level: null, school_year: null })).toBe("Individual");
  });

  it("formats hours", () => {
    expect(formatHours(90)).toBe("1.5 h");
    expect(formatHours(180)).toBe("3 h");
  });
});
