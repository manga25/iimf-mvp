import type { CefrLevel, Goal } from "@/lib/students/types";

/**
 * One fake student as the teacher would type it in the form (raw, un-normalised).
 * slots use a compact notation: "Mon 17:00-19:00" (days Mon…Sun, 08:00–20:00, 30-min grid).
 * Phone numbers are placeholders (91x 000 1xx / 92x 000 1xx) — not real contacts.
 */
export type SeedStudent = {
  full_name: string;
  phone: string;
  goal: Goal;
  cefr_level?: CefrLevel;
  school_year?: number;
  guardian?: { name: string; phone: string };
  slots: string[];
};
