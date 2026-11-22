import { addDays, weekDates } from "./dates";
import type { BlockedPeriod, CalendarSession } from "./types";

export type SessionView = CalendarSession & {
  /** Can still be cancelled / switched (scheduled and not finished). */
  changeable: boolean;
  /** Late/Absent and remarks can be set: scheduled and dated today or earlier (SPEC §3.6). */
  canMarkAttendance: boolean;
  /** Reason of the block that cancelled it, if any. */
  blockedReason: string | null;
};

export type DayView = {
  date: string;
  sessions: SessionView[];
  /** Blocked periods overlapping this day (shaded in the calendar). */
  blocks: BlockedPeriod[];
};

/** True when [start, end) overlaps the calendar day `date` (all Lisbon wall-clock strings). */
const overlapsDay = (b: BlockedPeriod, date: string) => b.start < `${addDays(date, 1)}T00:00` && b.end > `${date}T00:00`;

/**
 * Groups the week's sessions by day (sorted by start time) and attaches blocked periods.
 * `now` is Lisbon wall-clock "YYYY-MM-DDTHH:MM".
 */
export function buildWeek(date: string, sessions: CalendarSession[], blocks: BlockedPeriod[], now: string): DayView[] {
  const reasons = new Map(blocks.map((b) => [b.id, b.reason]));
  return weekDates(date).map((day) => ({
    date: day,
    blocks: blocks.filter((b) => overlapsDay(b, day)),
    sessions: sessions
      .filter((s) => s.date === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.name.localeCompare(b.name))
      .map((s) => ({
        ...s,
        changeable: s.status === "scheduled" && `${s.date}T${s.end_time}` > now,
        canMarkAttendance: s.status === "scheduled" && s.date <= now.slice(0, 10),
        blockedReason: s.blocked_period_id ? (reasons.get(s.blocked_period_id) ?? "Blocked period") : null,
      })),
  }));
}

/** "All day" when a block covers the whole day, else the hours it covers on that day. */
export function blockHoursOn(b: BlockedPeriod, date: string): string {
  const from = b.start <= `${date}T00:00` ? "00:00" : b.start.slice(11);
  const to = b.end >= `${addDays(date, 1)}T00:00` ? "24:00" : b.end.slice(11);
  return from === "00:00" && to === "24:00" ? "All day" : `${from}–${to}`;
}
