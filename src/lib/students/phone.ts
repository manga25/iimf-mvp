import { M } from "./messages";

export type PhoneResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * SPEC §3.9 / AC-2.4: a Portuguese 9-digit number becomes "+351XXXXXXXXX";
 * an international number needs an explicit "+" and 8–15 digits (E.164).
 * Spaces, dashes, dots and parentheses are ignored.
 */
export function normalisePhone(raw: unknown): PhoneResult {
  const compact = typeof raw === "string" ? raw.replace(/[\s\-.()]/g, "") : "";
  if (!compact) return { ok: false, error: M.phoneRequired };

  if (/^\d{9}$/.test(compact)) return { ok: true, value: `+351${compact}` };

  const intl = /^\+([1-9]\d{7,14})$/.exec(compact);
  if (intl) return { ok: true, value: `+${intl[1]}` };

  return { ok: false, error: M.phoneInvalid };
}
