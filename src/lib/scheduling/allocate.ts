import type { Cohort } from "./cohorts";
import type { Slot } from "./slots";
import { covers, isAdjacent, isWeekday, overlaps, type Interval } from "./time";
import { MAX_GROUP_SIZE, MIN_GROUP_SIZE } from "./types";

/** A class placed in the teacher's week. */
export type Placed = Interval & { cohort: Cohort; member_ids: string[] };

const isFree = (slot: Interval, placed: Interval[]) => !placed.some((p) => overlaps(p, slot));

type Scored = { slot: Slot; fit: number; weekday: boolean; adjacent: boolean };

/** SPEC §3.4 step 5 tie-breakers: (a) fit ↓, (b) weekday, (c) adjacent, (d) earliest. */
function isBetter(a: Scored, b: Scored): boolean {
  if (a.fit !== b.fit) return a.fit > b.fit;
  if (a.weekday !== b.weekday) return a.weekday;
  if (a.adjacent !== b.adjacent) return a.adjacent;
  if (a.slot.weekday !== b.slot.weekday) return a.slot.weekday < b.slot.weekday;
  return a.slot.start < b.slot.start;
}

function pickBest(slots: Slot[], placed: Placed[], fitOf: (s: Slot) => number, minFit: number): Slot | null {
  let best: Scored | null = null;
  for (const slot of slots) {
    const fit = fitOf(slot);
    if (fit < minFit) continue;
    const scored = { slot, fit, weekday: isWeekday(slot.weekday), adjacent: isAdjacent(slot, placed) };
    if (!best || isBetter(scored, best)) best = scored;
  }
  return best?.slot ?? null;
}

/** Balanced target for the next group: r remaining → g = ceil(r/7) groups of ceil(r/g). */
export const nextTargetSize = (remaining: number) => Math.ceil(remaining / Math.ceil(remaining / MAX_GROUP_SIZE));

/**
 * Greedily places the classes of one group cohort (SPEC §3.4 step 5).
 * Mutates `placed`; returns the ids of students left without a class.
 */
export function allocateGroupCohort(cohort: Cohort, slots: Slot[], placed: Placed[]): string[] {
  const unassigned = new Set(cohort.students.map((s) => s.id)); // insertion order = name order
  const order = new Map(cohort.students.map((s, i) => [s.id, i]));
  const mine: Placed[] = [];

  while (unassigned.size >= MIN_GROUP_SIZE) {
    const target = nextTargetSize(unassigned.size);
    const free = slots.filter((s) => isFree(s, placed));
    const fitOf = (s: Slot) => s.available.filter((id) => unassigned.has(id)).length;
    // Fit is capped at the target: a slot fitting 9 is no better than one fitting 5 when building a group of 5.
    const best = pickBest(free, placed, (s) => Math.min(fitOf(s), target), MIN_GROUP_SIZE);
    if (!best) break;

    const alternatives = (id: string) =>
      free.filter((s) => s !== best && fitOf(s) >= MIN_GROUP_SIZE && s.available.includes(id)).length;
    const members = best.available
      .filter((id) => unassigned.has(id))
      .sort((a, b) => alternatives(a) - alternatives(b) || order.get(a)! - order.get(b)!)
      .slice(0, target);

    const cls: Placed = { weekday: best.weekday, start: best.start, end: best.end, cohort, member_ids: members };
    placed.push(cls);
    mine.push(cls);
    members.forEach((id) => unassigned.delete(id));
  }

  topUp(cohort, mine, unassigned);
  return [...unassigned];
}

/**
 * Optimisation priority 2 (maximise allocated students): a leftover student who is available
 * for an existing class of the cohort with room (< 7) joins the smallest such class.
 */
function topUp(cohort: Cohort, classes: Placed[], unassigned: Set<string>) {
  for (const student of cohort.students) {
    if (!unassigned.has(student.id)) continue;
    const fitting = classes.filter((c) => c.member_ids.length < MAX_GROUP_SIZE && covers(student.intervals, c));
    if (fitting.length === 0) continue;
    const target = fitting.reduce((min, c) => (c.member_ids.length < min.member_ids.length ? c : min));
    target.member_ids.push(student.id);
    unassigned.delete(student.id);
  }
}

/** Places an individual student's class (SPEC §3.4 step 6). Returns false if no free slot fits. */
export function allocateIndividual(cohort: Cohort, slots: Slot[], placed: Placed[]): boolean {
  const free = slots.filter((s) => isFree(s, placed));
  const best = pickBest(free, placed, () => 1, 1);
  if (!best) return false;
  placed.push({ weekday: best.weekday, start: best.start, end: best.end, cohort, member_ids: [cohort.students[0].id] });
  return true;
}
