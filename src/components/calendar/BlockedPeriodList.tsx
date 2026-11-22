"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatLocalDateTime } from "@/lib/calendar/dates";
import type { BlockedPeriod } from "@/lib/calendar/types";
import { useApiAction } from "./useApiAction";

/** All blocked periods with a Delete action (restores the sessions each one cancelled). */
export function BlockedPeriodList({ blocks }: { blocks: BlockedPeriod[] }) {
  const { run, pending, error, clear } = useApiAction();
  const [target, setTarget] = useState<BlockedPeriod | null>(null);

  async function remove() {
    if (target && (await run("DELETE", `/api/blocked-periods/${target.id}`))) setTarget(null);
  }

  if (blocks.length === 0) {
    return <p className="text-sm text-muted">No blocked periods yet. Add holidays such as Christmas or Easter with “Block period”.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface" data-testid="blocked-list">
        {blocks.map((b) => (
          <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="blocked-item">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{b.reason}</p>
              <p className="text-xs text-muted">{formatLocalDateTime(b.start)} → {formatLocalDateTime(b.end)}</p>
            </div>
            <button
              type="button"
              className="btn-secondary self-start px-3 py-1.5 text-danger sm:self-auto"
              aria-label={`Delete blocked period ${b.reason}`}
              onClick={() => { clear(); setTarget(b); }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        title="Delete this blocked period?"
        confirmLabel="Delete"
        danger
        pending={pending}
        error={error}
        onConfirm={remove}
        onClose={() => setTarget(null)}
      >
        <p>The sessions cancelled by “{target?.reason}” will be scheduled again (unless another blocked period still covers them).</p>
      </ConfirmDialog>
    </>
  );
}
