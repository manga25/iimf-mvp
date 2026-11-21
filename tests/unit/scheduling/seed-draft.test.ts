import { describe, expect, it } from "vitest";
import { checkSchedule, generateDraft, type EngineStudent } from "@/lib/scheduling";
import { buildSeedStudents } from "@/lib/seed/build";
import { draftOf } from "./fixtures";

describe("engine on the Flow 3 seed dataset", () => {
  const students: EngineStudent[] = buildSeedStudents().map((s, i) => ({ ...s, id: `seed-${i}`, is_active: true }));
  const draft = draftOf(generateDraft(students));

  it("produces a draft with no hard violations", () => {
    expect(checkSchedule(draft.groups, students).hard).toEqual([]);
  });

  it("allocates most students", () => {
    const allocated = draft.groups.reduce((n, g) => n + g.member_ids.length, 0);
    expect(allocated + draft.unallocated.length).toBe(students.length);
    expect(allocated / students.length).toBeGreaterThan(0.8);
  });
});
