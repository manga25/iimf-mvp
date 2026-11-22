import { formatAmount, formatMonth } from "@/lib/payments/months";
import type { NewOverdueNotification, OverduePayment } from "@/lib/payments/types";
import { primaryRecipient } from "./recipient";
import { renderTemplate, TEMPLATES } from "./templates";

/** One `overdue` notification per payment: to the guardian if present, else the student (SPEC §3.8, AC-6.6). */
export function buildOverdueNotifications(payments: OverduePayment[]): NewOverdueNotification[] {
  return payments.map((p) => {
    const to = primaryRecipient(p);
    return {
      payment_id: p.payment_id,
      recipient: to.recipient,
      phone: to.phone,
      message: renderTemplate(TEMPLATES.overdue, {
        recipient_name: to.name,
        month: formatMonth(p.month),
        student_name: p.full_name,
        amount: formatAmount(Number(p.amount)),
      }),
    };
  });
}
