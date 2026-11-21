import { validateAvailability } from "./availability";
import { M } from "./messages";
import { normalisePhone } from "./phone";
import { isCefrLevel, isGoal, type CefrLevel, type FieldErrors, type StudentInput } from "./types";

export type StudentValidation = { ok: true; data: StudentInput } | { ok: false; errors: FieldErrors };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const nameLengthOk = (s: string) => s.length >= 2 && s.length <= 100;

function parseYear(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

/**
 * Server-side validation of a student payload (SPEC §3.9, AC-2.2 – AC-2.5).
 * Also safe to run in the browser for instant feedback; the server always re-runs it.
 */
export function validateStudent(raw: unknown): StudentValidation {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const full_name = text(o.full_name);
  if (!full_name) errors.full_name = M.nameRequired;
  else if (!nameLengthOk(full_name)) errors.full_name = M.nameLength;

  const phone = normalisePhone(o.phone);
  if (!phone.ok) errors.phone = phone.error;

  const goal = isGoal(o.goal) ? o.goal : null;
  if (!goal) errors.goal = M.goalRequired;

  // cefr_level is required iff goal = cambridge.
  let cefr_level: CefrLevel | null = null;
  if (goal === "cambridge") {
    if (isBlank(o.cefr_level)) errors.cefr_level = M.levelRequired;
    else if (!isCefrLevel(o.cefr_level)) errors.cefr_level = M.levelInvalid;
    else cefr_level = o.cefr_level;
  } else if (goal && !isBlank(o.cefr_level)) {
    errors.cefr_level = M.levelNotAllowed;
  }

  // school_year (1–12) is required iff goal = school_support.
  let school_year: number | null = null;
  if (goal === "school_support") {
    if (isBlank(o.school_year)) errors.school_year = M.yearRequired;
    else if ((school_year = parseYear(o.school_year)) === null) errors.school_year = M.yearInvalid;
  } else if (goal && !isBlank(o.school_year)) {
    errors.school_year = M.yearNotAllowed;
  }

  // Guardian: name and phone are both filled or both empty.
  const gName = text(o.guardian_name);
  const gPhoneRaw = text(o.guardian_phone);
  let guardian_name: string | null = null;
  let guardian_phone: string | null = null;
  if (gName && !gPhoneRaw) errors.guardian_phone = M.guardianPhoneMissing;
  else if (!gName && gPhoneRaw) errors.guardian_name = M.guardianNameMissing;
  else if (gName) {
    if (nameLengthOk(gName)) guardian_name = gName;
    else errors.guardian_name = M.guardianNameLength;
    const gPhone = normalisePhone(gPhoneRaw);
    if (gPhone.ok) guardian_phone = gPhone.value;
    else errors.guardian_phone = gPhone.error;
  }

  const availability = validateAvailability(o.availability ?? []);
  if (!availability.ok) errors.availability = availability.error;

  if (Object.keys(errors).length > 0 || !goal || !phone.ok || !availability.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    data: { full_name, phone: phone.value, goal, cefr_level, school_year, guardian_name, guardian_phone, availability: availability.data },
  };
}
