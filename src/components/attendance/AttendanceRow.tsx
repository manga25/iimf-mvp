"use client";

import { useState } from "react";
import { useApiAction } from "@/components/calendar/useApiAction";
import { InlineAlert } from "@/components/schedule/InlineAlert";
import { Badge } from "@/components/ui/Badge";
import { ATTENDANCE_LABELS, toggledStatus, type AttendanceRecord, type AttendanceStatus } from "@/lib/attendance/types";
import type { SessionMember } from "@/lib/calendar/types";
import { RemarksField } from "./RemarksField";

const TONE = { present: "success", late: "warning", absent: "danger" } as const;
const ACTIVE = { late: "border-warning bg-warning-soft text-warning", absent: "border-danger bg-danger-soft text-danger" } as const;

type Props = { sessionId: string; member: SessionMember; record: AttendanceRecord };

/** One student of an open session: status, 1-click Late/Absent toggles and remarks (SPEC §3.6). */
export function AttendanceRow({ sessionId, member, record }: Props) {
  const status = useApiAction();
  const remarks = useApiAction();
  const [note, setNote] = useState<string | null>(null);
  const path = `/api/sessions/${sessionId}/attendance`;

  async function toggle(clicked: "late" | "absent") {
    setNote(null);
    const next: AttendanceStatus = toggledStatus(record.status, clicked);
    if (!(await status.run("PUT", path, { student_id: member.id, status: next, remarks: record.remarks }))) return;
    if (next === "absent") setNote(`${member.full_name} marked absent. Absence messages added to Notifications.`);
    else if (record.status === "absent") setNote(`${member.full_name} marked ${ATTENDANCE_LABELS[next].toLowerCase()}. Pending absence messages removed.`);
    else setNote(`${member.full_name} marked ${ATTENDANCE_LABELS[next].toLowerCase()}.`);
  }

  return (
    <li className="px-3 py-3 text-sm" data-testid="attendance-row" data-student={member.full_name} data-status={record.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{member.full_name}</span>
          <Badge tone={TONE[record.status]}>{ATTENDANCE_LABELS[record.status]}</Badge>
        </span>
        <span role="group" aria-label={`Attendance for ${member.full_name}`} className="flex gap-1.5">
          {(["late", "absent"] as const).map((s) => {
            const active = record.status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                disabled={status.pending}
                onClick={() => toggle(s)}
                className={`btn-secondary px-3 py-1 text-xs disabled:cursor-wait disabled:opacity-60 ${active ? ACTIVE[s] : ""}`}
              >
                {ATTENDANCE_LABELS[s]}
              </button>
            );
          })}
        </span>
      </div>
      {status.error && <div className="mt-2"><InlineAlert>{status.error}</InlineAlert></div>}
      {note && !status.error && <p role="status" className="mt-1 text-xs text-muted">{note}</p>}
      <RemarksField
        studentName={member.full_name}
        saved={record.remarks}
        pending={remarks.pending}
        error={remarks.error}
        onSave={(text) => remarks.run("PUT", path, { student_id: member.id, status: record.status, remarks: text })}
      />
    </li>
  );
}
