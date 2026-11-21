import { toMinutes } from "@/lib/students/availability";
import { covers, DAY_END, DAY_START, isWeekday, overlaps, SLOT_MIN, toIntervals, type Interval } from "./time";
import { durationFor, MAX_GROUP_SIZE, MIN_GROUP_SIZE, type DraftGroup, type EngineStudent } from "./types";

export type HardCode = "H1" | "H2" | "H3" | "H4" | "H5" | "H6";
export type SoftCode = "S1" | "S2" | "S3";

/** `group` is the index into the checked `groups` array; `student_id` when one student is concerned. */
export type Issue<C> = { code: C; group: number; student_id?: string; message: string };
export type CheckResult = { hard: Issue<HardCode>[]; soft: Issue<SoftCode>[] };

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const toInterval = (g: DraftGroup): Interval | null => {
  const start = toMinutes(g.start_time);
  return start === null ? null : { weekday: g.weekday, start, end: start + g.duration_min };
};

function sameCohort(g: DraftGroup, s: EngineStudent): boolean {
  if (s.goal !== g.goal) return false;
  if (g.goal === "cambridge") return s.cefr_level === g.cefr_level;
  if (g.goal === "school_support") return s.school_year === g.school_year;
  return true;
}

/**
 * Checks a schedule against SPEC §3.4. Hard violations block saving a manual edit and approval;
 * soft warnings are shown but allowed. Used to verify the engine (AC-3.4) and by manual edits.
 */
export function checkSchedule(groups: DraftGroup[], students: EngineStudent[]): CheckResult {
  const hard: Issue<HardCode>[] = [];
  const soft: Issue<SoftCode>[] = [];
  const byId = new Map(students.map((s) => [s.id, s]));
  const memberOf = new Map<string, number>();
  const intervals = groups.map(toInterval);

  groups.forEach((g, i) => {
    const cls = intervals[i];
    const n = g.member_ids.length;

    // H1 — inside 08:00–20:00, on the 30-min grid, valid weekday.
    if (!cls || !Number.isInteger(g.weekday) || g.weekday < 1 || g.weekday > 7 ||
        cls.start < DAY_START || cls.end > DAY_END || cls.start % SLOT_MIN !== 0) {
      hard.push({ code: "H1", group: i, message: `${g.name} must start and end between 08:00 and 20:00, on a 30-minute grid.` });
    }

    // H2 — no overlap with a later group (each pair reported once).
    for (let j = i + 1; j < groups.length; j++) {
      const other = intervals[j];
      if (cls && other && overlaps(cls, other)) {
        hard.push({ code: "H2", group: i, message: `${g.name} overlaps with ${groups[j].name}.` });
      }
    }

    // H3 — size.
    if (g.goal === "individual" ? n !== 1 : n > MAX_GROUP_SIZE) {
      const limit = g.goal === "individual" ? "exactly 1 student" : `at most ${MAX_GROUP_SIZE} students`;
      hard.push({ code: "H3", group: i, message: `${g.name} must have ${limit} (it has ${n}).` });
    }

    // H5 — duration.
    if (g.duration_min !== durationFor(g.goal)) {
      hard.push({ code: "H5", group: i, message: `${g.name} must last ${durationFor(g.goal)} minutes.` });
    }

    // S1 — small group; S3 — weekend.
    if (g.goal !== "individual" && n < MIN_GROUP_SIZE) {
      soft.push({ code: "S1", group: i, message: `${g.name} has only ${n} student${n === 1 ? "" : "s"} (minimum ${MIN_GROUP_SIZE} recommended).` });
    }
    if (!isWeekday(g.weekday)) {
      soft.push({ code: "S3", group: i, message: `${g.name} is on a weekend (${DAY_NAMES[g.weekday - 1] ?? "?"}).` });
    }

    for (const id of g.member_ids) {
      const s = byId.get(id);
      // H4 — same goal and same level/year.
      if (!s || !sameCohort(g, s)) {
        const who = s?.full_name ?? "Unknown student";
        hard.push({ code: "H4", group: i, student_id: id, message: `${who} does not match the goal and level/year of ${g.name}.` });
      }
      // H6 — at most one class per student.
      const prev = memberOf.get(id);
      if (prev !== undefined) {
        hard.push({ code: "H6", group: i, student_id: id, message: `${s?.full_name ?? "A student"} is already in ${groups[prev].name}.` });
      } else {
        memberOf.set(id, i);
      }
      // S2 — available for the whole class.
      if (s && cls && !covers(toIntervals(s.availability), cls)) {
        soft.push({ code: "S2", group: i, student_id: id, message: `${s.full_name} is not available for the whole ${g.name} class.` });
      }
    }
  });

  return { hard, soft };
}
