import { formatLongDate, formatShortDate } from "@/lib/calendar/dates";
import type { DashboardSession, UpcomingDay } from "@/lib/dashboard/view";
import { ACCENT, IconBadge } from "@/components/ui/IconBadge";
import { SessionRow } from "./SessionRow";

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg border border-dashed border-border-strong bg-surface-muted/60 px-4 py-6 text-center text-sm text-muted">{children}</p>
);

/** (1) Today's classes, each with a quick link to take attendance. */
export function TodayClasses({ today, sessions }: { today: string; sessions: DashboardSession[] }) {
  return (
    <section aria-labelledby="today-title" className={`card p-4 sm:p-5 ${ACCENT.primary}`}>
      <div className="mb-3 flex items-center gap-3">
        <IconBadge name="schedule" />
        <div>
          <h2 id="today-title" className="text-base font-semibold">Today&apos;s classes</h2>
          <p className="text-sm text-muted">{formatLongDate(today)}</p>
        </div>
      </div>
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
    <section aria-labelledby="upcoming-title" className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <IconBadge name="clock" />
        <h2 id="upcoming-title" className="text-base font-semibold">Next 7 days</h2>
      </div>
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
