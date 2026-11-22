import type { Goal } from "@/lib/students/types";

// Payments (SPEC §3.7). "Overdue" is derived from the date, never stored.

export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentDisplayStatus = PaymentStatus | "overdue";
export const STATUS_LABELS: Record<PaymentDisplayStatus, string> = { unpaid: "Unpaid", overdue: "Overdue", paid: "Paid" };

export const STATUS_FILTERS = ["all", "unpaid", "overdue", "paid"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** A payment row as shown on the Payments page. `month` is the first day of the billed month. */
export type Payment = {
  id: string;
  student_id: string;
  student_name: string;
  goal: Goal;
  month: string;
  hours: number;
  amount: number;
  status: PaymentStatus;
  paid_at: string | null;
};

/** A validated status change. */
export type PaymentInput = { status: "paid"; paid_at: string } | { status: "unpaid"; paid_at: null };

/** An overdue payment that still needs its notification (returned by sync_payments). */
export type OverduePayment = {
  payment_id: string;
  student_id: string;
  month: string;
  amount: number;
  full_name: string;
  phone: string;
  guardian_name: string | null;
  guardian_phone: string | null;
};

export type NewOverdueNotification = { payment_id: string; recipient: "student" | "guardian"; phone: string; message: string };
