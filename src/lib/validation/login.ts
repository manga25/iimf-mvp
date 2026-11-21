import { INVALID_EMAIL_MESSAGE, MISSING_CREDENTIALS_MESSAGE } from "@/lib/auth/messages";

export type LoginInput = { email: string; password: string };
export type LoginValidation = { ok: true; data: LoginInput } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server-side validation of the login form (CLAUDE.md: validate all inputs on the server). */
export function validateLogin(email: unknown, password: unknown): LoginValidation {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  const p = typeof password === "string" ? password : "";
  if (!e || !p) return { ok: false, error: MISSING_CREDENTIALS_MESSAGE };
  if (e.length > 254 || !EMAIL_RE.test(e)) return { ok: false, error: INVALID_EMAIL_MESSAGE };
  if (p.length > 1024) return { ok: false, error: MISSING_CREDENTIALS_MESSAGE };
  return { ok: true, data: { email: e, password: p } };
}
