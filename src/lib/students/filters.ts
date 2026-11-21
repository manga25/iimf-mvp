import { isGoal, type Goal } from "./types";

export type StatusFilter = "active" | "inactive" | "all";
export type StudentFilters = { q: string; goal: Goal | null; status: StatusFilter };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Parses the Students page query string (?q=&goal=&status=). Defaults to active students. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): StudentFilters {
  const status = first(sp.status);
  return {
    q: first(sp.q).trim().slice(0, 100),
    goal: isGoal(first(sp.goal)) ? (first(sp.goal) as Goal) : null,
    status: status === "inactive" || status === "all" ? status : "active",
  };
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
