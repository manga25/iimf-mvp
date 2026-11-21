import { describe, expect, it } from "vitest";
import { lisbonDate, termFor } from "@/lib/schedule";

// SPEC §1 term derivation (Europe/Lisbon).
describe("termFor", () => {
  it.each([
    ["2026-08-15T12:00:00Z", "2026-09-01", "2027-07-31"], // August → upcoming term
    ["2026-11-21T12:00:00Z", "2026-09-01", "2027-07-31"], // December side
    ["2027-01-10T12:00:00Z", "2026-09-01", "2027-07-31"], // January → current term
    ["2027-07-31T12:00:00Z", "2026-09-01", "2027-07-31"], // last day of the term
  ])("approval on %s → %s … %s", (iso, start, end) => {
    expect(termFor(new Date(iso))).toEqual({ term_start: start, term_end: end });
  });

  it("uses the Lisbon date, not UTC (31 Jul 23:30 UTC is already 1 Aug in Lisbon summer time)", () => {
    const now = new Date("2027-07-31T23:30:00Z");
    expect(lisbonDate(now)).toEqual({ year: 2027, month: 8, day: 1 });
    expect(termFor(now)).toEqual({ term_start: "2027-09-01", term_end: "2028-07-31" });
  });
});
