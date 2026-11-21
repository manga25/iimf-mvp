import type { CefrLevel, Goal, Student } from "@/lib/students/types";

/** The student fields the engine needs (a DB `Student` satisfies this). */
export type EngineStudent = Pick<
  Student,
  "id" | "full_name" | "goal" | "cefr_level" | "school_year" | "is_active" | "availability"
>;

/** One proposed weekly class (SPEC §4 `class_groups` + its `group_members`). */
export type DraftGroup = {
  name: string;
  goal: Goal;
  cefr_level: CefrLevel | null;
  school_year: number | null;
  weekday: number; // 1 = Mon … 7 = Sun
  start_time: string; // "HH:MM"
  duration_min: number; // 90 (group) or 60 (individual)
  member_ids: string[];
};

// SPEC §3.4 step 7 — the only unallocation reasons.
export const REASONS = {
  notEnough: "Not enough students at this level/year",
  noCommon: "No common availability with ≥ 2 peers",
  taken: "All matching slots are taken",
} as const;
export type UnallocationReason = (typeof REASONS)[keyof typeof REASONS];

export type Unallocated = { student_id: string; reason: UnallocationReason };

export type Draft = { groups: DraftGroup[]; unallocated: Unallocated[] };

/** Generation is blocked while any active student has no availability (SPEC §3.4). */
export type GenerateResult =
  | { ok: true; draft: Draft }
  | { ok: false; missingAvailability: EngineStudent[] };

// SPEC §3.1 / H3 / H5 / S1.
export const GROUP_DURATION = 90;
export const INDIVIDUAL_DURATION = 60;
export const MIN_GROUP_SIZE = 3;
export const MAX_GROUP_SIZE = 7;

export const durationFor = (goal: Goal) => (goal === "individual" ? INDIVIDUAL_DURATION : GROUP_DURATION);
