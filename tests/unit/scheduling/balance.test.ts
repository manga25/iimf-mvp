import { describe, expect, it } from "vitest";
import { generateDraft, REASONS } from "@/lib/scheduling";
import { nextTargetSize } from "@/lib/scheduling/allocate";
import { ALL_WEEK, draftOf, levelCohort, sizes } from "./fixtures";

describe("AC-3.2 balanced group sizes", () => {
  it.each([
    [9, [5, 4]],
    [14, [7, 7]],
    [15, [5, 5, 5]],
    [8, [4, 4]],
    [7, [7]],
    [3, [3]],
    [10, [5, 5]],
  ])("%i compatible B1 students → %j", (n, expected) => {
    const draft = draftOf(generateDraft(levelCohort(n, "B1", ALL_WEEK)));
    expect(sizes(draft.groups)).toEqual(expected);
    expect(draft.unallocated).toEqual([]);
  });

  it("never splits into 7 + 2", () => {
    for (let n = 3; n <= 30; n++) {
      const s = sizes(draftOf(generateDraft(levelCohort(n, "A2", ALL_WEEK))).groups);
      expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1);
      expect(s.length).toBe(Math.ceil(n / 7));
    }
  });

  it("target size follows ceil(r / ceil(r/7))", () => {
    expect([3, 7, 8, 9, 14, 15, 22].map(nextTargetSize)).toEqual([3, 7, 4, 5, 7, 5, 6]);
  });
});

describe("AC-3.3 cohorts below 3 students", () => {
  it("2 compatible C2 students are both unallocated", () => {
    const draft = draftOf(generateDraft(levelCohort(2, "C2", ALL_WEEK)));
    expect(draft.groups).toEqual([]);
    expect(draft.unallocated).toEqual([
      { student_id: "C2-01", reason: REASONS.notEnough },
      { student_id: "C2-02", reason: REASONS.notEnough },
    ]);
  });
});

describe("availability-forced sizes (SPEC §3.4 step 8)", () => {
  it("fills a group to 7 with leftovers before declaring them unallocated", () => {
    // 9 students who all share a single slot: one class of 7, 2 left over.
    const draft = draftOf(generateDraft(levelCohort(9, "B2", ["Mon 10:00-11:30"])));
    expect(sizes(draft.groups)).toEqual([7]);
    expect(draft.unallocated).toHaveLength(2);
    expect(draft.unallocated.every((u) => u.reason === REASONS.taken)).toBe(true);
  });
});
