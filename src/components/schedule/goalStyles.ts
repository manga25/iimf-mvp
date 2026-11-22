import type { Goal } from "@/lib/students/types";

/**
 * Colour-coding by goal (class type), shared by the Schedule week grid, class cards,
 * calendar and dashboard so each type looks identical everywhere. Text keeps AA contrast on the tint.
 */
export const GOAL_BORDER: Record<Goal, string> = {
  cambridge: "border-l-goal-cambridge",
  school_support: "border-l-goal-school",
  individual: "border-l-goal-individual",
};

export const GOAL_TINT: Record<Goal, string> = {
  cambridge: "bg-goal-cambridge-soft",
  school_support: "bg-goal-school-soft",
  individual: "bg-goal-individual-soft",
};

/** Pill for the class-type label (tint + matching text and border). */
export const GOAL_PILL: Record<Goal, string> = {
  cambridge: "bg-goal-cambridge-soft text-goal-cambridge-text border-goal-cambridge/30",
  school_support: "bg-goal-school-soft text-goal-school-text border-goal-school/30",
  individual: "bg-goal-individual-soft text-goal-individual-text border-goal-individual/35",
};

/** Hover state for clickable goal-tinted blocks. */
export const GOAL_HOVER: Record<Goal, string> = {
  cambridge: "hover:bg-goal-cambridge/15",
  school_support: "hover:bg-goal-school/15",
  individual: "hover:bg-goal-individual/15",
};

/** "18:00" + 90 → "19:30". */
export const endTime = (start: string, minutes: number) => {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
