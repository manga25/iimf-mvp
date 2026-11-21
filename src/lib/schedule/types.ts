import type { DraftGroup, EngineStudent } from "@/lib/scheduling";

/** A persisted class (`class_groups` row + its `group_members`). */
export type StoredGroup = DraftGroup & { id: string };

/** Engine fields plus `created_at`, used to explain why a student is unallocated. */
export type ScheduleStudent = EngineStudent & { created_at: string };

export type ScheduleRecord = {
  id: string;
  status: "draft" | "approved";
  generated_at: string;
  approved_at: string | null;
  term_start: string | null;
  term_end: string | null;
  groups: StoredGroup[];
};

/** Reasons beyond the engine's (SPEC §3.4 step 7), for drafts that were edited or became stale. */
export const EXTRA_REASONS = {
  removed: "Removed manually",
  added: "Added after the draft was generated",
  noAvailability: "No availability yet",
} as const;

export type UnallocatedStudent = { student: ScheduleStudent; reason: string };
