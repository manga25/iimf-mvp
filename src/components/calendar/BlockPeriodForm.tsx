"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/components/students/FormField";
import { InlineAlert } from "@/components/schedule/InlineAlert";
import { useApiAction } from "./useApiAction";

/** "Block period" button → form (start, end, reason). Overlapping sessions are cancelled without notifications. */
export function BlockPeriodForm({ defaultDate }: { defaultDate: string }) {
  const { run, pending, failure, clear } = useApiAction();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(`${defaultDate}T08:00`);
  const [end, setEnd] = useState(`${defaultDate}T20:00`);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setDone(null);
    if (await run("POST", "/api/blocked-periods", { start, end, reason })) {
      setDone(`“${reason.trim()}” was blocked. Overlapping sessions are now cancelled (no messages are sent).`);
      setReason("");
      setOpen(false);
    }
  }

  const fields = failure?.fields ?? {};

  return (
    <div className="space-y-3">
      {!open && (
        <button type="button" className="btn-primary" onClick={() => { clear(); setDone(null); setOpen(true); }}>
          Block period
        </button>
      )}
      {done && <p role="status" className="text-sm text-success">{done}</p>}
      {open && (
        <form onSubmit={submit} noValidate aria-labelledby="block-form-title" className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <h3 id="block-form-title" className="text-sm font-semibold">Block a period</h3>
          <p className="text-xs text-muted">
            Sessions that overlap it are cancelled. No messages are generated. Deleting the period restores them.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="block-start" label="Starts" error={fields.start}>
              {(a11y) => <input {...a11y} type="datetime-local" step={1800} className="input" value={start} onChange={(e) => setStart(e.target.value)} required />}
            </FormField>
            <FormField id="block-end" label="Ends" error={fields.end}>
              {(a11y) => <input {...a11y} type="datetime-local" step={1800} className="input" value={end} onChange={(e) => setEnd(e.target.value)} required />}
            </FormField>
          </div>
          <FormField id="block-reason" label="Reason" error={fields.reason} hint="For example: Christmas holidays.">
            {(a11y) => <input {...a11y} className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} required />}
          </FormField>
          {failure && !failure.fields && <InlineAlert>{failure.error}</InlineAlert>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={pending}>Close</button>
            <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save blocked period"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
