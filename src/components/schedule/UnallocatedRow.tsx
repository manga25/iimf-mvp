"use client";

import { useId, useState } from "react";
import type { GroupView, UnallocatedView } from "@/lib/schedule/view";
import { InlineAlert } from "./InlineAlert";
import { useScheduleAction } from "./useScheduleAction";

/** An unallocated student with the reason and, on a draft, "Assign to…" a compatible class. */
export function UnallocatedRow({ student, targets, editable }: { student: UnallocatedView; targets: GroupView[]; editable: boolean }) {
  const { run, pending, error } = useScheduleAction();
  const [target, setTarget] = useState("");
  const id = useId();

  return (
    <li className="py-3" data-testid="unallocated">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{student.full_name} <span className="font-normal text-muted">· {student.detail}</span></p>
          <p className="text-xs text-muted">{student.reason}</p>
        </div>
        {editable && targets.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor={id} className="sr-only">Assign {student.full_name} to</label>
            <select id={id} className="input w-auto py-1 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Assign to…</option>
              {targets.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button
              type="button"
              className="btn-secondary px-3 py-1"
              disabled={!target || pending}
              onClick={() => run("/api/schedule/edits", { type: "assign", student_id: student.id, group_id: target })}
            >
              {pending ? "Saving…" : "Assign"}
            </button>
          </div>
        )}
        {editable && targets.length === 0 && <p className="text-xs text-muted">No compatible class in this draft.</p>}
      </div>
      {error && <div className="mt-2"><InlineAlert>{error}</InlineAlert></div>}
    </li>
  );
}
