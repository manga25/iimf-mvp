import { attendanceOf } from "@/lib/attendance/types";
import type { SessionView } from "@/lib/calendar/view";
import { AttendanceRow } from "./AttendanceRow";

/**
 * The students of a session. When attendance is open everyone is Present by default
 * and gets Late/Absent toggles and remarks; otherwise a note explains why not.
 */
export function AttendanceList({ session, headingId }: { session: SessionView; headingId: string }) {
  const open = session.canMarkAttendance;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-1 text-sm font-semibold">
        {open ? "Attendance" : "Students"} ({session.members.length})
      </h3>
      <p className="mb-2 text-xs text-muted">
        {open
          ? "Everyone is Present unless you mark them Late or Absent. Click again to undo."
          : session.status === "cancelled"
            ? "Attendance isn't taken for cancelled sessions."
            : "Attendance can be marked from the day of the session."}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border" data-testid="panel-students">
        {session.members.map((m) =>
          open ? (
            <AttendanceRow key={m.id} sessionId={session.id} member={m} record={attendanceOf(session.attendance, m.id)} />
          ) : (
            <li key={m.id} className="px-3 py-2 text-sm">{m.full_name}</li>
          ),
        )}
      </ul>
    </section>
  );
}
