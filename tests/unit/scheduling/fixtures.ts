import { parseSlot } from "@/lib/seed/build";
import type { CefrLevel } from "@/lib/students/types";
import type { DraftGroup, EngineStudent, GenerateResult } from "@/lib/scheduling";

/** Slots use the seed notation: "Mon 17:00-19:00". */
type Opts = { slots: string[]; name?: string; active?: boolean };

const base = (id: string, o: Opts) => ({
  id,
  full_name: o.name ?? `Student ${id}`,
  is_active: o.active ?? true,
  availability: o.slots.map(parseSlot),
});

export const cambridge = (id: string, level: CefrLevel, o: Opts): EngineStudent => ({
  ...base(id, o), goal: "cambridge", cefr_level: level, school_year: null,
});

export const schoolSupport = (id: string, year: number, o: Opts): EngineStudent => ({
  ...base(id, o), goal: "school_support", cefr_level: null, school_year: year,
});

export const individual = (id: string, o: Opts): EngineStudent => ({
  ...base(id, o), goal: "individual", cefr_level: null, school_year: null,
});

/** n Cambridge students of one level sharing the same availability. */
export const levelCohort = (n: number, level: CefrLevel, slots: string[]) =>
  Array.from({ length: n }, (_, i) => cambridge(`${level}-${String(i + 1).padStart(2, "0")}`, level, { slots }));

export const ALL_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `${d} 08:00-20:00`);

export function draftOf(result: GenerateResult) {
  if (!result.ok) throw new Error("Expected generation to succeed");
  return result.draft;
}

export const sizes = (groups: DraftGroup[]) => groups.map((g) => g.member_ids.length).sort((a, b) => b - a);
