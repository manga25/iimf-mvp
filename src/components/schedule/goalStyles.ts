import type { Goal } from "@/lib/students/types";

/** Colour-coding by goal (also used by the calendar later). Text keeps AA contrast on the tint. */
export const GOAL_BORDER: Record<Goal, string> = {
  cambridge: "border-l-primary",
  school_support: "border-l-success",
  individual: "border-l-warning",
};

export const GOAL_TINT: Record<Goal, string> = {
  cambridge: "bg-primary-soft",
  school_support: "bg-success-soft",
  individual: "bg-warning-soft",
};

/** "18:00" + 90 → "19:30". */
export const endTime = (start: string, minutes: number) => {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
