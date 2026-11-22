import { describe, expect, it } from "vitest";
import {
  addDays, formatLongDate, formatWeekRange, isIsoDate, isoWeekday, lisbonNow, lisbonToday, toLisbonLocal, weekDates,
} from "@/lib/calendar/dates";
import { blockHoursOn, buildWeek } from "@/lib/calendar/view";
import type { BlockedPeriod, CalendarSession } from "@/lib/calendar/types";

describe("calendar dates", () => {
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-11-24")).toBe(true);
    for (const v of ["2026-02-30", "2026-1-1", "24/11/2026", "", null, 42, "1999-01-01"]) expect(isIsoDate(v)).toBe(false);
  });

  it("finds the Monday–Sunday week and crosses month/year boundaries", () => {
    expect(isoWeekday("2026-11-22")).toBe(7); // Sunday
    expect(weekDates("2026-11-22")).toEqual([
      "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
    expect(weekDates("2027-01-01")[0]).toBe("2026-12-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("uses Lisbon time for today/now and for stored timestamps (summer & winter time)", () => {
    expect(lisbonToday(new Date("2026-11-22T23:30:00Z"))).toBe("2026-11-22"); // UTC+0 in winter
    expect(lisbonToday(new Date("2026-07-10T23:30:00Z"))).toBe("2026-07-11"); // UTC+1 in summer
    expect(lisbonNow(new Date("2026-07-10T17:05:00Z"))).toBe("2026-07-10T18:05");
    expect(toLisbonLocal("2026-12-23T00:00:00+00:00")).toBe("2026-12-23T00:00");
    expect(toLisbonLocal("2026-10-06T17:00:00+00:00")).toBe("2026-10-06T18:00");
  });

  it("formats dates in English", () => {
    expect(formatLongDate("2026-11-24")).toBe("Tuesday, 24 November 2026");
    expect(formatWeekRange("2026-11-24")).toBe("23 Nov – 29 Nov 2026");
  });
});

const session = (over: Partial<CalendarSession> = {}): CalendarSession => ({
  id: "s1", group_id: "g1", name: "Cambridge B2 · A", goal: "cambridge", date: "2026-11-24", start_time: "18:00",
  end_time: "19:30", status: "scheduled", modality: "in_person", blocked_period_id: null, members: [], ...over,
});
const xmas: BlockedPeriod = { id: "b1", start: "2026-12-23T00:00", end: "2027-01-03T00:00", reason: "Christmas" };

describe("buildWeek", () => {
  it("puts sessions on their day, sorted, and flags which can still change", () => {
    const week = buildWeek("2026-11-24", [
      session({ id: "late" }),
      session({ id: "early", start_time: "09:00", end_time: "10:30" }),
      session({ id: "other-day", date: "2026-11-26" }),
      session({ id: "cancelled", status: "cancelled", blocked_period_id: "b9" }),
    ], [], "2026-11-24T12:00");
    expect(week).toHaveLength(7);
    expect(week[1].sessions.map((s) => [s.id, s.changeable])).toEqual([
      ["early", false], ["late", true], ["cancelled", false],
    ]);
    expect(week[1].sessions[2].blockedReason).toBe("Blocked period");
    expect(week[3].sessions.map((s) => s.id)).toEqual(["other-day"]);
  });

  it("attaches blocked periods to every day they overlap", () => {
    const week = buildWeek("2026-12-30", [session({ date: "2026-12-29", status: "cancelled", blocked_period_id: "b1" })], [xmas], "2026-11-24T12:00");
    expect(week.map((d) => d.blocks.length)).toEqual([1, 1, 1, 1, 1, 1, 0]); // Mon 28 Dec … Sat 2 Jan; Sun 3 Jan free
    expect(week[1].sessions[0].blockedReason).toBe("Christmas");
  });

  it("describes the hours a block covers on a day", () => {
    expect(blockHoursOn(xmas, "2026-12-25")).toBe("All day");
    const partial: BlockedPeriod = { id: "b2", start: "2026-11-24T14:00", end: "2026-11-25T10:00", reason: "Trip" };
    expect(blockHoursOn(partial, "2026-11-24")).toBe("14:00–24:00");
    expect(blockHoursOn(partial, "2026-11-25")).toBe("00:00–10:00");
  });
});
