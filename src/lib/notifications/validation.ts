import { NM } from "./messages";
import { MESSAGE_MAX, type NotificationAction } from "./types";

// Server-side validation for PATCH /api/notifications/[id] (SPEC §3.8, §3.9).

export type NotificationErrors = Partial<Record<"action" | "message", string>>;
export type NotificationResult = { ok: true; value: NotificationAction } | { ok: false; errors: NotificationErrors };

/** The message is trimmed, must not be empty and is at most 2000 characters. */
export function validateMessage(v: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof v === "string" ? v.trim() : "";
  if (text.length === 0) return { ok: false, error: NM.messageEmpty };
  if (text.length > MESSAGE_MAX) return { ok: false, error: NM.messageTooLong };
  return { ok: true, value: text };
}

export function validateNotificationAction(body: unknown): NotificationResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (b.action === "dismiss") return { ok: true, value: { action: "dismiss" } };
  if (b.action !== "save" && b.action !== "send") return { ok: false, errors: { action: NM.actionInvalid } };
  const message = validateMessage(b.message);
  if (!message.ok) return { ok: false, errors: { message: message.error } };
  return { ok: true, value: { action: b.action, message: message.value } };
}
