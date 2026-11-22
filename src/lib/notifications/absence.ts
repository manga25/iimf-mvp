import { formatLongDate } from "@/lib/calendar/dates";
import type { CalendarSession, SessionMember } from "@/lib/calendar/types";
import type { Recipient } from "./recipient";
import type { NewSessionNotification } from "./session";
import { renderTemplate, TEMPLATES } from "./templates";

/**
 * SPEC §3.8 recipient rule for `absence`: one notification to the student and
 * another to the guardian, if one exists (AC-5.3).
 */
export function buildAbsenceNotifications(
  session: Pick<CalendarSession, "name" | "date" | "start_time">,
  student: SessionMember,
): NewSessionNotification[] {
  const recipients: { recipient: Recipient; name: string; phone: string }[] = [
    { recipient: "student", name: student.full_name, phone: student.phone },
  ];
  if (student.guardian_name && student.guardian_phone) {
    recipients.push({ recipient: "guardian", name: student.guardian_name, phone: student.guardian_phone });
  }
  return recipients.map((to) => ({
    student_id: student.id,
    recipient: to.recipient,
    phone: to.phone,
    message: renderTemplate(TEMPLATES.absence, {
      recipient_name: to.name,
      student_name: student.full_name,
      class_name: session.name,
      date: formatLongDate(session.date),
      start_time: session.start_time,
    }),
  }));
}
