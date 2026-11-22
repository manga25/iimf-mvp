import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatLocalDateTime, toLisbonLocal } from "@/lib/calendar/dates";
import { STATUS_LABELS, TYPE_LABELS, type Notification, type NotificationStatus } from "@/lib/notifications/types";
import { NotificationActions } from "./NotificationActions";

const TONES = { pending: "warning", sent: "success", dismissed: "neutral" } as const;
const StatusBadge = ({ status }: { status: NotificationStatus }) => <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
const when = (timestamp: string) => formatLocalDateTime(toLisbonLocal(timestamp));

function NotificationCard({ n }: { n: Notification }) {
  const to = n.recipient === "guardian" ? `${n.recipient_name} (guardian of ${n.student_name})` : `${n.recipient_name} (student)`;
  return (
    <li className="rounded-xl border border-border bg-surface p-4" data-testid="notification-row" data-status={n.status} data-type={n.type}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{TYPE_LABELS[n.type]}</p>
          <p className="text-sm text-muted">Created {when(n.created_at)}</p>
        </div>
        <StatusBadge status={n.status} />
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-muted">To</dt><dd className="break-words">{to}</dd></div>
        <div><dt className="text-muted">Phone</dt><dd className="tabular-nums">{n.phone}</dd></div>
      </dl>

      {n.status === "pending" ? (
        <NotificationActions notification={n} />
      ) : (
        <div className="mt-3 space-y-1 text-sm">
          <p className="whitespace-pre-wrap break-words rounded-lg bg-surface-muted p-3">{n.message}</p>
          <p className="text-muted">{n.status === "sent" && n.sent_at ? `Sent ${when(n.sent_at)}` : "Dismissed — no message was sent."}</p>
        </div>
      )}
    </li>
  );
}

/** The log, newest first (SPEC §5). */
export function NotificationList({ notifications, filtered }: { notifications: Notification[]; filtered: boolean }) {
  if (notifications.length === 0) {
    return filtered ? (
      <EmptyState title="No notifications match these filters">Set Type and Status to “All” to see the whole log.</EmptyState>
    ) : (
      <EmptyState title="No notifications yet">
        Messages appear here when you mark a student absent, cancel a session, change its modality, or a payment becomes overdue.
      </EmptyState>
    );
  }

  const pending = notifications.filter((n) => n.status === "pending").length;
  return (
    <>
      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {notifications.length} {notifications.length === 1 ? "notification" : "notifications"}
        {pending > 0 && ` · ${pending} pending`}
      </p>
      <ul className="space-y-3" aria-label="Notifications">
        {notifications.map((n) => <NotificationCard key={n.id} n={n} />)}
      </ul>
    </>
  );
}
