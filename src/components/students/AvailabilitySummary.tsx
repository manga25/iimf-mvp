import { Badge } from "@/components/ui/Badge";
import { totalMinutes } from "@/lib/students/availability";
import { WEEKDAY_LABELS, formatHours } from "@/lib/students/labels";
import type { AvailabilityBlock } from "@/lib/students/types";

/** Read-only availability, one line per day (student detail page). */
export function AvailabilitySummary({ blocks }: { blocks: AvailabilityBlock[] }) {
  if (blocks.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="warning">No availability</Badge>
        <span className="text-muted">The schedule can’t be generated until this student has availability.</span>
      </p>
    );
  }

  const days = WEEKDAY_LABELS.map((label, i) => ({ label, blocks: blocks.filter((b) => b.weekday === i + 1) }))
    .filter((d) => d.blocks.length > 0);

  return (
    <>
      <dl className="divide-y divide-border text-sm">
        {days.map((d) => (
          <div key={d.label} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-4">
            <dt className="w-28 shrink-0 font-medium">{d.label}</dt>
            <dd className="text-muted">{d.blocks.map((b) => `${b.start_time}–${b.end_time}`).join(", ")}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted">Total: {formatHours(totalMinutes(blocks))} per week</p>
    </>
  );
}
