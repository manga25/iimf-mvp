import Link from "next/link";
import { GOAL_BORDER, GOAL_TINT } from "@/components/schedule/goalStyles";
import { Badge } from "@/components/ui/Badge";
import { attendanceHref, type DashboardSession } from "@/lib/dashboard/view";

/** One session on the Dashboard; links to its panel on the Attendance page. */
export function SessionRow({ session, action }: { session: DashboardSession; action: string }) {
  const cancelled = session.status === "cancelled";
  const time = `${session.start_time}–${session.end_time}`;
  return (
    <div
      data-testid="dashboard-session"
      data-status={session.status}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border-l-4 px-3 py-2 text-sm ${GOAL_BORDER[session.goal]} ${
        cancelled ? "bg-surface-muted text-muted" : GOAL_TINT[session.goal]
      }`}
    >
      <span className={`font-semibold tabular-nums ${cancelled ? "line-through" : ""}`}>{time}</span>
      <span className={`min-w-0 flex-1 truncate ${cancelled ? "line-through" : ""}`} title={session.name}>{session.name}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        {session.modality === "online" && <Badge tone="primary">Online</Badge>}
        {cancelled && <Badge tone="danger">Cancelled</Badge>}
        <Link
          href={attendanceHref(session)}
          aria-label={`${action}: ${session.name}, ${time}`}
          className="rounded-md px-2 py-1 font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
        >
          {action}
        </Link>
      </span>
    </div>
  );
}
