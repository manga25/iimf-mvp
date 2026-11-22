import Link from "next/link";
import { addDays, formatLongDate, formatShortDate, formatWeekRange, weekDates } from "@/lib/calendar/dates";

const href = (date: string) => `/attendance?date=${date}`;
const navLink = "btn-secondary px-3";

/** Week navigation (desktop) and day navigation + day strip (mobile). Both keep the same ?date=. */
export function CalendarNav({ date, today }: { date: string; today: string }) {
  return (
    <>
      <nav aria-label="Week navigation" className="hidden items-center justify-between gap-3 lg:flex">
        <h2 className="text-base font-semibold" data-testid="week-range">Week of {formatWeekRange(date)}</h2>
        <div className="flex gap-2">
          <Link className={navLink} href={href(addDays(date, -7))}>← Previous week</Link>
          <Link className={navLink} href={href(today)} aria-current={weekDates(today).includes(date) ? "date" : undefined}>Today</Link>
          <Link className={navLink} href={href(addDays(date, 7))}>Next week →</Link>
        </div>
      </nav>

      <nav aria-label="Day navigation" className="space-y-3 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link className={navLink} href={href(addDays(date, -1))} aria-label="Previous day">←</Link>
          <h2 className="text-center text-base font-semibold" data-testid="day-title">{formatLongDate(date)}</h2>
          <Link className={navLink} href={href(addDays(date, 1))} aria-label="Next day">→</Link>
        </div>
        <ul className="grid grid-cols-7 gap-1">
          {weekDates(date).map((d) => {
            const [weekday, day] = formatShortDate(d).split(" ");
            return (
              <li key={d}>
                <Link
                  href={href(d)}
                  aria-current={d === date ? "date" : undefined}
                  aria-label={formatLongDate(d)}
                  className={`flex flex-col items-center rounded-md border py-1 text-xs ${
                    d === date ? "border-primary bg-primary text-on-primary" : "border-border bg-surface"
                  } ${d === today && d !== date ? "font-bold text-primary" : ""}`}
                >
                  <span>{weekday}</span>
                  <span className="text-sm font-semibold">{day}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {date !== today && (
          <Link className={`${navLink} w-full`} href={href(today)}>Go to today</Link>
        )}
      </nav>
    </>
  );
}
