import "server-only";
import { NextResponse } from "next/server";
import { M } from "./messages";
import { deactivateStudent, isScheduleApproved, saveStudent, type WriteResult } from "./repository";
import { isUuid } from "./types";
import { validateStudent } from "./validation";

// Shared logic for the /api/students route handlers. Responses:
// 400 { error, errors } invalid input · 404 unknown student · 409 schedule approved · 500 unexpected.

const fail = (status: number, error: string, extra: object = {}) => NextResponse.json({ error, ...extra }, { status });

function writeResponse(result: WriteResult, successStatus: number) {
  if (result.ok) return NextResponse.json({ id: result.id }, { status: successStatus });
  if (result.reason === "locked") return fail(409, M.locked);
  if (result.reason === "not_found") return fail(404, M.notFound);
  return fail(500, M.serverError);
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    // Checked first so every write returns 409 after approval (AC-2.7);
    // the database functions re-check atomically.
    if (await isScheduleApproved()) return fail(409, M.locked);
    return await run();
  } catch (e) {
    console.error("students API error:", e);
    return fail(500, M.serverError);
  }
}

/** POST /api/students (id = null) and PATCH /api/students/[id]. */
export function handleSave(request: Request, id: string | null): Promise<Response> {
  return guarded(async () => {
    if (id !== null && !isUuid(id)) return fail(404, M.notFound);
    const json = await readJson(request);
    if (!json.ok) return fail(400, M.unreadable);
    const parsed = validateStudent(json.body);
    if (!parsed.ok) return fail(400, M.fixErrors, { errors: parsed.errors });
    return writeResponse(await saveStudent(id, parsed.data), id === null ? 201 : 200);
  });
}

/** POST /api/students/[id]/deactivate. */
export function handleDeactivate(id: string): Promise<Response> {
  return guarded(async () => {
    if (!isUuid(id)) return fail(404, M.notFound);
    return writeResponse(await deactivateStudent(id), 200);
  });
}
