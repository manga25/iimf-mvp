"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InlineAlert } from "./InlineAlert";
import { useScheduleAction } from "./useScheduleAction";

/** Generate the first draft, or Regenerate (with confirmation, AC-3.10). Blocked while students lack availability. */
export function GenerateButton({ hasDraft, blocked }: { hasDraft: boolean; blocked: boolean }) {
  const { run, pending, error, clearError } = useScheduleAction();
  const [open, setOpen] = useState(false);

  async function generate() {
    if (await run("/api/schedule/generate")) setOpen(false);
  }

  function onClick() {
    if (!hasDraft) return void generate();
    clearError();
    setOpen(true);
  }

  const label = hasDraft ? "Regenerate" : "Generate draft";
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        className={hasDraft ? "btn-secondary" : "btn-primary"}
        disabled={blocked || pending}
        aria-describedby={blocked ? "generate-blocked" : undefined}
        onClick={onClick}
      >
        {pending && !open ? "Generating…" : label}
      </button>
      {blocked && <p id="generate-blocked" className="text-xs text-muted">Add the missing availability first.</p>}
      {error && !open && <InlineAlert>{error}</InlineAlert>}
      <ConfirmDialog
        open={open}
        title="Regenerate the draft?"
        confirmLabel="Regenerate"
        danger
        pending={pending}
        error={error}
        onConfirm={generate}
        onClose={() => setOpen(false)}
      >
        A new draft will be generated from the current students and their availability. Any manual edits will be lost.
      </ConfirmDialog>
    </div>
  );
}
