import { formatLongDate } from "@/lib/calendar/dates";
import type { CalendarSession, Modality } from "@/lib/calendar/types";
import { primaryRecipient, type Recipient } from "./recipient";
import { renderTemplate, TEMPLATES, type SessionNotificationType } from "./templates";

export type NewSessionNotification = { student_id: string; recipient: Recipient; phone: string; message: string };

const MODALITY_TEXT: Record<Modality, string> = { in_person: "in person", online: "online" };

/**
 * One notification per student of the session (AC-4.3, AC-4.4): to the guardian
 * if present, else to the student. `modality` is the NEW modality (modality_change only).
 */
export function buildSessionNotifications(
  type: SessionNotificationType,
  session: Pick<CalendarSession, "name" | "date" | "start_time" | "members">,
  modality?: Modality,
): NewSessionNotification[] {
  return session.members.map((m) => {
    const to = primaryRecipient(m);
    const vars: Record<string, string> = {
      recipient_name: to.name,
      class_name: session.name,
      date: formatLongDate(session.date),
      start_time: session.start_time,
    };
    if (type === "modality_change") vars.modality = MODALITY_TEXT[modality ?? "in_person"];
    return { student_id: m.id, recipient: to.recipient, phone: to.phone, message: renderTemplate(TEMPLATES[type], vars) };
  });
}
