import { addDays } from "@/lib/calendar/dates";
import type { CalendarSession } from "@/lib/calendar/types";
import { isOverdue } from "@/lib/payments/months";
import type { PaymentStatus } from "@/lib/payments/types";
import { findStudentsWithoutAvailability } from "@/lib/scheduling";
import type { ScheduleRecord, ScheduleStudent } from "@/lib/schedule/types";
import { unallocatedStudents } from "@/lib/schedule/unallocated";

// Pure helpers behind the Dashboard (SPEC §5, AC-8.1). Dates are Lisbon "YYYY-MM-DD" strings.

/** "Next 7 days" = tomorrow … today + 7 (today has its own section). */
export const UPCOMING_DAYS = 7;

export type DashboardSession = Pick<
  CalendarSession, "id" | "name" | "goal" | "date" | "start_time" | "end_time" | "status" | "modality"
>;
export type UpcomingDay = { date: string; sessions: DashboardSession[] };

/** The inclusive date range to load: today … today + 7. */
export const dashboardRange = (today: string) => ({ from: today, to: addDays(today, UPCOMING_DAYS) });

const byTime = (a: DashboardSession, b: DashboardSession) =>
  a.start_time.localeCompare(b.start_time) || a.name.localeCompare(b.name);

/** Today's sessions, and the next 7 days grouped by date (days without sessions are left out). */
export function splitSessions(sessions: DashboardSession[], today: string): { today: DashboardSession[]; upcoming: UpcomingDay[] } {
  const { to } = dashboardRange(today);
  const days = new Map<string, DashboardSession[]>();
  for (const s of sessions) {
    if (s.date <= today || s.date > to) continue;
    days.set(s.date, [...(days.get(s.date) ?? []), s]);
  }
  return {
    today: sessions.filter((s) => s.date === today).sort(byTime),
    upcoming: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({ date, sessions: list.sort(byTime) })),
  };
}

export type PaymentCounter = {
  count: number;
  /** Newest month ("YYYY-MM-01") holding a matching charge — the Payments link opens it. */
  month: string | null;
};

/** Unpaid (not yet overdue) and overdue charges over every month, as the Payments page labels them. */
export function paymentCounters(
  payments: { status: PaymentStatus; month: string }[],
  today: string,
): { unpaid: PaymentCounter; overdue: PaymentCounter } {
  const counter = (rows: { month: string }[]): PaymentCounter => ({
    count: rows.length,
    month: rows.length ? rows.map((r) => r.month).sort().at(-1)! : null,
  });
  const unpaid = payments.filter((p) => p.status === "unpaid");
  return {
    unpaid: counter(unpaid.filter((p) => !isOverdue(p, today))),
    overdue: counter(unpaid.filter((p) => isOverdue(p, today))),
  };
}

/** "/payments?month=2026-10&status=overdue" (or plain "/payments" when nothing matches). */
export const paymentsHref = (status: "unpaid" | "overdue", c: PaymentCounter) =>
  c.month ? `/payments?month=${c.month.slice(0, 7)}&status=${status}` : "/payments";

/** Opens the session's panel on the Attendance page. */
export const attendanceHref = (s: Pick<DashboardSession, "id" | "date">) => `/attendance?date=${s.date}&session=${s.id}`;

export type ScheduleState = "none" | "draft" | "approved";

export type DashboardAlerts = {
  pendingNotifications: number;
  schedule: ScheduleState;
  /** Active students in no class of the current schedule (empty while there is none). */
  unallocated: { id: string; full_name: string; reason: string }[];
  /** Active students without availability; only reported before approval. */
  missingAvailability: { id: string; full_name: string }[];
};

/** The alert list, derived exactly as the Schedule page derives its panels. */
export function buildAlerts(
  schedule: Pick<ScheduleRecord, "status" | "generated_at" | "groups"> | null,
  students: ScheduleStudent[],
  pendingNotifications: number,
): DashboardAlerts {
  const state: ScheduleState = schedule ? schedule.status : "none";
  return {
    pendingNotifications,
    schedule: state,
    unallocated: schedule
      ? unallocatedStudents(schedule.groups, students, schedule.generated_at).map(({ student: s, reason }) => ({
        id: s.id, full_name: s.full_name, reason,
      }))
      : [],
    missingAvailability: state === "approved"
      ? []
      : findStudentsWithoutAvailability(students)
        .map((s) => ({ id: s.id, full_name: s.full_name }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "en")),
  };
}
