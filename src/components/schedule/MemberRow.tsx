"use client";

import { useId, useState } from "react";
import type { GroupView, MemberView } from "@/lib/schedule/view";
import { InlineAlert } from "./InlineAlert";
import { useScheduleAction } from "./useScheduleAction";

type Props = { member: MemberView; targets: GroupView[]; editable: boolean };

/** One student in a class: issues, "Move to…" a compatible class, and "Remove" (→ unallocated). */
export function MemberRow({ member, targets, editable }: Props) {
  const { run, pending, error } = useScheduleAction();
  const [target, setTarget] = useState("");
  const id = useId();

  return (
    <li className="py-2" data-testid="member">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium">{member.full_name}</span>
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            {targets.length > 0 && (
              <>
                <label htmlFor={id} className="sr-only">Move {member.full_name} to</label>
                <select id={id} className="input w-auto py-1 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Move to…</option>
                  {targets.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1"
                  disabled={!target || pending}
                  onClick={() => run("/api/schedule/edits", { type: "assign", student_id: member.id, group_id: target })}
                >
                  Move
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-secondary px-3 py-1 text-danger"
              disabled={pending}
              aria-label={`Remove ${member.full_name} from this class`}
              onClick={() => run("/api/schedule/edits", { type: "remove", student_id: member.id })}
            >
              Remove
            </button>
          </div>
        )}
      </div>
      {member.error && <p className="mt-1 text-xs font-medium text-danger">Error: {member.error}</p>}
      {member.warning && <p className="mt-1 text-xs text-warning">Warning: {member.warning}</p>}
      {error && <div className="mt-2"><InlineAlert>{error}</InlineAlert></div>}
    </li>
  );
}
