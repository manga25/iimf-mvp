import Link from "next/link";
import type { DashboardAlerts as Alerts } from "@/lib/dashboard/view";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const link = "font-medium text-primary underline underline-offset-2 hover:text-primary-hover";

/** (4) Pending notifications, unallocated students and (before approval) students missing availability. */
export function DashboardAlerts({ alerts }: { alerts: Alerts }) {
  const { pendingNotifications: pending, schedule, unallocated, missingAvailability: missing } = alerts;
  return (
    <section aria-labelledby="alerts-title" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 id="alerts-title" className="mb-3 text-base font-semibold">Alerts</h2>
      <ul className="space-y-3 text-sm">
        <li data-testid="alert-notifications">
          <p className={pending > 0 ? "font-medium" : "text-muted"}>
            {pending > 0 ? `${plural(pending, "notification", "notifications")} waiting to be sent` : "No notifications waiting to be sent"}
          </p>
          {pending > 0 && <Link href="/notifications?status=pending" className={link}>Open pending notifications</Link>}
        </li>

        {schedule === "none" && (
          <li data-testid="alert-schedule">
            <p className="font-medium">No schedule yet</p>
            <Link href="/schedule" className={link}>Generate a draft on the Schedule page</Link>
          </li>
        )}

        {unallocated.length > 0 && (
          <li data-testid="alert-unallocated">
            <p className="font-medium text-warning">{plural(unallocated.length, "student is", "students are")} not in any class</p>
            <ul className="mt-1 space-y-0.5 text-muted">
              {unallocated.map((s) => <li key={s.id}>{s.full_name} — {s.reason}</li>)}
            </ul>
            <Link href="/schedule" className={link}>Review on the Schedule page</Link>
          </li>
        )}

        {missing.length > 0 && (
          <li data-testid="alert-missing-availability">
            <p className="font-medium text-danger">
              {plural(missing.length, "student has", "students have")} no availability (the schedule can&apos;t be generated)
            </p>
            <ul className="mt-1 space-y-0.5">
              {missing.map((s) => (
                <li key={s.id}><Link href={`/students/${s.id}/edit`} className={link}>{s.full_name} — add availability</Link></li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}
