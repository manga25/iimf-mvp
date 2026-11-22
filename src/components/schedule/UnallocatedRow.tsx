"use client";

import { useId, useState } from "react";
import type { GroupView, UnallocatedView } from "@/lib/schedule/view";
import { INDIVIDUAL_DURATION } from "@/lib/scheduling/types";
import { InlineAlert } from "./InlineAlert";
import { SlotForm } from "./SlotForm";
import { StudentLink } from "./StudentLink";
import { useScheduleAction } from "./useScheduleAction";

type Props = { student: UnallocatedView; targets: GroupView[]; editable: boolean };

/** "Assign to…" one of the compatible classes. */
function AssignForm({ student, targets }: Omit<Props, "editable">) {
  const { run, pending, error } = useScheduleAction();
  const [target, setTarget] = useState("");
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">Assign {student.full_name} to</label>
        <select id={id} className="input min-w-0 flex-1 py-1 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Assign to…</option>
          {targets.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button
          type="button"
          className="btn-secondary shrink-0 px-3 py-1"
          disabled={!target || pending}
          onClick={() => run("/api/schedule/edits", { type: "assign", student_id: student.id, group_id: target })}
        >
          {pending ? "Saving…" : "Assign"}
        </button>
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
    </div>
  );
}

/** The right-hand column: assign to a class, create an individual class, or explain why neither is possible. */
function Actions({ student, targets }: Omit<Props, "editable">) {
  if (targets.length > 0) return <AssignForm student={student} targets={targets} />;
  if (student.goal === "individual") {
    return (
      <SlotForm
        duration={INDIVIDUAL_DURATION}
        initial={{ weekday: 1, start_time: "08:00" }}
        submitLabel="Add class"
        ariaLabel={`Add an individual class for ${student.full_name}`}
        body={(weekday, start_time) => ({ type: "create_individual", student_id: student.id, weekday, start_time })}
      />
    );
  }
  return <p className="text-xs text-muted">No compatible class in this draft.</p>;
}

/** An unallocated student with the goal/level, the reason and, on a draft, how to give them a class. */
export function UnallocatedRow({ student, targets, editable }: Props) {
  return (
    <li className="flex min-w-0 flex-col py-3" data-testid="unallocated">
      <div className="min-w-0 break-words">
        <p><StudentLink id={student.id} name={student.full_name} /></p>
        <p className="text-sm text-muted">{student.detail}</p>
        <p className="text-xs text-muted">{student.reason}</p>
      </div>
      {editable && <div className="mt-2 min-w-0 max-w-full"><Actions student={student} targets={targets} /></div>}
    </li>
  );
}
