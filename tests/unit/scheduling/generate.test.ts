import { describe, expect, it } from "vitest";
import { generateDraft, REASONS } from "@/lib/scheduling";
import { ALL_WEEK, cambridge, draftOf, individual, levelCohort, schoolSupport } from "./fixtures";

describe("AC-3.5 weekdays preferred", () => {
  it("places a cohort available Tue 18:00 and Sat 10:00 on Tuesday", () => {
    const draft = draftOf(generateDraft(levelCohort(4, "B1", ["Sat 10:00-11:30", "Tue 18:00-19:30"])));
    expect(draft.groups).toHaveLength(1);
    expect(draft.groups[0]).toMatchObject({ weekday: 2, start_time: "18:00" });
  });

  it("uses the weekend when it is the only option", () => {
    const draft = draftOf(generateDraft(levelCohort(3, "A1", ["Sun 09:00-12:00"])));
    expect(draft.groups[0]).toMatchObject({ weekday: 7, start_time: "09:00" });
  });
});

describe("AC-3.6 cohorts are never mixed", () => {
  it("keeps levels and school years apart", () => {
    const students = [
      ...levelCohort(3, "B1", ALL_WEEK),
      ...levelCohort(3, "B2", ALL_WEEK),
      ...[1, 2, 3].map((i) => schoolSupport(`y7-${i}`, 7, { slots: ALL_WEEK })),
      ...[1, 2, 3].map((i) => schoolSupport(`y8-${i}`, 8, { slots: ALL_WEEK })),
    ];
    const byId = new Map(students.map((s) => [s.id, s]));
    const draft = draftOf(generateDraft(students));
    expect(draft.groups).toHaveLength(4);
    for (const g of draft.groups) {
      const members = g.member_ids.map((id) => byId.get(id)!);
      expect(new Set(members.map((m) => `${m.goal}:${m.cefr_level}:${m.school_year}`)).size).toBe(1);
      expect(members[0]).toMatchObject({ goal: g.goal, cefr_level: g.cefr_level, school_year: g.school_year });
    }
  });
});

describe("AC-3.7 durations", () => {
  it("gives 60 min to individual classes and 90 min to groups", () => {
    const draft = draftOf(generateDraft([...levelCohort(3, "C1", ALL_WEEK), individual("ind", { slots: ALL_WEEK })]));
    const ind = draft.groups.find((g) => g.goal === "individual")!;
    const grp = draft.groups.find((g) => g.goal === "cambridge")!;
    expect(ind.duration_min).toBe(60);
    expect(grp.duration_min).toBe(90);
  });
});

describe("AC-3.8 determinism", () => {
  const students = [
    ...levelCohort(9, "B1", ["Mon 16:00-20:00", "Wed 16:00-20:00"]),
    ...[1, 2, 3, 4].map((i) => schoolSupport(`y5-${i}`, 5, { slots: ["Tue 17:00-19:00", "Sat 09:00-12:00"] })),
    individual("i1", { slots: ["Mon 16:00-18:00"] }),
    individual("i2", { slots: ["Mon 16:00-18:00", "Thu 10:00-11:00"] }),
  ];

  it("returns identical output for identical input", () => {
    expect(generateDraft(students)).toEqual(generateDraft(students));
  });

  it("does not depend on input order", () => {
    expect(generateDraft([...students].reverse())).toEqual(generateDraft(students));
  });
});

describe("placement details", () => {
  it("prefers a slot adjacent to an already-placed class (compact day)", () => {
    const fixed = individual("fixed", { slots: ["Mon 14:00-15:00"] }); // only 1 slot → placed first
    const flexible = individual("flex", { slots: ["Mon 08:00-20:00"] });
    const draft = draftOf(generateDraft([flexible, fixed]));
    const at = (id: string) => draft.groups.find((g) => g.member_ids[0] === id)!.start_time;
    expect(at("fixed")).toBe("14:00");
    expect(at("flex")).toBe("13:00");
  });

  it("never overlaps classes, even across cohorts", () => {
    const draft = draftOf(generateDraft([...levelCohort(3, "B1", ["Mon 10:00-11:30"]), ...levelCohort(3, "B2", ["Mon 10:00-11:30"])]));
    expect(draft.groups).toHaveLength(1);
    expect(draft.unallocated.map((u) => u.reason)).toEqual(Array(3).fill(REASONS.taken));
  });

  it("names groups by cohort with letters, and individuals by student name", () => {
    const students = [
      ...levelCohort(9, "B2", ALL_WEEK),
      ...[1, 2, 3].map((i) => schoolSupport(`y7-${i}`, 7, { slots: ALL_WEEK })),
      individual("ana", { slots: ALL_WEEK, name: "Ana Silva" }),
    ];
    const names = draftOf(generateDraft(students)).groups.map((g) => g.name).sort();
    expect(names).toEqual(["Cambridge B2 · A", "Cambridge B2 · B", "Individual · Ana Silva", "Year 7 · A"]);
  });

  it("ignores inactive students", () => {
    const students = [...levelCohort(3, "A2", ALL_WEEK), cambridge("gone", "A2", { slots: ALL_WEEK, active: false })];
    const draft = draftOf(generateDraft(students));
    expect(draft.groups[0].member_ids).not.toContain("gone");
    expect(draft.unallocated).toEqual([]);
  });
});

describe("unallocation reasons (SPEC §3.4 step 7)", () => {
  it("reports no common availability when no slot has ≥ 2 peers", () => {
    const students = [
      cambridge("a", "C1", { slots: ["Mon 10:00-11:30"] }),
      cambridge("b", "C1", { slots: ["Tue 10:00-11:30"] }),
      cambridge("c", "C1", { slots: ["Wed 10:00-11:30"] }),
    ];
    const draft = draftOf(generateDraft(students));
    expect(draft.groups).toEqual([]);
    expect(draft.unallocated.every((u) => u.reason === REASONS.noCommon)).toBe(true);
  });

  it("reports taken slots for an individual who lost the only slot", () => {
    const draft = draftOf(generateDraft([
      individual("x", { slots: ["Mon 10:00-11:00"] }),
      individual("y", { slots: ["Mon 10:00-11:00"] }),
    ]));
    expect(draft.groups).toHaveLength(1);
    expect(draft.unallocated).toHaveLength(1);
    expect(draft.unallocated[0].reason).toBe(REASONS.taken);
  });

  it("reports taken slots for an individual with no 60-minute window", () => {
    const draft = draftOf(generateDraft([individual("short", { slots: ["Mon 10:00-10:30", "Tue 12:00-12:30"] })]));
    expect(draft.groups).toEqual([]);
    expect(draft.unallocated).toEqual([{ student_id: "short", reason: REASONS.taken }]);
  });
});
