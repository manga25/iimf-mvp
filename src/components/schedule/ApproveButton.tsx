"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ApprovalSummary } from "@/lib/schedule/summary";
import { InlineAlert } from "./InlineAlert";
import { useScheduleAction } from "./useScheduleAction";

/** AC-3.11: shows the summary and asks for confirmation; impossible while hard errors remain. */
export function ApproveButton({ summary }: { summary: ApprovalSummary }) {
  const { run, pending, error, clearError } = useScheduleAction();
  const [open, setOpen] = useState(false);

  async function approve() {
    if (await run("/api/schedule/approve")) setOpen(false);
  }

  const why = summary.errors > 0
    ? `Fix the ${summary.errors === 1 ? "error" : `${summary.errors} errors`} before approving.`
    : summary.classes === 0 ? "The draft has no classes yet." : null;

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        className="btn-primary"
        disabled={!summary.canApprove}
        aria-describedby={why ? "approve-blocked" : undefined}
        onClick={() => { clearError(); setOpen(true); }}
      >
        Approve schedule
      </button>
      {why && <p id="approve-blocked" className="text-xs text-danger">{why}</p>}
      <ConfirmDialog
        open={open}
        title="Approve the schedule?"
        confirmLabel="Approve"
        pending={pending}
        error={error}
        onConfirm={approve}
        onClose={() => setOpen(false)}
      >
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-foreground" data-testid="approve-summary">
          <dt>Classes</dt><dd className="text-right font-semibold">{summary.classes}</dd>
          <dt>Allocated students</dt><dd className="text-right font-semibold">{summary.allocated}</dd>
          <dt>Unallocated students</dt><dd className="text-right font-semibold">{summary.unallocated}</dd>
          <dt>Warnings</dt><dd className="text-right font-semibold">{summary.warnings.length}</dd>
        </dl>
        {summary.warnings.length > 0 && (
          <div className="mt-3"><InlineAlert tone="warning">{summary.warnings.length} warning{summary.warnings.length === 1 ? "" : "s"} will be kept as they are.</InlineAlert></div>
        )}
        <p className="mt-3">
          This can&apos;t be undone. Sessions are created for every week from 1 September to 31 July, and the Students
          and Schedule pages become read-only for the term.
        </p>
      </ConfirmDialog>
    </div>
  );
}
