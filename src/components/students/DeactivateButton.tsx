"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UNAUTHORIZED_MESSAGE } from "@/lib/auth/messages";
import { M } from "@/lib/students/messages";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/** Soft-deletes a student after confirmation (AC-2.6). */
export function DeactivateButton({ studentId, name }: { studentId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/deactivate`, { method: "POST" });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(res.status === 401 ? UNAUTHORIZED_MESSAGE : (body.error ?? M.serverError));
      }
    } catch {
      setError(M.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary text-danger" onClick={() => { setError(null); setOpen(true); }}>
        Deactivate
      </button>
      <ConfirmDialog
        open={open}
        title={`Deactivate ${name}?`}
        confirmLabel="Deactivate"
        danger
        pending={pending}
        error={error}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      >
        They will be hidden from the active student list and left out of schedule generation. Their details are kept.
      </ConfirmDialog>
    </>
  );
}
