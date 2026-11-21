import type { Goal, Student } from "./types";

export const GOAL_LABELS: Record<Goal, string> = {
  cambridge: "Cambridge",
  school_support: "School Support",
  individual: "Individual",
};

export const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Cambridge · B2", "School Support · Year 7", "Individual". */
export function goalDetail(s: Pick<Student, "goal" | "cefr_level" | "school_year">): string {
  if (s.goal === "cambridge" && s.cefr_level) return `Cambridge · ${s.cefr_level}`;
  if (s.goal === "school_support" && s.school_year) return `School Support · Year ${s.school_year}`;
  return GOAL_LABELS[s.goal];
}

/** 90 → "1.5 h", 180 → "3 h". */
export const formatHours = (minutes: number) => `${Number((minutes / 60).toFixed(1))} h`;
