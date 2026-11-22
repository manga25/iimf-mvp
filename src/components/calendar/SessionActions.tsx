"use client";

import { useState } from "react";
import { InlineAlert } from "@/components/schedule/InlineAlert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MODALITY_LABELS } from "@/lib/calendar/types";
import type { SessionView } from "@/lib/calendar/view";
import { useApiAction } from "./useApiAction";

const recipients = (n: number) => `${n} notification${n === 1 ? "" : "s"}`;

/** Change modality (In-Person ↔ Online) and Cancel session (confirmation, irreversible). */
export function SessionActions({ session }: { session: SessionView }) {
  const modality = useApiAction();
  const cancel = useApiAction();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  if (!session.changeable) {
    return (
      <p className="text-sm text-muted">
        {session.status === "cancelled"
          ? "This session is cancelled. Cancellations can't be undone."
          : "This session has finished, so its modality can't be changed and it can't be cancelled."}
      </p>
    );
  }

  const next = session.modality === "online" ? "in_person" : "online";
  const count = session.members.length;

  async function switchModality() {
    setDone(null);
    if (await modality.run("POST", `/api/sessions/${session.id}/modality`, { modality: next })) {
      setDone(`Changed to ${MODALITY_LABELS[next]}. ${recipients(count)} added to Notifications.`);
    }
  }

  async function cancelSession() {
    if (await cancel.run("POST", `/api/sessions/${session.id}/cancel`)) setConfirming(false);
  }

  return (
    <section aria-label="Session actions" className="space-y-3 border-t border-border pt-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-secondary" onClick={switchModality} disabled={modality.pending}>
          {modality.pending ? "Please wait…" : `Change to ${MODALITY_LABELS[next]}`}
        </button>
        <button
          type="button"
          className="btn-secondary border-danger/40 text-danger hover:bg-danger-soft"
          onClick={() => { cancel.clear(); setConfirming(true); }}
        >
          Cancel session
        </button>
      </div>
      <p className="text-xs text-muted">Each change prepares a WhatsApp message per student in Notifications.</p>
      {modality.error && <InlineAlert>{modality.error}</InlineAlert>}
      {done && !modality.error && <p role="status" className="text-sm text-success">{done}</p>}

      <ConfirmDialog
        open={confirming}
        title="Cancel this session?"
        confirmLabel="Cancel session"
        cancelLabel="Keep session"
        danger
        pending={cancel.pending}
        error={cancel.error}
        onConfirm={cancelSession}
        onClose={() => setConfirming(false)}
      >
        <p>
          {session.name} on this date will be cancelled and {recipients(count)} will be prepared for the students
          (or their guardians). This can&apos;t be undone.
        </p>
      </ConfirmDialog>
    </section>
  );
}
