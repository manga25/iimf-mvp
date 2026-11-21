export const GOALS = ["cambridge", "school_support", "individual"] as const;
export type Goal = (typeof GOALS)[number];

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const SCHOOL_YEARS = Array.from({ length: 12 }, (_, i) => i + 1);

/** One merged availability interval. weekday: 1 = Mon … 7 = Sun; times are "HH:MM". */
export type AvailabilityBlock = { weekday: number; start_time: string; end_time: string };

/** A validated, normalised student ready to be written (SPEC §3.9). */
export type StudentInput = {
  full_name: string;
  phone: string;
  goal: Goal;
  cefr_level: CefrLevel | null;
  school_year: number | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  availability: AvailabilityBlock[];
};

export type Student = StudentInput & { id: string; is_active: boolean };

export type StudentField = keyof StudentInput;
export type FieldErrors = Partial<Record<StudentField, string>>;

export const isGoal = (v: unknown): v is Goal => GOALS.includes(v as Goal);
export const isCefrLevel = (v: unknown): v is CefrLevel => CEFR_LEVELS.includes(v as CefrLevel);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
