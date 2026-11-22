import "server-only";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/students/types";
import { buildSessionNotifications } from "@/lib/notifications/session";
import { CM } from "./messages";
import {
  cancelSession, createBlockedPeriod, deleteBlockedPeriod, getSession, setSessionModality, type CalendarWriteFailure,
} from "./repository";
import { parseModality, validateBlockedPeriod } from "./validation";

// Shared logic for /api/blocked-periods and /api/sessions. Responses:
// 400 { error, fields? } invalid input · 404 unknown id · 409 cancelled/finished/same modality · 500 unexpected.

const fail = (status: number, error: string, extra: object = {}) => NextResponse.json({ error, ...extra }, { status });

const FAILURES: Record<CalendarWriteFailure, [number, string]> = {
  not_found: [404, CM.sessionNotFound],
  cancelled: [409, CM.alreadyCancelled],
  finished: [409, CM.finished],
  same_modality: [409, CM.sameModality],
  invalid: [400, CM.invalidInput],
  error: [500, CM.serverError],
};
const writeFailure = (reason: CalendarWriteFailure, notFound: string = CM.sessionNotFound) => {
  const [status, message] = FAILURES[reason];
  return fail(status, reason === "not_found" ? notFound : message);
};

async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    console.error("calendar API error:", e);
    return fail(500, CM.serverError);
  }
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

/** POST /api/blocked-periods — creates a block and cancels overlapping sessions, no notifications (AC-4.2). */
export function handleCreateBlock(request: Request): Promise<Response> {
  return guarded(async () => {
    const json = await readJson(request);
    if (!json.ok) return fail(400, CM.unreadable);
    const input = validateBlockedPeriod(json.body);
    if (!input.ok) return fail(400, CM.invalidInput, { fields: input.errors });
    const saved = await createBlockedPeriod(input.value);
    if (!saved.ok) return writeFailure(saved.reason);
    return NextResponse.json({ id: saved.id, cancelled: saved.cancelled }, { status: 201 });
  });
}

/** DELETE /api/blocked-periods/[id] — restores the sessions it cancelled (AC-4.2). */
export function handleDeleteBlock(id: string): Promise<Response> {
  return guarded(async () => {
    if (!isUuid(id)) return fail(404, CM.blockNotFound);
    const deleted = await deleteBlockedPeriod(id);
    if (!deleted.ok) return writeFailure(deleted.reason, CM.blockNotFound);
    return NextResponse.json({ restored: deleted.restored });
  });
}

/** POST /api/sessions/[id]/cancel — one `cancellation` notification per student (AC-4.3). */
export function handleCancelSession(id: string): Promise<Response> {
  return guarded(async () => {
    const session = isUuid(id) ? await getSession(id) : null;
    if (!session) return fail(404, CM.sessionNotFound);
    if (session.status === "cancelled") return fail(409, CM.alreadyCancelled);
    const notifications = buildSessionNotifications("cancellation", session);
    const saved = await cancelSession(id, notifications);
    if (!saved.ok) return writeFailure(saved.reason);
    return NextResponse.json({ notifications: notifications.length });
  });
}

/** POST /api/sessions/[id]/modality { modality } — one `modality_change` notification per student (AC-4.4). */
export function handleSetModality(id: string, request: Request): Promise<Response> {
  return guarded(async () => {
    const json = await readJson(request);
    if (!json.ok) return fail(400, CM.unreadable);
    const modality = parseModality(json.body);
    if (!modality) return fail(400, CM.modalityInvalid);

    const session = isUuid(id) ? await getSession(id) : null;
    if (!session) return fail(404, CM.sessionNotFound);
    if (session.status === "cancelled") return fail(409, CM.alreadyCancelled);
    if (session.modality === modality) return fail(409, CM.sameModality);

    const notifications = buildSessionNotifications("modality_change", session, modality);
    const saved = await setSessionModality(id, modality, notifications);
    if (!saved.ok) return writeFailure(saved.reason);
    return NextResponse.json({ modality, notifications: notifications.length });
  });
}
