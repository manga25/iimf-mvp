import Form from "next/form";
import {
  NOTIFICATION_STATUSES, NOTIFICATION_TYPES, STATUS_LABELS, TYPE_LABELS,
  type NotificationFilters as Filters,
} from "@/lib/notifications/types";

/** Type + status filters. A plain GET form: works without JS and by keyboard (AC-7.4). */
export function NotificationFilters({ filters }: { filters: Filters }) {
  return (
    <Form action="/notifications" role="search" aria-label="Filter notifications" className="mb-4 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <label htmlFor="notification-type-filter" className="block text-sm font-medium">Type</label>
        <select id="notification-type-filter" name="type" defaultValue={filters.type} className="input">
          <option value="all">All types</option>
          {NOTIFICATION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="notification-status-filter" className="block text-sm font-medium">Status</label>
        <select id="notification-status-filter" name="status" defaultValue={filters.status} className="input">
          <option value="all">All statuses</option>
          {NOTIFICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      <button type="submit" className="btn-secondary h-[42px]">Apply</button>
    </Form>
  );
}
