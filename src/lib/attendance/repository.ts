import "server-only";
import { connection } from "next/server";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { NewSessionNotification } from "@/lib/notifications/session";
import type { AttendanceInput, AttendanceStatus } from "./types";

// Error codes raised by supabase/migrations/0005_attendance_rpc.sql.
export type AttendanceWriteFailure = "not_found" | "cancelled" | "future" | "invalid" | "error";
const CODES: Record<string, AttendanceWriteFailure> = { IM404: "not_found", IM409: "cancelled", IM411: "future", "22023": "invalid" };

export type AttendanceSaved = { status: AttendanceStatus; remarks: string | null; created: number; removed: number };
export type AttendanceWriteResult = ({ ok: true } & AttendanceSaved) | { ok: false; reason: AttendanceWriteFailure };

/**
 * Sets one student's attendance; `notifications` are stored only when the student
 * becomes Absent, and pending ones are removed when they stop being Absent.
 */
export async function setAttendance(
  sessionId: string,
  input: AttendanceInput,
  notifications: NewSessionNotification[],
): Promise<AttendanceWriteResult> {
  await connection(); // always run at request time (see students/repository.ts)
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("set_attendance", {
    p_session_id: sessionId,
    p_student_id: input.student_id,
    p_status: input.status,
    p_remarks: input.remarks,
    p_notifications: notifications,
  });
  if (error) {
    const reason = (error.code && CODES[error.code]) || "error";
    if (reason === "error") console.error("set_attendance failed:", error.code, error.message);
    return { ok: false, reason };
  }
  return { ok: true, ...(data as AttendanceSaved) };
}
