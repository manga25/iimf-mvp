"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  error?: string | null;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Modal confirmation built on <dialog>: focus trap, Escape to close, focus returns to the opener. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Cancel", pending, error, danger, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => pending && e.preventDefault()}
      className="m-auto w-[calc(100%-2rem)] max-w-md card p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm text-muted">{children}</div>
      {error && (
        <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={pending} autoFocus>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={danger ? "btn-primary bg-danger hover:bg-danger/90" : "btn-primary"}
        >
          {pending ? "Please wait…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
