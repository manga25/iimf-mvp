import type { AttendanceRecord } from "@/lib/attendance/types";
import type { Goal } from "@/lib/students/types";

export const MODALITIES = ["in_person", "online"] as const;
export type Modality = (typeof MODALITIES)[number];
export type SessionStatus = "scheduled" | "cancelled";

export const MODALITY_LABELS: Record<Modality, string> = { in_person: "In-Person", online: "Online" };

/** A validated blocked period; start/end are Lisbon wall-clock "YYYY-MM-DDTHH:MM". */
export type BlockedPeriodInput = { start: string; end: string; reason: string };

/** A stored blocked period, with times already converted to Lisbon wall-clock. */
export type BlockedPeriod = { id: string; start: string; end: string; reason: string };

export type SessionMember = {
  id: string;
  full_name: string;
  phone: string;
  guardian_name: string | null;
  guardian_phone: string | null;
};

/** One dated occurrence of a class, as shown in the calendar. Times are "HH:MM". */
export type CalendarSession = {
  id: string;
  group_id: string;
  name: string;
  goal: Goal;
  date: string;
  start_time: string;
  end_time: string;
  status: SessionStatus;
  modality: Modality;
  blocked_period_id: string | null;
  members: SessionMember[];
  /** Stored (non-default) attendance rows; a member without one is Present. */
  attendance: AttendanceRecord[];
};
