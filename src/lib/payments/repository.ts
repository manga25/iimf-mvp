import "server-only";
import { connection } from "next/server";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { NewOverdueNotification, OverduePayment, Payment, PaymentInput } from "./types";

// Reads and writes for payments; writes go through supabase/migrations/0006_payment_rpc.sql.
export type PaymentWriteFailure = "not_found" | "same_status" | "invalid" | "error";
const CODES: Record<string, PaymentWriteFailure> = { IM404: "not_found", IM409: "same_status", "22023": "invalid" };

export type StoredPayment = Omit<Payment, "student_name" | "goal">;
export type PaymentWriteResult = { ok: true; payment: StoredPayment } | { ok: false; reason: PaymentWriteFailure };

export class PaymentRepositoryError extends Error {}

async function createClient() {
  await connection(); // always read at request time (see students/repository.ts)
  return createSupabaseClient();
}

/** The approved term, or null before approval. */
export async function getApprovedTerm(): Promise<{ term_start: string; term_end: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("schedules").select("term_start, term_end").eq("status", "approved").maybeSingle();
  if (error) throw new PaymentRepositoryError(`getApprovedTerm: ${error.message}`);
  return data?.term_start && data.term_end ? { term_start: data.term_start, term_end: data.term_end } : null;
}

type PaymentRow = Omit<Payment, "student_name" | "goal" | "hours" | "amount"> & {
  hours: number | string;
  amount: number | string;
  students: { full_name: string; goal: Payment["goal"] } | null;
};

/** Payments of one month ("YYYY-MM-01"), sorted by student name. */
export async function listPayments(month: string): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, student_id, month, hours, amount, status, paid_at, students(full_name, goal)")
    .eq("month", month);
  if (error) throw new PaymentRepositoryError(`listPayments: ${error.message}`);
  return (data as unknown as PaymentRow[])
    .map(({ students, ...p }) => ({
      ...p, hours: Number(p.hours), amount: Number(p.amount),
      student_name: students?.full_name ?? "Unknown student", goal: students?.goal ?? "individual",
    }))
    .sort((a, b) => a.student_name.localeCompare(b.student_name));
}

/** Lazy generation: creates/recalculates rows and returns the overdue payments still needing a notification. */
export async function syncPayments(): Promise<OverduePayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_payments", {});
  if (error) throw new PaymentRepositoryError(`sync_payments: ${error.code} ${error.message}`);
  return (data as { overdue: OverduePayment[] }).overdue ?? [];
}

export async function createOverdueNotifications(notifications: NewOverdueNotification[]): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_overdue_notifications", { p_notifications: notifications });
  if (error) throw new PaymentRepositoryError(`create_overdue_notifications: ${error.code} ${error.message}`);
  return data as number;
}

export async function setPaymentStatus(id: string, input: PaymentInput): Promise<PaymentWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_payment_status", {
    p_payment_id: id, p_status: input.status, p_paid_at: input.paid_at,
  });
  if (error) {
    const reason = (error.code && CODES[error.code]) || "error";
    if (reason === "error") console.error("set_payment_status failed:", error.code, error.message);
    return { ok: false, reason };
  }
  const { payment } = data as { payment: Omit<StoredPayment, "hours" | "amount"> & { hours: number | string; amount: number | string } };
  return { ok: true, payment: { ...payment, hours: Number(payment.hours), amount: Number(payment.amount) } };
}
