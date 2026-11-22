import { Badge } from "@/components/ui/Badge";
import { WEEKDAY_LABELS } from "@/lib/students/labels";
import { compatibleGroups, type GroupView } from "@/lib/schedule/view";
import { endTime, GOAL_BORDER, GOAL_PILL } from "./goalStyles";
import { MemberRow } from "./MemberRow";
import { RescheduleForm } from "./RescheduleForm";

/** One class with its members, inline errors (hard) / warnings (soft) and, on a draft, its edit actions. */
export function GroupCard({ group, groups, editable }: { group: GroupView; groups: GroupView[]; editable: boolean }) {
  const targets = compatibleGroups(groups, group, group.id);
  const size = group.member_ids.length;
  const hasErrors = group.errors.length > 0 || group.members.some((m) => m.error);

  return (
    <article
      id={`group-${group.id}`}
      aria-labelledby={`group-${group.id}-title`}
      data-testid="group-card"
      className={`card card-hover scroll-mt-20 border-l-4 p-4 ${hasErrors ? "border-danger/50" : ""} ${GOAL_BORDER[group.goal]}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`group-${group.id}-title`} className="font-semibold">{group.name}</h3>
          <p className="text-sm text-muted">
            {WEEKDAY_LABELS[group.weekday - 1]} · <span className="tabular-nums">{group.start_time}–{endTime(group.start_time, group.duration_min)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${GOAL_PILL[group.goal]}`}>
            {group.detail}
          </span>
          <Badge>{size} student{size === 1 ? "" : "s"}</Badge>
          {hasErrors && <Badge tone="danger">Errors</Badge>}
        </div>
      </header>

      {(group.errors.length > 0 || group.warnings.length > 0) && (
        <ul className="mt-3 space-y-1 text-sm">
          {group.errors.map((m) => <li key={m} className="font-medium text-danger">Error: {m}</li>)}
          {group.warnings.map((m) => <li key={m} className="text-warning">Warning: {m}</li>)}
        </ul>
      )}

      <ul className="mt-2 divide-y divide-border">
        {group.members.map((m) => <MemberRow key={m.id} member={m} targets={targets} editable={editable} />)}
      </ul>

      {editable && (
        <div className="mt-3 border-t border-border pt-3">
          <RescheduleForm group={group} />
        </div>
      )}
    </article>
  );
}
