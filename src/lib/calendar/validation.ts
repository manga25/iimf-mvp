import { isIsoDate } from "./dates";
import { CM } from "./messages";
import { MODALITIES, type BlockedPeriodInput, type Modality } from "./types";

// Server-side validation for calendar writes (SPEC §3.9). Times are Lisbon wall-clock.

const LOCAL_DT = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

/** Accepts "YYYY-MM-DDTHH:MM" (an <input type="datetime-local"> value, seconds dropped). */
function parseLocalDateTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = LOCAL_DT.exec(v.trim().slice(0, 16));
  if (!m || !isIsoDate(m[1])) return null;
  return `${m[1]}T${m[2]}:${m[3]}`;
}

export type BlockedPeriodErrors = Partial<Record<keyof BlockedPeriodInput, string>>;
export type BlockedPeriodResult = { ok: true; value: BlockedPeriodInput } | { ok: false; errors: BlockedPeriodErrors };

export function validateBlockedPeriod(body: unknown): BlockedPeriodResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: BlockedPeriodErrors = {};

  const start = parseLocalDateTime(b.start);
  const end = parseLocalDateTime(b.end);
  if (!start) errors.start = CM.startInvalid;
  if (!end) errors.end = CM.endInvalid;
  if (start && end && start >= end) errors.end = CM.endBeforeStart;

  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!reason) errors.reason = CM.reasonRequired;
  else if (reason.length > 200) errors.reason = CM.reasonTooLong;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { start: start!, end: end!, reason } };
}

export function parseModality(body: unknown): Modality | null {
  const m = (body && typeof body === "object" ? (body as Record<string, unknown>).modality : undefined);
  return MODALITIES.includes(m as Modality) ? (m as Modality) : null;
}
