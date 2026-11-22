"use client";

import { useId, useState } from "react";
import { InlineAlert } from "@/components/schedule/InlineAlert";
import { REMARKS_MAX } from "@/lib/attendance/types";

type Props = {
  studentName: string;
  saved: string | null;
  pending: boolean;
  error: string | null;
  onSave: (remarks: string) => Promise<boolean>;
};

/** Optional free-text remarks for one student (≤ 500 chars), saved with an explicit button. */
export function RemarksField({ studentName, saved, pending, error, onSave }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(saved ?? "");
  const [done, setDone] = useState(false);
  const dirty = draft.trim() !== (saved ?? "");
  const tooLong = draft.trim().length > REMARKS_MAX;

  async function save() {
    setDone(false);
    if (await onSave(draft)) setDone(true);
  }

  return (
    <div className="mt-2 space-y-1.5">
      <label htmlFor={id} className="sr-only">Remarks for {studentName}</label>
      <textarea
        id={id}
        rows={2}
        value={draft}
        maxLength={REMARKS_MAX}
        placeholder="Remarks (optional)"
        aria-describedby={`${id}-count`}
        aria-invalid={tooLong || undefined}
        onChange={(e) => { setDraft(e.target.value); setDone(false); }}
        className="w-full resize-y rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm placeholder:text-muted"
      />
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-count`} className="text-xs text-muted tabular-nums">{draft.trim().length}/{REMARKS_MAX}</span>
        <div className="flex items-center gap-2">
          {done && !dirty && !error && <span role="status" className="text-xs text-success">Remarks saved</span>}
          <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={save} disabled={!dirty || tooLong || pending}>
            {pending ? "Saving…" : "Save remarks"}
          </button>
        </div>
      </div>
      {error && <InlineAlert>{error}</InlineAlert>}
    </div>
  );
}
