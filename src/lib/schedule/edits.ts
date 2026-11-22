import { toMinutes, toTime } from "@/lib/students/availability";
import { WEEKDAY_LABELS } from "@/lib/students/labels";
import { isUuid } from "@/lib/students/types";
import { durationFor, type EngineStudent, type HardCode, type Issue, type SoftCode } from "@/lib/scheduling";
import { covers, toIntervals } from "@/lib/scheduling/time";
import { SM } from "./messages";
import type { StoredGroup } from "./types";
import { issueKey, validateDraft } from "./validate";

/**
 * SPEC §3.4 manual edits. `assign` covers both "move between groups" and "assign an unallocated student";
 * `create_individual` gives an unallocated Individual student a new class of their own.
 */
export type EditOp =
  | { type: "assign"; student_id: string; group_id: string }
  | { type: "remove"; student_id: string }
  | { type: "reschedule"; group_id: string; weekday: number; start_time: string }
  | { type: "create_individual"; student_id: string; weekday: number; start_time: string };

export type EditResult =
  | { ok: true; groups: StoredGroup[]; warnings: Issue<SoftCode>[] }
  | { ok: false; status: 400 | 404; error: string; issues?: Issue<HardCode>[] };

/** `{ weekday, start_time }` of an untrusted body, with the time normalised to "HH:MM". */
function parseSlot(b: Record<string, unknown>): { weekday: number; start_time: string } | null {
  if (typeof b.weekday !== "number" || !Number.isInteger(b.weekday) || typeof b.start_time !== "string") return null;
  const start = toMinutes(b.start_time);
  return start === null ? null : { weekday: b.weekday, start_time: toTime(start) };
}

/** Shape validation of an untrusted request body (server side, SPEC §3.9). */
export function parseEditOp(body: unknown): EditOp | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.type === "assign" && isUuid(b.student_id) && isUuid(b.group_id)) {
    return { type: "assign", student_id: b.student_id, group_id: b.group_id };
  }
  if (b.type === "remove" && isUuid(b.student_id)) return { type: "remove", student_id: b.student_id };
  const slot = parseSlot(b);
  if (b.type === "reschedule" && isUuid(b.group_id) && slot) return { type: "reschedule", group_id: b.group_id, ...slot };
  if (b.type === "create_individual" && isUuid(b.student_id) && slot) {
    return { type: "create_individual", student_id: b.student_id, ...slot };
  }
  return null;
}

const without = (groups: StoredGroup[], studentId: string) =>
  groups
    .map((g) => ({ ...g, member_ids: g.member_ids.filter((id) => id !== studentId) }))
    .filter((g) => g.member_ids.length > 0); // a class left empty disappears

type Step = { ok: true; groups: StoredGroup[]; timed?: string } | { ok: false; status: 400 | 404; error: string };

function step(groups: StoredGroup[], students: EngineStudent[], op: EditOp, newId: () => string): Step {
  if (op.type === "reschedule") {
    if (!groups.some((g) => g.id === op.group_id)) return { ok: false, status: 404, error: SM.groupNotFound };
    return {
      ok: true,
      timed: op.group_id,
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

  if (op.type === "create_individual") {
    if (student.goal !== "individual") return { ok: false, status: 400, error: SM.notIndividual };
    if (current) return { ok: false, status: 400, error: SM.alreadyAllocated };
    const id = newId();
    const created: StoredGroup = {
      id, name: `Individual · ${student.full_name}`, goal: "individual", cefr_level: null, school_year: null,
      weekday: op.weekday, start_time: op.start_time, duration_min: durationFor("individual"), member_ids: [student.id],
    };
    return { ok: true, timed: id, groups: [...groups, created] };
  }

  if (!groups.some((g) => g.id === op.group_id)) return { ok: false, status: 404, error: SM.groupNotFound };
  if (current?.id === op.group_id) return { ok: false, status: 400, error: SM.alreadyInGroup };
  const next = without(groups, op.student_id);
  const target = next.find((g) => g.id === op.group_id);
  // The target can only vanish if it was the student's own group, which is excluded above.
  if (target) target.member_ids = [...target.member_ids, op.student_id];
  return { ok: true, groups: next };
}

/** Members of `g` who are not available for the whole class interval (S2). */
function unavailableMembers(g: StoredGroup, students: EngineStudent[]): string[] {
  const start = toMinutes(g.start_time) ?? 0;
  const cls = { weekday: g.weekday, start, end: start + g.duration_min };
  return g.member_ids
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is EngineStudent => !!s && !covers(toIntervals(s.availability), cls))
    .map((s) => s.full_name);
}

const slotLabel = (g: StoredGroup) => {
  const start = toMinutes(g.start_time) ?? 0;
  return `${WEEKDAY_LABELS[g.weekday - 1] ?? "?"} ${g.start_time}–${toTime(start + g.duration_min)}`;
};

/**
 * Applies one manual edit. It is blocked when it introduces a new hard violation
 * (H1–H6, AC-3.9), and a time change / new individual class is also blocked when a
 * member isn't available for it. Other new soft issues (S1–S3) are returned as
 * warnings and the edit is kept. Issues that already existed (e.g. a deactivated
 * member) don't block unrelated edits.
 */
export function applyEdit(
  groups: StoredGroup[],
  students: EngineStudent[],
  op: EditOp,
  newId: () => string = () => crypto.randomUUID(),
): EditResult {
  const result = step(groups, students, op, newId);
  if (!result.ok) return result;

  const before = validateDraft(groups, students);
  const after = validateDraft(result.groups, students);
  const hadHard = new Set(before.hard.map(issueKey));
  const newHard = after.hard.filter((i) => !hadHard.has(issueKey(i)));
  if (newHard.length > 0) return { ok: false, status: 400, error: SM.blocked(newHard[0].message), issues: newHard };

  const timed = result.timed && result.groups.find((g) => g.id === result.timed);
  if (timed) {
    const missing = unavailableMembers(timed, students);
    if (missing.length > 0) return { ok: false, status: 400, error: SM.outsideAvailability(missing, slotLabel(timed)) };
  }

  const hadSoft = new Set(before.soft.map(issueKey));
  return { ok: true, groups: result.groups, warnings: after.soft.filter((i) => !hadSoft.has(issueKey(i))) };
}
