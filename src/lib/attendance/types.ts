// Attendance (SPEC §3.6). No stored row = Present with no remarks.

export const ATTENDANCE_STATUSES = ["present", "late", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = { present: "Present", late: "Late", absent: "Absent" };

export const REMARKS_MAX = 500;

/** A stored (non-default) attendance row of one session. */
export type AttendanceRecord = { student_id: string; status: AttendanceStatus; remarks: string | null };

/** A validated attendance change; `remarks` is trimmed, empty → null. */
export type AttendanceInput = { student_id: string; status: AttendanceStatus; remarks: string | null };

/** The attendance of one student, defaulting to Present. */
export function attendanceOf(records: AttendanceRecord[], studentId: string): AttendanceRecord {
  return records.find((r) => r.student_id === studentId) ?? { student_id: studentId, status: "present", remarks: null };
}

/** Clicking the active Late/Absent button again returns to Present (SPEC §3.6). */
export const toggledStatus = (current: AttendanceStatus, clicked: Exclude<AttendanceStatus, "present">): AttendanceStatus =>
  current === clicked ? "present" : clicked;
