import "server-only";
import { NextResponse } from "next/server";
import { lisbonToday } from "@/lib/calendar/dates";
import { CM } from "@/lib/calendar/messages";
import { getSession } from "@/lib/calendar/repository";
import { buildAbsenceNotifications } from "@/lib/notifications/absence";
import { isUuid } from "@/lib/students/types";
import { AM } from "./messages";
import { setAttendance, type AttendanceWriteFailure } from "./repository";
import { validateAttendance } from "./validation";

// PUT /api/sessions/[id]/attendance { student_id, status, remarks }. Responses:
// 200 { status, remarks, created, removed } · 400 { error, fields? } invalid input ·
// 404 unknown session · 409 cancelled or future session · 500 unexpected.

const fail = (status: number, error: string, extra: object = {}) => NextResponse.json({ error, ...extra }, { status });

const FAILURES: Record<AttendanceWriteFailure, [number, string]> = {
  not_found: [404, CM.sessionNotFound],
  cancelled: [409, AM.cancelled],
  future: [409, AM.future],
  invalid: [400, CM.invalidInput],
  error: [500, CM.serverError],
};

export async function handleSetAttendance(id: string, request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, CM.unreadable);
    }
    const input = validateAttendance(body);
    if (!input.ok) return fail(400, Object.values(input.errors)[0] ?? CM.invalidInput, { fields: input.errors });

    const session = isUuid(id) ? await getSession(id) : null;
    if (!session) return fail(404, CM.sessionNotFound);
    if (session.status === "cancelled") return fail(409, AM.cancelled);
    if (session.date > lisbonToday()) return fail(409, AM.future);
    const student = session.members.find((m) => m.id === input.value.student_id);
    if (!student) return fail(400, AM.studentInvalid, { fields: { student_id: AM.studentInvalid } });

    // The function only stores these when the student wasn't already Absent.
    const notifications = input.value.status === "absent" ? buildAbsenceNotifications(session, student) : [];
    const saved = await setAttendance(id, input.value, notifications);
    if (!saved.ok) {
      const [status, message] = FAILURES[saved.reason];
      return fail(status, message);
    }
    const { status, remarks, created, removed } = saved;
    return NextResponse.json({ status, remarks, created, removed });
  } catch (e) {
    console.error("attendance API error:", e);
    return fail(500, CM.serverError);
  }
}
