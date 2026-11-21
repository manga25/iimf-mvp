import type { EngineStudent } from "./types";

/** SPEC §3.4 pre-validation / AC-3.1: active students with zero availability block generation. */
export const findStudentsWithoutAvailability = (students: EngineStudent[]): EngineStudent[] =>
  students.filter((s) => s.is_active && s.availability.length === 0);
