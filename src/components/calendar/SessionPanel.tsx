"use client";

import { useEffect, useId, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatLongDate } from "@/lib/calendar/dates";
import { MODALITY_LABELS } from "@/lib/calendar/types";
import type { SessionView } from "@/lib/calendar/view";
import { SessionActions } from "./SessionActions";

/**
 * Side panel (modal <dialog>) for one session: details, students and session actions.
 * Flow 7 adds the Late/Absent toggles and remarks to each student row.
 */
export function SessionPanel({ session, onClose }: { session: SessionView | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (session && !dialog.open) dialog.showModal();
    if (!session && dialog.open) dialog.close();
  }, [session]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // React propagates `close` from the nested ConfirmDialog; only react to this dialog's own close.
      onClose={(e) => e.target === e.currentTarget && onClose()}
      data-testid="session-panel"
      className="ml-auto mr-0 h-dvh max-h-dvh w-full max-w-md border-l border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      {session && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 id={titleId} className={`text-lg font-semibold ${session.status === "cancelled" ? "line-through" : ""}`}>{session.name}</h2>
              <p className="mt-0.5 text-sm text-muted">
                {formatLongDate(session.date)} · {session.start_time}–{session.end_time}
              </p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={session.modality === "online" ? "primary" : "neutral"}>{MODALITY_LABELS[session.modality]}</Badge>
                {session.status === "cancelled" && <Badge tone="danger">Cancelled</Badge>}
              </p>
            </div>
            <button type="button" className="btn-secondary px-3" onClick={onClose} aria-label="Close session panel">✕</button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {session.blockedReason && (
              <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
                Cancelled by the blocked period “{session.blockedReason}”. Delete that period to restore the class.
              </p>
            )}
            <section aria-labelledby={`${titleId}-students`}>
              <h3 id={`${titleId}-students`} className="mb-2 text-sm font-semibold">
                Students ({session.members.length})
              </h3>
              <ul className="divide-y divide-border rounded-md border border-border" data-testid="panel-students">
                {session.members.map((m) => (
                  <li key={m.id} className="px-3 py-2 text-sm">{m.full_name}</li>
                ))}
              </ul>
            </section>
            <SessionActions session={session} />
          </div>
        </div>
      )}
    </dialog>
  );
}
