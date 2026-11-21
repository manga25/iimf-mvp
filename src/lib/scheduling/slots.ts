import type { Cohort } from "./cohorts";
import { covers, gridSlots, type Interval } from "./time";
import { durationFor, MIN_GROUP_SIZE } from "./types";

/** A grid slot plus the cohort students available for the whole interval (SPEC §3.4 step 3). */
export type Slot = Interval & { available: string[] };

/** Candidate slots for a cohort, keeping only those with at least one available student. */
export function candidateSlots(cohort: Cohort): Slot[] {
  const out: Slot[] = [];
  for (const cls of gridSlots(durationFor(cohort.goal))) {
    const available = cohort.students.filter((s) => covers(s.intervals, cls)).map((s) => s.id);
    if (available.length > 0) out.push({ ...cls, available });
  }
  return out;
}

/** Slots that could host a valid class: ≥ 3 students for groups, the student for individuals. */
export const feasibleSlots = (cohort: Cohort, slots: Slot[]) =>
  cohort.goal === "individual" ? slots : slots.filter((s) => s.available.length >= MIN_GROUP_SIZE);
