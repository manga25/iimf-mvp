import { formatLongDate, formatShortDate } from "@/lib/calendar/dates";
import type { DashboardSession, UpcomingDay } from "@/lib/dashboard/view";
import { SessionRow } from "./SessionRow";

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted">{children}</p>
);

/** (1) Today's classes, each with a quick link to take attendance. */
export function TodayClasses({ today, sessions }: { today: string; sessions: DashboardSession[] }) {
  return (
    <section aria-labelledby="today-title" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 id="today-title" className="text-base font-semibold">Today&apos;s classes</h2>
      <p className="mb-3 text-sm text-muted">{formatLongDate(today)}</p>
      {sessions.length === 0 ? (
        <Empty>No classes today.</Empty>
      ) : (
        <ul className="space-y-2" data-testid="today-sessions">
          {sessions.map((s) => (
            <li key={s.id}>
              <SessionRow session={s} action={s.status === "cancelled" ? "View" : "Take attendance"} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** (2) Classes of the next 7 days (tomorrow … today + 7), grouped by day. */
export function UpcomingClasses({ days }: { days: UpcomingDay[] }) {
  return (
    <section aria-labelledby="upcoming-title" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 id="upcoming-title" className="mb-3 text-base font-semibold">Next 7 days</h2>
      {days.length === 0 ? (
        <Empty>No classes in the next 7 days.</Empty>
      ) : (
        <div className="space-y-4" data-testid="upcoming-sessions">
          {days.map((d) => (
            <div key={d.date}>
              <h3 className="mb-1.5 text-sm font-semibold text-muted">{formatShortDate(d.date)}</h3>
              <ul className="space-y-2">
                {d.sessions.map((s) => <li key={s.id}><SessionRow session={s} action="Open" /></li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
