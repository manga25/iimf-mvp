import { describe, expect, it } from "vitest";
import { checkSchedule, generateDraft, type EngineStudent } from "@/lib/scheduling";
import { toTime } from "@/lib/students/availability";
import { CEFR_LEVELS, type AvailabilityBlock } from "@/lib/students/types";
import { draftOf } from "./fixtures";

/** Small seeded PRNG (mulberry32) so failures are reproducible without extra dependencies. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomStudents(seed: number): EngineStudent[] {
  const r = rng(seed);
  const int = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  const n = int(1, 45);
  return Array.from({ length: n }, (_, i) => {
    const availability: AvailabilityBlock[] = Array.from({ length: int(1, 4) }, () => {
      const weekday = r() < 0.75 ? int(1, 5) : int(6, 7);
      const startSlot = int(0, 22);
      const endSlot = Math.min(24, startSlot + int(1, 8));
      return { weekday, start_time: toTime(480 + startSlot * 30), end_time: toTime(480 + endSlot * 30) };
    });
    const kind = r();
    const goal = kind < 0.45 ? "cambridge" : kind < 0.8 ? "school_support" : "individual";
    return {
      id: `s${seed}-${i}`,
      full_name: `Student ${int(1, 20)}`, // deliberately repeated names
      goal,
      cefr_level: goal === "cambridge" ? CEFR_LEVELS[int(0, 2)] : null, // few levels → real cohorts
      school_year: goal === "school_support" ? int(6, 8) : null,
      is_active: r() > 0.1,
      availability,
    } satisfies EngineStudent;
  });
}

describe("AC-3.4 the generated draft never violates H1–H6", () => {
  const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

  it.each(SEEDS)("random fixture #%i", (seed) => {
    const students = randomStudents(seed);
    const draft = draftOf(generateDraft(students));
    const { hard, soft } = checkSchedule(draft.groups, students);

    expect(hard).toEqual([]);
    // The engine also respects S1 and S2 (only manual edits may break them).
    expect(soft.filter((w) => w.code !== "S3")).toEqual([]);

    // Every active student is allocated or unallocated exactly once; inactive ones never appear.
    const active = students.filter((s) => s.is_active).map((s) => s.id).sort();
    const seen = [...draft.groups.flatMap((g) => g.member_ids), ...draft.unallocated.map((u) => u.student_id)].sort();
    expect(seen).toEqual(active);

    // AC-3.8 determinism on the same fixture.
    expect(generateDraft(students)).toEqual(generateDraft(students));
  });
});
