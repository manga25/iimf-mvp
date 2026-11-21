import { M } from "./messages";
import type { AvailabilityBlock } from "./types";

// SPEC §3.3: 30-minute blocks between 08:00 and 20:00, Monday–Sunday.
export const DAY_START = 8 * 60;
export const DAY_END = 20 * 60;
export const SLOT_MIN = 30;
export const SLOTS_PER_DAY = (DAY_END - DAY_START) / SLOT_MIN; // 24
export const DAYS = 7;
const MAX_BLOCKS = DAYS * SLOTS_PER_DAY;

/** "HH:MM" or "HH:MM:SS" (seconds must be 00, as Postgres returns) → minutes, else null. */
export function toMinutes(t: unknown): number | null {
  if (typeof t !== "string") return null;
  const m = /^([01]\d|2[0-4]):([0-5]\d)(?::00)?$/.exec(t);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return total <= 24 * 60 ? total : null;
}

export function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Interval = { weekday: number; start: number; end: number };

/** Sorts and merges overlapping or adjacent intervals per weekday. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.weekday - b.weekday || a.start - b.start);
  const merged: Interval[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.weekday === cur.weekday && cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else merged.push({ ...cur });
  }
  return merged;
}

const toBlock = (i: Interval): AvailabilityBlock => ({ weekday: i.weekday, start_time: toTime(i.start), end_time: toTime(i.end) });

export type AvailabilityResult = { ok: true; data: AvailabilityBlock[] } | { ok: false; error: string };

/** SPEC §3.9 / AC-2.5: validates every block, then returns them merged and sorted. */
export function validateAvailability(raw: unknown): AvailabilityResult {
  if (!Array.isArray(raw)) return { ok: false, error: M.availabilityList };
  if (raw.length > MAX_BLOCKS) return { ok: false, error: M.availabilityTooMany };

  const intervals: Interval[] = [];
  for (const item of raw) {
    const b = (item ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(b.weekday) || (b.weekday as number) < 1 || (b.weekday as number) > DAYS) {
      return { ok: false, error: M.availabilityWeekday };
    }
    const start = toMinutes(b.start_time);
    const end = toMinutes(b.end_time);
    if (start === null || end === null) return { ok: false, error: M.availabilityFormat };
    if (start < DAY_START || end > DAY_END) return { ok: false, error: M.availabilityWindow };
    if (start % SLOT_MIN !== 0 || end % SLOT_MIN !== 0) return { ok: false, error: M.availabilityGrid };
    if (start >= end) return { ok: false, error: M.availabilityOrder };
    intervals.push({ weekday: b.weekday as number, start, end });
  }
  return { ok: true, data: mergeIntervals(intervals).map(toBlock) };
}

// ---- Grid helpers (cells[dayIndex 0–6][slotIndex 0–23]) -------------------

export const emptyCells = (): boolean[][] =>
  Array.from({ length: DAYS }, () => Array<boolean>(SLOTS_PER_DAY).fill(false));

export const slotStart = (slot: number) => DAY_START + slot * SLOT_MIN;

/** Expands blocks into grid cells. Assumes validated blocks. */
export function blocksToCells(blocks: AvailabilityBlock[]): boolean[][] {
  const cells = emptyCells();
  for (const b of blocks) {
    const start = toMinutes(b.start_time) ?? DAY_START;
    const end = toMinutes(b.end_time) ?? DAY_START;
    for (let m = Math.max(start, DAY_START); m < Math.min(end, DAY_END); m += SLOT_MIN) {
      cells[b.weekday - 1][(m - DAY_START) / SLOT_MIN] = true;
    }
  }
  return cells;
}

/** Collapses grid cells into merged blocks (runs of selected cells). */
export function cellsToBlocks(cells: boolean[][]): AvailabilityBlock[] {
  const intervals: Interval[] = [];
  cells.forEach((day, d) => {
    let runStart: number | null = null;
    for (let s = 0; s <= SLOTS_PER_DAY; s++) {
      const on = s < SLOTS_PER_DAY && day[s];
      if (on && runStart === null) runStart = s;
      if (!on && runStart !== null) {
        intervals.push({ weekday: d + 1, start: slotStart(runStart), end: slotStart(s) });
        runStart = null;
      }
    }
  });
  return intervals.map(toBlock);
}

export const totalMinutes = (blocks: AvailabilityBlock[]) =>
  blocks.reduce((sum, b) => sum + ((toMinutes(b.end_time) ?? 0) - (toMinutes(b.start_time) ?? 0)), 0);
