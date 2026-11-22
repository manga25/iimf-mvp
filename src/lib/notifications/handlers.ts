import "server-only";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/students/types";
import { NM } from "./messages";
import { applyNotificationAction, type NotificationWriteFailure } from "./repository";
import { validateNotificationAction } from "./validation";

// PATCH /api/notifications/[id] { action: "save" | "send", message } | { action: "dismiss" }.
// Responses: 200 { notification } · 400 { error, fields? } invalid input ·
// 404 unknown notification · 409 already sent/dismissed · 500 unexpected.

const fail = (status: number, error: string, extra: object = {}) => NextResponse.json({ error, ...extra }, { status });

const FAILURES: Record<NotificationWriteFailure, [number, string]> = {
  not_found: [404, NM.notFound],
  not_pending: [409, NM.notPending],
  invalid: [400, NM.invalidInput],
  error: [500, NM.serverError],
};

export async function handleNotificationAction(id: string, request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, NM.unreadable);
    }
    const input = validateNotificationAction(body);
    if (!input.ok) return fail(400, Object.values(input.errors)[0] ?? NM.invalidInput, { fields: input.errors });
    if (!isUuid(id)) return fail(404, NM.notFound);

    const saved = await applyNotificationAction(id, input.value);
    if (!saved.ok) {
      const [status, message] = FAILURES[saved.reason];
      return fail(status, message);
    }
    return NextResponse.json({ notification: saved.notification });
  } catch (e) {
    console.error("notifications API error:", e);
    return fail(500, NM.serverError);
  }
}
