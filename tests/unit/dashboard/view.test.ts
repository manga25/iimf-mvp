import { describe, expect, it } from "vitest";
import {
  attendanceHref, buildAlerts, dashboardRange, paymentCounters, paymentsHref, splitSessions, type DashboardSession,
} from "@/lib/dashboard/view";
import type { StoredGroup, ScheduleStudent } from "@/lib/schedule/types";

// AC-8.1 — the Dashboard's derived data (the page itself is covered by tests/e2e/dashboard.spec.ts).

const TODAY = "2026-11-22"; // Sunday

const session = (id: string, date: string, start_time = "18:00", over: Partial<DashboardSession> = {}): DashboardSession => ({
  id, name: `Class ${id}`, goal: "cambridge", date, start_time, end_time: "19:30", status: "scheduled", modality: "in_person", ...over,
});

describe("dashboard sessions", () => {
  it("loads today … today + 7", () => {
    expect(dashboardRange(TODAY)).toEqual({ from: "2026-11-22", to: "2026-11-29" });
  });

  it("splits today from the next 7 days, sorted, keeping cancelled and online sessions", () => {
    const sessions = [
      session("late", TODAY, "18:00"),
      session("early", TODAY, "09:00", { modality: "online" }),
      session("yesterday", "2026-11-21"),
      session("day7", "2026-11-29", "10:00"),
      session("day8", "2026-11-30"),
      session("tue-b", "2026-11-24", "17:00"),
      session("tue-a", "2026-11-24", "08:30", { status: "cancelled" }),
      session("mon", "2026-11-23"),
    ];
    const { today, upcoming } = splitSessions(sessions, TODAY);
    expect(today.map((s) => s.id)).toEqual(["early", "late"]);
    expect(upcoming.map((d) => d.date)).toEqual(["2026-11-23", "2026-11-24", "2026-11-29"]);
    expect(upcoming[1].sessions.map((s) => [s.id, s.status])).toEqual([["tue-a", "cancelled"], ["tue-b", "scheduled"]]);
  });

  it("returns empty lists when there are no sessions", () => {
    expect(splitSessions([], TODAY)).toEqual({ today: [], upcoming: [] });
  });

  it("links a session to its panel on the Attendance page", () => {
    expect(attendanceHref({ id: "abc", date: TODAY })).toBe("/attendance?date=2026-11-22&session=abc");
  });
});

describe("dashboard payment counters", () => {
  const sept = { status: "unpaid" as const, month: "2026-09-01" };
  const oct = { status: "unpaid" as const, month: "2026-10-01" };
  const paid = { status: "paid" as const, month: "2026-09-01" };

  it("counts October as unpaid on 21 Nov and as overdue on 22 Nov (AC-6.5 rule)", () => {
    expect(paymentCounters([sept, oct, oct, paid], "2026-11-21")).toEqual({
      unpaid: { count: 2, month: "2026-10-01" },
      overdue: { count: 1, month: "2026-09-01" },
    });
    expect(paymentCounters([sept, oct, oct, paid], "2026-11-22")).toEqual({
      unpaid: { count: 0, month: null },
      overdue: { count: 3, month: "2026-10-01" },
    });
  });

  it("never counts paid charges", () => {
    expect(paymentCounters([paid], TODAY)).toEqual({ unpaid: { count: 0, month: null }, overdue: { count: 0, month: null } });
  });

  it("links each counter to the Payments filter of its newest month", () => {
    expect(paymentsHref("overdue", { count: 3, month: "2026-10-01" })).toBe("/payments?month=2026-10&status=overdue");
    expect(paymentsHref("unpaid", { count: 0, month: null })).toBe("/payments");
  });
});

describe("dashboard alerts", () => {
  const student = (id: string, over: Partial<ScheduleStudent> = {}): ScheduleStudent => ({
    id, full_name: `Student ${id}`, goal: "individual", cefr_level: null, school_year: null, is_active: true,
    availability: [{ weekday: 1, start_time: "09:00", end_time: "10:00" }], created_at: "2026-08-01T10:00:00Z", ...over,
  });
  const group = (member_ids: string[]): StoredGroup => ({
    id: "g1", name: "Individual · A", goal: "individual", cefr_level: null, school_year: null,
    weekday: 1, start_time: "09:00", duration_min: 60, member_ids,
  });
  const students = [
    student("b", { availability: [{ weekday: 2, start_time: "09:00", end_time: "10:00" }] }),
    student("a"),
    student("none", { full_name: "Zoe None", availability: [] }),
    student("gone", { is_active: false, availability: [] }),
  ];

  it("before any schedule: only missing availability (active students), no unallocated list", () => {
    const alerts = buildAlerts(null, students, 0);
    expect(alerts.schedule).toBe("none");
    expect(alerts.unallocated).toEqual([]);
    expect(alerts.missingAvailability).toEqual([{ id: "none", full_name: "Zoe None" }]);
  });

  it("with a draft: unallocated students with their reasons, plus missing availability", () => {
    const alerts = buildAlerts({ status: "draft", generated_at: "2026-09-01T10:00:00Z", groups: [group(["a"])] }, students, 4);
    expect(alerts).toMatchObject({ schedule: "draft", pendingNotifications: 4 });
    expect(alerts.unallocated.map((u) => [u.id, u.reason])).toEqual([
      ["b", "Removed manually"],
      ["none", "No availability yet"],
    ]);
    expect(alerts.missingAvailability.map((s) => s.id)).toEqual(["none"]);
  });

  it("after approval: unallocated students only (missing availability is a pre-approval alert)", () => {
    const alerts = buildAlerts({ status: "approved", generated_at: "2026-09-01T10:00:00Z", groups: [group(["a", "b"])] }, students, 0);
    expect(alerts.schedule).toBe("approved");
    expect(alerts.unallocated.map((u) => u.id)).toEqual(["none"]);
    expect(alerts.missingAvailability).toEqual([]);
  });
});
