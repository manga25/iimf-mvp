import { isUuid } from "@/lib/students/types";
import { AM } from "./messages";
import { ATTENDANCE_STATUSES, REMARKS_MAX, type AttendanceInput, type AttendanceStatus } from "./types";

// Server-side validation for PUT /api/sessions/[id]/attendance (SPEC §3.6, §3.9).

export type AttendanceErrors = Partial<Record<keyof AttendanceInput, string>>;
export type AttendanceResult = { ok: true; value: AttendanceInput } | { ok: false; errors: AttendanceErrors };

export function validateAttendance(body: unknown): AttendanceResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: AttendanceErrors = {};

  if (!isUuid(b.student_id)) errors.student_id = AM.studentInvalid;

  const status = b.status as AttendanceStatus;
  if (!ATTENDANCE_STATUSES.includes(status)) errors.status = AM.statusInvalid;

  let remarks: string | null = null;
  if (typeof b.remarks === "string") {
    remarks = b.remarks.trim() || null;
    if (remarks && remarks.length > REMARKS_MAX) errors.remarks = AM.remarksTooLong;
  } else if (b.remarks !== undefined && b.remarks !== null) {
    errors.remarks = AM.remarksInvalid;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { student_id: b.student_id as string, status, remarks } };
}
