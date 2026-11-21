import { toTime } from "@/lib/students/availability";
import { allocateGroupCohort, allocateIndividual, type Placed } from "./allocate";
import { buildCohorts, type Cohort } from "./cohorts";
import { findStudentsWithoutAvailability } from "./prevalidate";
import { candidateSlots, feasibleSlots, type Slot } from "./slots";
import {
  MIN_GROUP_SIZE, REASONS, type Draft, type DraftGroup, type EngineStudent, type GenerateResult, type Unallocated,
} from "./types";

type Prepared = { cohort: Cohort; slots: Slot[]; feasible: number };

/** Reason for a group-cohort student left without a class (SPEC §3.4 step 7). */
const leftoverReason = (id: string, slots: Slot[]) =>
  slots.some((s) => s.available.length >= MIN_GROUP_SIZE && s.available.includes(id)) ? REASONS.taken : REASONS.noCommon;

/** Classes of each cohort, ordered by time, get letters A, B, C… ("Cambridge B2 · A"). */
function toDraftGroups(placed: Placed[]): DraftGroup[] {
  const byCohort = new Map<string, Placed[]>();
  for (const p of placed) byCohort.set(p.cohort.key, [...(byCohort.get(p.cohort.key) ?? []), p]);

  const groups: DraftGroup[] = [];
  for (const classes of byCohort.values()) {
    classes.sort((a, b) => a.weekday - b.weekday || a.start - b.start);
    classes.forEach((p, i) => {
      const { cohort } = p;
      groups.push({
        name: cohort.goal === "individual" ? cohort.label : `${cohort.label} · ${String.fromCharCode(65 + i)}`,
        goal: cohort.goal,
        cefr_level: cohort.cefr_level,
        school_year: cohort.school_year,
        weekday: p.weekday,
        start_time: toTime(p.start),
        duration_min: p.end - p.start,
        member_ids: [...p.member_ids],
      });
    });
  }
  return groups.sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
}

/**
 * SPEC §3.4 deterministic greedy heuristic. Pure: same input → same output (AC-3.8).
 * Returns the draft, or the active students without availability when generation is blocked.
 */
export function generateDraft(students: EngineStudent[]): GenerateResult {
  const missing = findStudentsWithoutAvailability(students);
  if (missing.length > 0) return { ok: false, missingAvailability: missing };

  const unallocated: Unallocated[] = [];
  const prepared: Prepared[] = [];

  for (const cohort of buildCohorts(students)) {
    if (cohort.goal !== "individual" && cohort.students.length < MIN_GROUP_SIZE) {
      cohort.students.forEach((s) => unallocated.push({ student_id: s.id, reason: REASONS.notEnough }));
      continue;
    }
    const slots = candidateSlots(cohort);
    prepared.push({ cohort, slots, feasible: feasibleSlots(cohort, slots).length });
  }

  // Most-constrained first; buildCohorts already gives a stable key order for ties.
  prepared.sort((a, b) => a.feasible - b.feasible);

  const placed: Placed[] = [];
  for (const { cohort, slots } of prepared) {
    if (cohort.goal === "individual") {
      if (!allocateIndividual(cohort, slots, placed)) {
        unallocated.push({ student_id: cohort.students[0].id, reason: REASONS.taken });
      }
      continue;
    }
    for (const id of allocateGroupCohort(cohort, slots, placed)) {
      unallocated.push({ student_id: id, reason: leftoverReason(id, slots) });
    }
  }

  const draft: Draft = { groups: toDraftGroups(placed), unallocated: sortUnallocated(unallocated, students) };
  return { ok: true, draft };
}

function sortUnallocated(list: Unallocated[], students: EngineStudent[]): Unallocated[] {
  const name = new Map(students.map((s) => [s.id, s.full_name]));
  return [...list].sort(
    (a, b) => name.get(a.student_id)!.localeCompare(name.get(b.student_id)!, "en") || (a.student_id < b.student_id ? -1 : 1),
  );
}
