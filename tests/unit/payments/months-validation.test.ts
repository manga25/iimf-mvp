import { describe, expect, it } from "vitest";
import { buildOverdueNotifications } from "@/lib/notifications/overdue";
import { PM } from "@/lib/payments/messages";
import {
  addMonths, completedTermMonths, displayStatus, filterPayments, formatMonth, isOverdue,
  lastCompletedMonth, monthTotals, overdueFrom, parseMonthParam,
} from "@/lib/payments/months";
import type { Payment } from "@/lib/payments/types";
import { validatePaymentStatus } from "@/lib/payments/validation";

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: "p", student_id: "s", student_name: "Ana", goal: "cambridge", month: "2026-10-01",
  hours: 6, amount: 60, status: "unpaid", paid_at: null, ...over,
});

describe("months", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(lastCompletedMonth("2026-11-22")).toBe("2026-10-01");
  });

  it("lists completed term months newest first, never past July", () => {
    const term = { term_start: "2026-09-01", term_end: "2027-07-31" };
    expect(completedTermMonths(term, "2026-09-15")).toEqual([]);
    expect(completedTermMonths(term, "2026-11-22")).toEqual(["2026-10-01", "2026-09-01"]);
    expect(completedTermMonths(term, "2027-09-10")).toHaveLength(11);
    expect(completedTermMonths(term, "2027-09-10")[0]).toBe("2027-07-01");
  });

  it("parses the ?month= parameter and formats month names", () => {
    expect(parseMonthParam("2026-10")).toBe("2026-10-01");
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam(["2026-10"])).toBeNull();
    expect(formatMonth("2026-10-01")).toBe("October 2026");
  });
});

describe("overdue (AC-6.5)", () => {
  it("an unpaid October payment is not overdue on 21 Nov and is overdue on 22 Nov", () => {
    expect(overdueFrom("2026-10-01")).toBe("2026-11-22");
    expect(isOverdue(payment(), "2026-11-21")).toBe(false);
    expect(isOverdue(payment(), "2026-11-22")).toBe(true);
    expect(overdueFrom("2026-12-01")).toBe("2027-01-22");
  });

  it("a paid payment is never overdue", () => {
    expect(displayStatus(payment({ status: "paid", paid_at: "2026-11-30" }), "2027-01-01")).toBe("paid");
    expect(displayStatus(payment(), "2026-11-22")).toBe("overdue");
    expect(displayStatus(payment(), "2026-11-02")).toBe("unpaid");
  });

  it("filters by the displayed status and totals expected / received", () => {
    const rows = [payment({ id: "a", amount: 60 }), payment({ id: "b", amount: 45.5, status: "paid", paid_at: "2026-11-03" }),
      payment({ id: "c", month: "2026-11-01", amount: 0.1 })];
    expect(filterPayments(rows, "overdue", "2026-11-22").map((p) => p.id)).toEqual(["a"]);
    expect(filterPayments(rows, "unpaid", "2026-11-22").map((p) => p.id)).toEqual(["c"]);
    expect(filterPayments(rows, "paid", "2026-11-22").map((p) => p.id)).toEqual(["b"]);
    expect(filterPayments(rows, "all", "2026-11-22")).toHaveLength(3);
    expect(monthTotals(rows)).toEqual({ expected: 105.6, received: 45.5 });
  });
});

describe("validatePaymentStatus (SPEC §3.7)", () => {
  const today = "2026-11-22";
  it("accepts Paid with a date up to today and Unpaid without one", () => {
    expect(validatePaymentStatus({ status: "paid", paid_at: "2026-11-22" }, today))
      .toEqual({ ok: true, value: { status: "paid", paid_at: "2026-11-22" } });
    expect(validatePaymentStatus({ status: "unpaid", paid_at: "2026-11-01" }, today))
      .toEqual({ ok: true, value: { status: "unpaid", paid_at: null } });
  });

  it("rejects a future, missing or impossible date and unknown statuses", () => {
    expect(validatePaymentStatus({ status: "paid", paid_at: "2026-11-23" }, today)).toEqual({ ok: false, errors: { paid_at: PM.paidAtFuture } });
    expect(validatePaymentStatus({ status: "paid" }, today)).toEqual({ ok: false, errors: { paid_at: PM.paidAtInvalid } });
    expect(validatePaymentStatus({ status: "paid", paid_at: "2026-02-30" }, today).ok).toBe(false);
    expect(validatePaymentStatus({ status: "overdue" }, today)).toEqual({ ok: false, errors: { status: PM.statusInvalid } });
    expect(validatePaymentStatus(null, today).ok).toBe(false);
  });
});

describe("overdue notifications (AC-6.6, AC-7.1)", () => {
  const base = { student_id: "s", month: "2026-10-01", amount: 60, full_name: "Ana Silva", phone: "+351911111111" };
  it("goes to the guardian when there is one, else to the student, with every placeholder filled", () => {
    const [toGuardian, toStudent] = buildOverdueNotifications([
      { ...base, payment_id: "p1", guardian_name: "Rita Silva", guardian_phone: "+351922222222" },
      { ...base, payment_id: "p2", guardian_name: null, guardian_phone: null },
    ]);
    expect(toGuardian).toEqual({
      payment_id: "p1", recipient: "guardian", phone: "+351922222222",
      message: "Hello Rita Silva, this is Margarida Freitas from IIMF. This is a friendly reminder that the October 2026 payment for Ana Silva (60.00 €) is still pending. Thank you!",
    });
    expect(toStudent).toMatchObject({ payment_id: "p2", recipient: "student", phone: "+351911111111" });
    expect(toStudent.message).toMatch(/^Hello Ana Silva,/);
    expect(toStudent.message).not.toMatch(/[{}]/);
  });
});
