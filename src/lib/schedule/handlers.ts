import "server-only";
import { NextResponse } from "next/server";
import { generateDraft } from "@/lib/scheduling";
import { applyEdit, parseEditOp } from "./edits";
import { SM } from "./messages";
import { approveSchedule, listScheduleStudents, loadSchedule, saveDraft, type ScheduleWriteResult } from "./repository";
import { approvalSummary } from "./summary";
import { termFor } from "./term";
import { validateDraft } from "./validate";

// Shared logic for the /api/schedule route handlers. Responses:
// 400 { error } invalid input / hard violation · 404 no draft or unknown item · 409 approved · 500 unexpected.

const fail = (status: number, error: string, extra: object = {}) => NextResponse.json({ error, ...extra }, { status });

function writeFailure(result: Extract<ScheduleWriteResult, { ok: false }>) {
  if (result.reason === "locked") return fail(409, SM.locked);
  if (result.reason === "no_draft") return fail(404, SM.noDraft);
  if (result.reason === "invalid") return fail(400, SM.invalidEdit);
  return fail(500, SM.serverError);
}

async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    console.error("schedule API error:", e);
    return fail(500, SM.serverError);
  }
}

/** POST /api/schedule/generate — creates or replaces the draft (AC-3.1, AC-3.10). */
export function handleGenerate(): Promise<Response> {
  return guarded(async () => {
    const [schedule, students] = await Promise.all([loadSchedule(), listScheduleStudents()]);
    if (schedule?.status === "approved") return fail(409, SM.locked);

    const result = generateDraft(students);
    if (!result.ok) {
      return fail(400, SM.missingAvailability, {
        missing: result.missingAvailability.map((s) => ({ id: s.id, full_name: s.full_name })),
      });
    }
    const saved = await saveDraft(result.draft.groups, true);
    if (!saved.ok) return writeFailure(saved);
    return NextResponse.json({ id: saved.id, classes: result.draft.groups.length, unallocated: result.draft.unallocated.length });
  });
}

/** POST /api/schedule/edits — one manual edit; hard violations block it, soft ones are warnings (AC-3.9). */
export function handleEdit(request: Request): Promise<Response> {
  return guarded(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, SM.unreadable);
    }

    const [schedule, students] = await Promise.all([loadSchedule(), listScheduleStudents()]);
    if (schedule?.status === "approved") return fail(409, SM.locked);
    if (!schedule) return fail(404, SM.noDraft);

    const op = parseEditOp(body);
    if (!op) return fail(400, SM.invalidEdit);

    const result = applyEdit(schedule.groups, students, op);
    if (!result.ok) return fail(result.status, result.error, result.issues ? { issues: result.issues } : {});

    const saved = await saveDraft(result.groups, false);
    if (!saved.ok) return writeFailure(saved);
    return NextResponse.json({ warnings: result.warnings });
  });
}

/** POST /api/schedule/approve — irreversible; needs zero hard violations (AC-3.11). */
export function handleApprove(now: () => Date = () => new Date()): Promise<Response> {
  return guarded(async () => {
    const [schedule, students] = await Promise.all([loadSchedule(), listScheduleStudents()]);
    if (schedule?.status === "approved") return fail(409, SM.locked);
    if (!schedule) return fail(404, SM.noDraft);

    const check = validateDraft(schedule.groups, students);
    const summary = approvalSummary(schedule.groups, students, check);
    if (check.hard.length > 0) return fail(400, SM.hardViolations, { issues: check.hard });
    if (!summary.canApprove) return fail(400, SM.emptyDraft);

    const term = termFor(now());
    const approved = await approveSchedule(term);
    if (!approved.ok) return writeFailure(approved);
    return NextResponse.json({ id: approved.id, ...term });
  });
}
