"use client";

import { useId, useState } from "react";
import { useApiAction } from "@/components/calendar/useApiAction";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatAmount, formatMonth } from "@/lib/payments/months";
import type { Payment } from "@/lib/payments/types";

type Props = { payment: Pick<Payment, "id" | "student_name" | "month" | "amount" | "status">; today: string };

/** "Mark as paid" (asks for the payment date) or "Mark as unpaid" (asks for confirmation). */
export function PaymentAction({ payment, today }: Props) {
  const [open, setOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(today);
  const { run, pending, failure, clear } = useApiAction();
  const dateId = useId();
  const paid = payment.status === "paid";
  const what = `${payment.student_name} · ${formatMonth(payment.month)} · ${formatAmount(payment.amount)} €`;

  async function confirm() {
    const body = paid ? { status: "unpaid" } : { status: "paid", paid_at: paidAt };
    if (await run("PUT", `/api/payments/${payment.id}`, body)) setOpen(false);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    clear();
  }

  return (
    <>
      <button
        type="button"
        className={paid ? "btn-secondary px-3 py-1.5 text-sm" : "btn-primary px-3 py-1.5 text-sm"}
        onClick={() => { setPaidAt(today); setOpen(true); }}
        aria-label={`${paid ? "Mark as unpaid" : "Mark as paid"}: ${what}`}
      >
        {paid ? "Mark as unpaid" : "Mark as paid"}
      </button>

      <ConfirmDialog
        open={open}
        title={paid ? "Mark this payment as unpaid?" : "Mark this payment as paid?"}
        confirmLabel={paid ? "Mark as unpaid" : "Mark as paid"}
        pending={pending}
        error={failure && !failure.fields?.paid_at ? failure.error : null}
        danger={paid}
        onConfirm={confirm}
        onClose={close}
      >
        <p className="font-medium text-foreground">{what}</p>
        {paid ? (
          <p className="mt-2">Use this only to correct a mistake. The payment date is cleared and the amount is recalculated from attendance.</p>
        ) : (
          <div className="mt-4 space-y-1.5">
            <label htmlFor={dateId} className="block font-medium text-foreground">Payment date</label>
            <input
              id={dateId}
              type="date"
              className="input"
              value={paidAt}
              max={today}
              required
              onChange={(e) => setPaidAt(e.target.value)}
              aria-invalid={failure?.fields?.paid_at ? true : undefined}
              aria-describedby={failure?.fields?.paid_at ? `${dateId}-error` : undefined}
            />
            {failure?.fields?.paid_at && <p id={`${dateId}-error`} className="text-danger">{failure.fields.paid_at}</p>}
            <p>The amount is frozen once marked as paid.</p>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
