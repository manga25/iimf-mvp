import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/students/labels";
import type { GroupView } from "@/lib/schedule/view";
import { endTime, GOAL_BORDER, GOAL_TINT } from "./goalStyles";

/** Weekly overview: 7 columns on desktop, a list by day on mobile (empty days hidden on mobile). */
export function WeekGrid({ groups }: { groups: GroupView[] }) {
  return (
    <section aria-labelledby="week-title">
      <h2 id="week-title" className="mb-3 text-base font-semibold">Weekly overview</h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-2">
        {WEEKDAY_LABELS.map((day, i) => {
          const classes = groups.filter((g) => g.weekday === i + 1);
          return (
            <div key={day} className={`${classes.length === 0 ? "hidden lg:block" : ""} rounded-lg border border-border bg-surface p-2`}>
              <h3 className="px-1 pb-2 text-sm font-semibold">
                <span className="hidden lg:inline" aria-hidden="true">{WEEKDAY_SHORT[i]}</span>
                <span className="lg:sr-only">{day}</span>
              </h3>
              {classes.length === 0 ? (
                <p className="px-1 text-xs text-muted">No classes</p>
              ) : (
                <ul className="space-y-1.5">
                  {classes.map((g) => (
                    <li key={g.id} className={`rounded-md border-l-4 px-2 py-1.5 text-xs ${GOAL_BORDER[g.goal]} ${GOAL_TINT[g.goal]}`}>
                      <a href={`#group-${g.id}`} className="block underline-offset-2 hover:underline">
                        <span className="font-semibold tabular-nums">{g.start_time}–{endTime(g.start_time, g.duration_min)}</span>
                        <span className="block truncate" title={g.name}>{g.name}</span>
                        <span className="text-muted">{g.member_ids.length} student{g.member_ids.length === 1 ? "" : "s"}</span>
                      </a>
                      {g.errors.length + g.members.filter((m) => m.error).length > 0 && (
                        <span className="mt-0.5 block font-semibold text-danger">Has errors</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
