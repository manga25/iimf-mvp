import type { Payment, PaymentDisplayStatus, PaymentStatus, StatusFilter } from "./types";

// Month arithmetic on "YYYY-MM-01" strings (Lisbon calendar, SPEC A3).

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-24" → "2026-11-01". */
export const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

/** Adds `n` months to a "YYYY-MM-01" month. */
export function addMonths(month: string, n: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`;
}

/** The month before today's month: the default on the Payments page. */
export const lastCompletedMonth = (today: string) => addMonths(firstOfMonth(today), -1);

/** The charge for month M becomes overdue on the 22nd of M+1 (SPEC §3.7). */
export const overdueFrom = (month: string) => `${addMonths(month, 1).slice(0, 7)}-22`;

export const isOverdue = (p: { status: PaymentStatus; month: string }, today: string) =>
  p.status === "unpaid" && today >= overdueFrom(p.month);

export const displayStatus = (p: { status: PaymentStatus; month: string }, today: string): PaymentDisplayStatus =>
  isOverdue(p, today) ? "overdue" : p.status;

/** Completed months of the term (1 Sep → 31 Jul), newest first. */
export function completedTermMonths(term: { term_start: string; term_end: string }, today: string): string[] {
  const last = [lastCompletedMonth(today), firstOfMonth(term.term_end)].sort()[0];
  const months: string[] = [];
  for (let m = firstOfMonth(term.term_start); m <= last; m = addMonths(m, 1)) months.unshift(m);
  return months;
}

/** "2026-10" (URL parameter) → "2026-10-01"; anything else → null. */
export function parseMonthParam(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return null;
  return `${v}-01`;
}

/** "2026-10-01" → "October 2026". */
export const formatMonth = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T00:00:00Z`));

/** 60 → "60.00". */
export const formatAmount = (amount: number) => amount.toFixed(2);

/** 6 → "6.0". */
export const formatHours = (hours: number) => hours.toFixed(1);

export function filterPayments(payments: Payment[], filter: StatusFilter, today: string): Payment[] {
  if (filter === "all") return payments;
  return payments.filter((p) => displayStatus(p, today) === filter);
}

/** Month totals: expected = every row, received = paid rows (summed in cents to avoid rounding drift). */
export function monthTotals(payments: Payment[]): { expected: number; received: number } {
  const cents = (rows: Payment[]) => rows.reduce((sum, p) => sum + Math.round(p.amount * 100), 0) / 100;
  return { expected: cents(payments), received: cents(payments.filter((p) => p.status === "paid")) };
}
