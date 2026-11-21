import { toMinutes, toTime } from "@/lib/students/availability";
import { isUuid } from "@/lib/students/types";
import type { EngineStudent, HardCode, Issue, SoftCode } from "@/lib/scheduling";
import { SM } from "./messages";
import type { StoredGroup } from "./types";
import { issueKey, validateDraft } from "./validate";

/** SPEC §3.4 manual edits. `assign` covers both "move between groups" and "assign an unallocated student". */
export type EditOp =
  | { type: "assign"; student_id: string; group_id: string }
  | { type: "remove"; student_id: string }
  | { type: "reschedule"; group_id: string; weekday: number; start_time: string };

export type EditResult =
  | { ok: true; groups: StoredGroup[]; warnings: Issue<SoftCode>[] }
  | { ok: false; status: 400 | 404; error: string; issues?: Issue<HardCode>[] };

/** Shape validation of an untrusted request body (server side, SPEC §3.9). */
export function parseEditOp(body: unknown): EditOp | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.type === "assign" && isUuid(b.student_id) && isUuid(b.group_id)) {
    return { type: "assign", student_id: b.student_id, group_id: b.group_id };
  }
  if (b.type === "remove" && isUuid(b.student_id)) return { type: "remove", student_id: b.student_id };
  if (b.type === "reschedule" && isUuid(b.group_id) && typeof b.weekday === "number" && typeof b.start_time === "string") {
    const start = toMinutes(b.start_time);
    if (start === null || !Number.isInteger(b.weekday)) return null;
    return { type: "reschedule", group_id: b.group_id, weekday: b.weekday, start_time: toTime(start) };
  }
  return null;
}

const without = (groups: StoredGroup[], studentId: string) =>
  groups
    .map((g) => ({ ...g, member_ids: g.member_ids.filter((id) => id !== studentId) }))
    .filter((g) => g.member_ids.length > 0); // a class left empty disappears

type Step = { ok: true; groups: StoredGroup[] } | { ok: false; status: 400 | 404; error: string };

function step(groups: StoredGroup[], students: EngineStudent[], op: EditOp): Step {
  if (op.type === "reschedule") {
    if (!groups.some((g) => g.id === op.group_id)) return { ok: false, status: 404, error: SM.groupNotFound };
    return {
      ok: true,
      groups: groups.map((g) => (g.id === op.group_id ? { ...g, weekday: op.weekday, start_time: op.start_time } : g)),
    };
  }

  const student = students.find((s) => s.id === op.student_id);
  if (!student) return { ok: false, status: 404, error: SM.studentNotFound };
  const current = groups.find((g) => g.member_ids.includes(op.student_id));

  if (op.type === "remove") {
    if (!current) return { ok: false, status: 400, error: SM.notInGroup };
    return { ok: true, groups: without(groups, op.student_id) };
  }

  if (!student.is_active) return { ok: false, status: 400, error: SM.studentInactive };
  if (!groups.some((g) => g.id === op.group_id)) return { ok: false, status: 404, error: SM.groupNotFound };
  if (current?.id === op.group_id) return { ok: false, status: 400, error: SM.alreadyInGroup };
  const next = without(groups, op.student_id);
  const target = next.find((g) => g.id === op.group_id);
  // The target can only vanish if it was the student's own group, which is excluded above.
  if (target) target.member_ids = [...target.member_ids, op.student_id];
  return { ok: true, groups: next };
}

/**
 * Applies one manual edit. It is blocked when it introduces a new hard violation
 * (H1–H6, AC-3.9); new soft issues (S1–S3) are returned as warnings and the edit is kept.
 * Issues that already existed (e.g. a deactivated member) don't block unrelated edits.
 */
export function applyEdit(groups: StoredGroup[], students: EngineStudent[], op: EditOp): EditResult {
  const result = step(groups, students, op);
  if (!result.ok) return result;

  const before = validateDraft(groups, students);
  const after = validateDraft(result.groups, students);
  const hadHard = new Set(before.hard.map(issueKey));
  const newHard = after.hard.filter((i) => !hadHard.has(issueKey(i)));
  if (newHard.length > 0) return { ok: false, status: 400, error: SM.blocked(newHard[0].message), issues: newHard };

  const hadSoft = new Set(before.soft.map(issueKey));
  return { ok: true, groups: result.groups, warnings: after.soft.filter((i) => !hadSoft.has(issueKey(i))) };
}
