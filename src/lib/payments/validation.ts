import { isIsoDate, lisbonToday } from "@/lib/calendar/dates";
import { PM } from "./messages";
import { PAYMENT_STATUSES, type PaymentInput, type PaymentStatus } from "./types";

// Server-side validation for PUT /api/payments/[id] (SPEC §3.7, §3.9).

export type PaymentErrors = Partial<Record<"status" | "paid_at", string>>;
export type PaymentResult = { ok: true; value: PaymentInput } | { ok: false; errors: PaymentErrors };

/** Paid needs a `paid_at` date that is not in the future; Unpaid ignores it. */
export function validatePaymentStatus(body: unknown, today: string = lisbonToday()): PaymentResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const status = b.status as PaymentStatus;
  if (!PAYMENT_STATUSES.includes(status)) return { ok: false, errors: { status: PM.statusInvalid } };
  if (status === "unpaid") return { ok: true, value: { status, paid_at: null } };

  if (!isIsoDate(b.paid_at)) return { ok: false, errors: { paid_at: PM.paidAtInvalid } };
  if (b.paid_at > today) return { ok: false, errors: { paid_at: PM.paidAtFuture } };
  return { ok: true, value: { status, paid_at: b.paid_at } };
}
