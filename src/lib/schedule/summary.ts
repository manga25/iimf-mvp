import type { CheckResult, DraftGroup, EngineStudent, Issue, SoftCode } from "@/lib/scheduling";

export type ApprovalSummary = {
  classes: number;
  allocated: number;
  unallocated: number;
  warnings: Issue<SoftCode>[];
  errors: number;
  canApprove: boolean;
};

/** What the Approve dialog shows (SPEC §3.4): approval needs ≥ 1 class and zero hard violations. */
export function approvalSummary(groups: DraftGroup[], students: EngineStudent[], check: CheckResult): ApprovalSummary {
  const placed = new Set(groups.flatMap((g) => g.member_ids));
  const active = students.filter((s) => s.is_active);
  return {
    classes: groups.length,
    allocated: active.filter((s) => placed.has(s.id)).length,
    unallocated: active.filter((s) => !placed.has(s.id)).length,
    warnings: check.soft,
    errors: check.hard.length,
    canApprove: groups.length > 0 && check.hard.length === 0,
  };
}
