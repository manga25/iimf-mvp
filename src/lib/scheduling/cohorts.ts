import type { CefrLevel, Goal } from "@/lib/students/types";
import { toIntervals, type Interval } from "./time";
import type { EngineStudent } from "./types";

/** A student prepared for the engine: availability parsed once. */
export type PStudent = { id: string; full_name: string; intervals: Interval[] };

/** Students that may share a class (SPEC §3.4 step 1). */
export type Cohort = {
  key: string;
  goal: Goal;
  cefr_level: CefrLevel | null;
  school_year: number | null;
  label: string; // "Cambridge B2", "Year 7", "Individual · Ana Silva"
  students: PStudent[];
};

/** Stable order so the same input always gives the same output (AC-3.8). */
export const byNameThenId = (a: { full_name: string; id: string }, b: { full_name: string; id: string }) =>
  a.full_name.localeCompare(b.full_name, "en") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function cohortOf(s: EngineStudent): Omit<Cohort, "students"> {
  if (s.goal === "cambridge") {
    return { key: `cambridge:${s.cefr_level}`, goal: s.goal, cefr_level: s.cefr_level, school_year: null, label: `Cambridge ${s.cefr_level}` };
  }
  if (s.goal === "school_support") {
    const year = String(s.school_year).padStart(2, "0");
    return { key: `school_support:${year}`, goal: s.goal, cefr_level: null, school_year: s.school_year, label: `Year ${s.school_year}` };
  }
  return { key: `individual:${s.id}`, goal: s.goal, cefr_level: null, school_year: null, label: `Individual · ${s.full_name}` };
}

/** One cohort per (cambridge, level), per (school_support, year) and per individual student. */
export function buildCohorts(students: EngineStudent[]): Cohort[] {
  const map = new Map<string, Cohort>();
  for (const s of [...students].filter((x) => x.is_active).sort(byNameThenId)) {
    const base = cohortOf(s);
    const cohort = map.get(base.key) ?? { ...base, students: [] };
    cohort.students.push({ id: s.id, full_name: s.full_name, intervals: toIntervals(s.availability) });
    map.set(base.key, cohort);
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
