import { describe, expect, it } from "vitest";
import {
  blocksToCells, cellsToBlocks, emptyCells, totalMinutes, validateAvailability,
} from "@/lib/students/availability";
import { M } from "@/lib/students/messages";

const block = (weekday: number, start_time: string, end_time: string) => ({ weekday, start_time, end_time });
const errorOf = (raw: unknown) => {
  const r = validateAvailability(raw);
  return r.ok ? null : r.error;
};

describe("AC-2.5 availability validation", () => {
  it("rejects blocks outside 08:00–20:00", () => {
    expect(errorOf([block(1, "07:30", "09:00")])).toBe(M.availabilityWindow);
    expect(errorOf([block(1, "19:00", "20:30")])).toBe(M.availabilityWindow);
  });

  it("rejects blocks not aligned to 30 minutes", () => {
    expect(errorOf([block(1, "09:15", "10:00")])).toBe(M.availabilityGrid);
    expect(errorOf([block(1, "09:00", "10:45")])).toBe(M.availabilityGrid);
  });

  it("accepts the full 08:00–20:00 window", () => {
    expect(validateAvailability([block(7, "08:00", "20:00")])).toEqual({ ok: true, data: [block(7, "08:00", "20:00")] });
  });

  it("merges adjacent blocks", () => {
    expect(validateAvailability([block(2, "10:00", "11:00"), block(2, "09:00", "10:00")]))
      .toEqual({ ok: true, data: [block(2, "09:00", "11:00")] });
  });

  it("merges overlapping blocks and keeps separate days and gaps apart, sorted", () => {
    const r = validateAvailability([
      block(3, "14:00", "15:00"), block(1, "09:00", "11:00"), block(1, "10:00", "12:30"), block(1, "13:00", "14:00"),
    ]);
    expect(r).toEqual({ ok: true, data: [block(1, "09:00", "12:30"), block(1, "13:00", "14:00"), block(3, "14:00", "15:00")] });
  });

  it("accepts HH:MM:SS as returned by Postgres", () => {
    expect(validateAvailability([block(1, "09:00:00", "10:30:00")])).toEqual({ ok: true, data: [block(1, "09:00", "10:30")] });
  });

  it("rejects bad weekdays, formats, order and shapes", () => {
    expect(errorOf([block(0, "09:00", "10:00")])).toBe(M.availabilityWeekday);
    expect(errorOf([block(8, "09:00", "10:00")])).toBe(M.availabilityWeekday);
    expect(errorOf([{ weekday: "1", start_time: "09:00", end_time: "10:00" }])).toBe(M.availabilityWeekday);
    expect(errorOf([block(1, "9:00", "10:00")])).toBe(M.availabilityFormat);
    expect(errorOf([block(1, "10:00", "10:00")])).toBe(M.availabilityOrder);
    expect(errorOf([block(1, "11:00", "10:00")])).toBe(M.availabilityOrder);
    expect(errorOf([null])).toBe(M.availabilityWeekday);
    expect(errorOf("Monday")).toBe(M.availabilityList);
    expect(errorOf(Array(200).fill(block(1, "09:00", "10:00")))).toBe(M.availabilityTooMany);
  });
});

describe("grid helpers", () => {
  it("round-trips blocks ↔ cells", () => {
    const blocks = [block(1, "08:00", "09:30"), block(5, "18:30", "20:00")];
    const cells = blocksToCells(blocks);
    expect(cells[0].slice(0, 4)).toEqual([true, true, true, false]);
    expect(cells[4].slice(21)).toEqual([true, true, true]);
    expect(cellsToBlocks(cells)).toEqual(blocks);
  });

  it("turns an empty grid into no blocks and sums minutes", () => {
    expect(cellsToBlocks(emptyCells())).toEqual([]);
    expect(totalMinutes([block(1, "09:00", "10:30"), block(2, "14:00", "15:00")])).toBe(150);
  });
});
