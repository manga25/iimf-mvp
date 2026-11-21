import { generateDraft, type DraftGroup } from "@/lib/scheduling";
import { EXTRA_REASONS, type ScheduleStudent, type UnallocatedStudent } from "./types";

/**
 * Active students who are in no class of the draft, with a reason (SPEC §4: derived).
 * The engine is deterministic, so re-running it gives the original reasons; a student
 * the engine would have placed was removed manually or added after generation.
 */
export function unallocatedStudents(
  groups: DraftGroup[],
  students: ScheduleStudent[],
  generatedAt: string | null,
): UnallocatedStudent[] {
  const placed = new Set(groups.flatMap((g) => g.member_ids));
  const active = students.filter((s) => s.is_active);
  const left = active.filter((s) => !placed.has(s.id));
  if (left.length === 0) return [];

  const withAvailability = active.filter((s) => s.availability.length > 0);
  const engine = generateDraft(withAvailability);
  const engineReason = new Map(engine.ok ? engine.draft.unallocated.map((u) => [u.student_id, u.reason as string]) : []);
  const generated = generatedAt ? Date.parse(generatedAt) : null;

  const reasonFor = (s: ScheduleStudent): string => {
    if (s.availability.length === 0) return EXTRA_REASONS.noAvailability;
    if (generated !== null && Date.parse(s.created_at) > generated) return EXTRA_REASONS.added;
    return engineReason.get(s.id) ?? EXTRA_REASONS.removed;
  };

  return left
    .map((student) => ({ student, reason: reasonFor(student) }))
    .sort((a, b) => a.student.full_name.localeCompare(b.student.full_name, "en"));
}
