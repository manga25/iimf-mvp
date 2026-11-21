import { findStudentsWithoutAvailability } from "@/lib/scheduling";
import { goalDetail } from "@/lib/students/labels";
import { approvalSummary, type ApprovalSummary } from "./summary";
import type { ScheduleRecord, ScheduleStudent, StoredGroup } from "./types";
import { unallocatedStudents } from "./unallocated";
import { validateDraft } from "./validate";

export type MemberView = { id: string; full_name: string; warning: string | null; error: string | null };
export type GroupView = StoredGroup & {
  detail: string; // "Cambridge · B2"
  members: MemberView[];
  errors: string[]; // group-level hard issues
  warnings: string[]; // group-level soft issues
};
export type UnallocatedView = { id: string; full_name: string; detail: string; reason: string; goal: StoredGroup["goal"]; cefr_level: StoredGroup["cefr_level"]; school_year: number | null };

export type ScheduleView = {
  groups: GroupView[];
  unallocated: UnallocatedView[];
  missingAvailability: { id: string; full_name: string }[];
  summary: ApprovalSummary;
};

/** Everything the Schedule page renders, derived from the stored draft and the current students. */
export function buildScheduleView(schedule: ScheduleRecord | null, students: ScheduleStudent[]): ScheduleView {
  const groups = schedule?.groups ?? [];
  const byId = new Map(students.map((s) => [s.id, s]));
  const check = validateDraft(groups, students);

  const views: GroupView[] = groups.map((g, i) => {
    const mine = <T extends { group: number }>(list: T[]) => list.filter((x) => x.group === i);
    const hard = mine(check.hard);
    const soft = mine(check.soft);
    return {
      ...g,
      detail: goalDetail(g),
      members: g.member_ids
        .map((id) => ({
          id,
          full_name: byId.get(id)?.full_name ?? "Unknown student",
          error: hard.find((x) => x.student_id === id)?.message ?? null,
          warning: soft.find((x) => x.student_id === id)?.message ?? null,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "en")),
      errors: hard.filter((x) => !x.student_id).map((x) => x.message),
      warnings: soft.filter((x) => !x.student_id).map((x) => x.message),
    };
  });

  return {
    groups: views,
    unallocated: unallocatedStudents(groups, students, schedule?.generated_at ?? null).map(({ student: s, reason }) => ({
      id: s.id, full_name: s.full_name, detail: goalDetail(s), reason, goal: s.goal, cefr_level: s.cefr_level, school_year: s.school_year,
    })),
    missingAvailability: findStudentsWithoutAvailability(students).map((s) => ({ id: s.id, full_name: s.full_name })),
    summary: approvalSummary(groups, students, check),
  };
}

/** Groups a student of this goal/level/year may join (H4). Individual classes take no one else (H3). */
export const compatibleGroups = (
  groups: GroupView[],
  s: Pick<UnallocatedView, "goal" | "cefr_level" | "school_year">,
  exceptId?: string,
) =>
  groups.filter((g) =>
    g.id !== exceptId && g.goal !== "individual" && g.goal === s.goal &&
    g.cefr_level === s.cefr_level && g.school_year === s.school_year);
