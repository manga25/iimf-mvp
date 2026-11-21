import { describe, expect, it } from "vitest";
import { generateDraft, REASONS } from "@/lib/scheduling";
import { approvalSummary, EXTRA_REASONS, unallocatedStudents, validateDraft, type ScheduleStudent } from "@/lib/schedule";
import { cambridge, draftOf } from "../scheduling/fixtures";

const SLOTS = ["Tue 17:00-20:00"];
const CREATED = "2026-09-01T10:00:00Z";
const GENERATED = "2026-09-02T10:00:00Z";
const st = (s: ReturnType<typeof cambridge>, created_at = CREATED): ScheduleStudent => ({ ...s, created_at });

const b1 = Array.from({ length: 4 }, (_, i) => st(cambridge(`b1-${i}`, "B1", { slots: SLOTS, name: `B1 ${i}` })));
const c2 = [0, 1].map((i) => st(cambridge(`c2-${i}`, "C2", { slots: SLOTS, name: `C2 ${i}` })));
const students = [...b1, ...c2];
const draft = draftOf(generateDraft(students));

describe("unallocatedStudents (derived after reload)", () => {
  it("re-uses the engine's reasons for a freshly generated draft", () => {
    const list = unallocatedStudents(draft.groups, students, GENERATED);
    expect(list.map((u) => [u.student.id, u.reason])).toEqual([
      ["c2-0", REASONS.notEnough],
      ["c2-1", REASONS.notEnough],
    ]);
  });

  it("marks a student removed from their group as 'Removed manually'", () => {
    const groups = draft.groups.map((g) => ({ ...g, member_ids: g.member_ids.filter((m) => m !== "b1-0") }));
    const list = unallocatedStudents(groups, students, GENERATED);
    expect(list.find((u) => u.student.id === "b1-0")?.reason).toBe(EXTRA_REASONS.removed);
  });

  it("explains students added after generation and students without availability", () => {
    const late = st(cambridge("b1-new", "B1", { slots: SLOTS, name: "New" }), "2026-09-03T10:00:00Z");
    const empty = st(cambridge("b1-empty", "B1", { slots: [], name: "Empty" }));
    const list = unallocatedStudents(draft.groups, [...students, late, empty], GENERATED);
    expect(list.find((u) => u.student.id === "b1-new")?.reason).toBe(EXTRA_REASONS.added);
    expect(list.find((u) => u.student.id === "b1-empty")?.reason).toBe(EXTRA_REASONS.noAvailability);
  });

  it("ignores inactive students", () => {
    const inactive = students.map((s) => (s.id === "c2-0" ? { ...s, is_active: false } : s));
    expect(unallocatedStudents(draft.groups, inactive, GENERATED).map((u) => u.student.id)).toEqual(["c2-1"]);
  });
});

describe("validateDraft + approvalSummary", () => {
  it("a clean draft can be approved", () => {
    const s = approvalSummary(draft.groups, students, validateDraft(draft.groups, students));
    expect(s).toMatchObject({ classes: 1, allocated: 4, unallocated: 2, errors: 0, canApprove: true });
  });

  it("a deactivated member is a clear hard error that blocks approval (AC-3.11)", () => {
    const changed = students.map((s) => (s.id === "b1-0" ? { ...s, is_active: false } : s));
    const check = validateDraft(draft.groups, changed);
    expect(check.hard).toEqual([expect.objectContaining({ code: "H4", student_id: "b1-0", message: expect.stringContaining("has been deactivated") })]);
    expect(approvalSummary(draft.groups, changed, check).canApprove).toBe(false);
  });

  it("an empty draft cannot be approved", () => {
    expect(approvalSummary([], students, validateDraft([], students)).canApprove).toBe(false);
  });
});
