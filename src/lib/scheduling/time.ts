import { DAY_END, DAY_START, SLOT_MIN, toMinutes } from "@/lib/students/availability";
import type { AvailabilityBlock } from "@/lib/students/types";

export { DAY_END, DAY_START, SLOT_MIN };
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** A time range on one weekday, in minutes since midnight (end exclusive). */
export type Interval = { weekday: number; start: number; end: number };

export const isWeekday = (weekday: number) => weekday >= 1 && weekday <= 5;

/** Parses availability blocks into minute intervals; malformed blocks are ignored. */
export function toIntervals(blocks: AvailabilityBlock[]): Interval[] {
  const out: Interval[] = [];
  for (const b of blocks) {
    const start = toMinutes(b.start_time);
    const end = toMinutes(b.end_time);
    if (start !== null && end !== null && start < end) out.push({ weekday: b.weekday, start, end });
  }
  return out;
}

/** True when the class interval is fully inside one availability interval (S2). */
export const covers = (availability: Interval[], cls: Interval) =>
  availability.some((a) => a.weekday === cls.weekday && a.start <= cls.start && cls.end <= a.end);

/** True when two class intervals share any time (H2). Back-to-back is not an overlap. */
export const overlaps = (a: Interval, b: Interval) =>
  a.weekday === b.weekday && a.start < b.end && b.start < a.end;

/** True when the class starts or ends exactly where an already-placed class ends or starts. */
export const isAdjacent = (cls: Interval, placed: Interval[]) =>
  placed.some((p) => p.weekday === cls.weekday && (p.end === cls.start || p.start === cls.end));

/** Every start time on the 30-min grid where a class of `duration` fits in 08:00–20:00, Mon–Sun. */
export function gridSlots(duration: number): Interval[] {
  const out: Interval[] = [];
  for (const weekday of WEEKDAYS) {
    for (let start = DAY_START; start + duration <= DAY_END; start += SLOT_MIN) {
      out.push({ weekday, start, end: start + duration });
    }
  }
  return out;
}
