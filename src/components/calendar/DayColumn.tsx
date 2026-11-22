import { formatLongDate, formatShortDate } from "@/lib/calendar/dates";
import { blockHoursOn, type DayView } from "@/lib/calendar/view";
import { SessionCard } from "./SessionCard";

type Props = { day: DayView; today: string; onOpen: (id: string) => void; compact?: boolean };

/** A day's sessions with any blocked period shaded on top. Used by the week (compact) and day views. */
export function DayColumn({ day, today, onOpen, compact }: Props) {
  const blocked = day.blocks.length > 0;
  return (
    <section
      aria-label={formatLongDate(day.date)}
      data-testid="calendar-day"
      data-date={day.date}
      className={`rounded-lg border p-2 shadow-card ${day.date === today ? "border-primary ring-2 ring-primary/15" : "border-border"} ${
        blocked ? "bg-[repeating-linear-gradient(135deg,var(--color-surface-muted)_0_8px,var(--color-surface)_8px_16px)]" : "bg-surface"
      }`}
    >
      {compact && (
        <h3 className="px-1 pb-2 text-sm font-semibold">
          {formatShortDate(day.date)}
          {day.date === today && <span className="ml-1 text-xs font-medium text-primary">· Today</span>}
        </h3>
      )}
      {day.blocks.map((b) => (
        <p key={b.id} data-testid="blocked-band" className="mb-2 rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <span className="font-semibold">Blocked:</span> {b.reason}
          <span className="block text-muted">{blockHoursOn(b, day.date)}</span>
        </p>
      ))}
      {day.sessions.length === 0 ? (
        <p className="px-1 text-xs text-muted">No classes</p>
      ) : (
        <ul className="space-y-1.5">
          {day.sessions.map((s) => <li key={s.id}><SessionCard session={s} onOpen={onOpen} /></li>)}
        </ul>
      )}
    </section>
  );
}
