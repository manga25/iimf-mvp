import { describe, expect, it } from "vitest";
import { buildSeedStudents, parseSlot, SEED_STUDENTS, SeedDataError } from "@/lib/seed/build";
import { CEFR_LEVELS, type StudentInput } from "@/lib/students/types";

const students = buildSeedStudents();
const count = (pred: (s: StudentInput) => boolean) => students.filter(pred).length;

describe("seed dataset (SPEC §7 step 3)", () => {
  it("has about 40 students, all passing the Students form validation", () => {
    expect(SEED_STUDENTS).toHaveLength(40);
    expect(students).toHaveLength(40); // buildSeedStudents throws on any invalid record
  });

  it("covers every goal and every CEFR level", () => {
    expect(count((s) => s.goal === "cambridge")).toBe(18);
    expect(count((s) => s.goal === "school_support")).toBe(16);
    expect(count((s) => s.goal === "individual")).toBe(6);
    for (const level of CEFR_LEVELS) expect(count((s) => s.cefr_level === level)).toBeGreaterThan(0);
  });

  it("has the planned cohort sizes (C2 below 3 on purpose)", () => {
    const sizes = (key: (s: StudentInput) => string | number | null) =>
      students.reduce<Record<string, number>>((acc, s) => {
        const k = String(key(s));
        return { ...acc, [k]: (acc[k] ?? 0) + 1 };
      }, {});
    expect(sizes((s) => (s.goal === "cambridge" ? s.cefr_level : null))).toMatchObject({ A1: 3, A2: 3, B1: 4, B2: 3, C1: 3, C2: 2 });
    expect(sizes((s) => (s.goal === "school_support" ? s.school_year : null))).toMatchObject({ 5: 3, 7: 4, 9: 3, 10: 3, 12: 3 });
  });

  it("gives a guardian to every minor (school support, A1/A2) and none to adult Cambridge students", () => {
    const minors = students.filter((s) => s.goal === "school_support" || s.cefr_level === "A1" || s.cefr_level === "A2");
    expect(minors.every((s) => s.guardian_name && s.guardian_phone)).toBe(true);
    const adults = students.filter((s) => s.goal === "cambridge" && !["A1", "A2"].includes(s.cefr_level ?? ""));
    expect(adults.every((s) => s.guardian_name === null && s.guardian_phone === null)).toBe(true);
  });

  it("stores phones in E.164, all distinct, including one international number", () => {
    const phones = students.flatMap((s) => [s.phone, s.guardian_phone]).filter((p): p is string => p !== null);
    expect(phones.every((p) => /^\+[1-9]\d{7,14}$/.test(p))).toBe(true);
    expect(new Set(phones).size).toBe(phones.length);
    expect(phones).toContain("+447700900123");
    expect(students[0].phone).toBe("+351910000101");
  });

  it("gives every student availability, so generation is not blocked (AC-3.1)", () => {
    expect(students.every((s) => s.availability.length > 0)).toBe(true);
  });

  it("includes students available only at weekends", () => {
    const weekendOnly = students.filter((s) => s.availability.every((b) => b.weekday >= 6));
    expect(weekendOnly.map((s) => s.full_name).sort()).toEqual(["Emily Clarke", "Paulo Esteves"]);
  });
});

describe("parseSlot / buildSeedStudents errors", () => {
  it("parses the compact slot notation", () => {
    expect(parseSlot("Sun 10:00-11:30")).toEqual({ weekday: 7, start_time: "10:00", end_time: "11:30" });
    expect(() => parseSlot("Monday 9-10")).toThrow(SeedDataError);
  });

  it("reports every invalid record by name", () => {
    const bad = [
      { full_name: "No Level", phone: "910000001", goal: "cambridge" as const, slots: ["Mon 09:00-10:00"] },
      { full_name: "Early Bird", phone: "910000002", goal: "individual" as const, slots: ["Mon 07:00-08:00"] },
      { full_name: "Twin A", phone: "910000003", goal: "individual" as const, slots: ["Mon 09:00-10:00"] },
      { full_name: "Twin B", phone: "910000003", goal: "individual" as const, slots: ["Mon 09:00-10:00"] },
    ];
    try {
      buildSeedStudents(bad);
      expect.unreachable();
    } catch (e) {
      const problems = (e as SeedDataError).problems.join("\n");
      expect(problems).toMatch(/No Level: cefr_level/);
      expect(problems).toMatch(/Early Bird: availability/);
      expect(problems).toMatch(/Twin B: phone \+351910000003 is used twice/);
    }
  });
});
