import { checkSchedule, type CheckResult, type DraftGroup, type EngineStudent } from "@/lib/scheduling";

/**
 * Checks a draft against H1–H6 / S1–S3 using the active students. A member who
 * was deactivated after generation is a hard error with a clear message
 * (instead of the generic H4 "Unknown student").
 */
export function validateDraft(groups: DraftGroup[], students: EngineStudent[]): CheckResult {
  const inactive = new Map(students.filter((s) => !s.is_active).map((s) => [s.id, s]));
  const result = checkSchedule(groups, students.filter((s) => s.is_active));

  const hard = result.hard.filter((i) => !(i.code === "H4" && i.student_id && inactive.has(i.student_id)));
  groups.forEach((g, i) => {
    for (const id of g.member_ids) {
      const s = inactive.get(id);
      if (s) hard.push({ code: "H4", group: i, student_id: id, message: `${s.full_name} has been deactivated. Remove them from ${g.name}.` });
    }
  });
  return { hard, soft: result.soft };
}

/** Stable identity of an issue, independent of group indices. */
export const issueKey = (i: { code: string; message: string }) => `${i.code}|${i.message}`;
