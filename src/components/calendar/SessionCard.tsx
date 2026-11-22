import { GOAL_BORDER, GOAL_TINT } from "@/components/schedule/goalStyles";
import { Badge } from "@/components/ui/Badge";
import type { SessionView } from "@/lib/calendar/view";

/** One session in the calendar: colour-coded by goal, "Online" badge, struck through when cancelled. */
export function SessionCard({ session, onOpen }: { session: SessionView; onOpen: (id: string) => void }) {
  const cancelled = session.status === "cancelled";
  const label = `${session.start_time}–${session.end_time} ${session.name}${cancelled ? " (cancelled)" : ""}${
    session.modality === "online" ? " (online)" : ""
  }`;
  return (
    <button
      type="button"
      data-testid="session-card"
      data-status={session.status}
      aria-label={`Open ${label}`}
      onClick={() => onOpen(session.id)}
      className={`block w-full rounded-md border-l-4 px-2 py-1.5 text-left text-xs transition-shadow hover:shadow-sm ${
        GOAL_BORDER[session.goal]
      } ${cancelled ? "bg-surface-muted text-muted" : GOAL_TINT[session.goal]}`}
    >
      <span className={`font-semibold tabular-nums ${cancelled ? "line-through" : ""}`}>
        {session.start_time}–{session.end_time}
      </span>
      <span className={`block truncate ${cancelled ? "line-through" : ""}`} title={session.name}>{session.name}</span>
      <span className="mt-1 flex flex-wrap gap-1">
        {session.modality === "online" && <Badge tone="primary">Online</Badge>}
        {cancelled && <Badge tone="danger">Cancelled</Badge>}
      </span>
    </button>
  );
}
