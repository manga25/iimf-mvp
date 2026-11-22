import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleRecord, ScheduleStudent } from "@/lib/schedule";

// Schedule API: auth (AC-1.3), generation block (AC-3.1), manual edits (AC-3.9), approval (AC-3.11).
const getAuthUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthUser }));

const repo = { loadSchedule: vi.fn(), listScheduleStudents: vi.fn(), saveDraft: vi.fn(), approveSchedule: vi.fn() };
vi.mock("@/lib/schedule/repository", () => repo);

const { POST: generate } = await import("@/app/api/schedule/generate/route");
const { POST: edit } = await import("@/app/api/schedule/edits/route");
const { POST: approve } = await import("@/app/api/schedule/approve/route");
const { handleApprove } = await import("@/lib/schedule/handlers");
const { SM } = await import("@/lib/schedule/messages");

const uid = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const GID = "11111111-1111-4111-8111-111111111111";
const student = (n: number, over: Partial<ScheduleStudent> = {}): ScheduleStudent => ({
  id: uid(n), full_name: `Student ${n}`, goal: "cambridge", cefr_level: "B2", school_year: null, is_active: true,
  created_at: "2026-09-01T00:00:00Z", availability: [{ weekday: 2, start_time: "17:00", end_time: "20:00" }], ...over,
});
const students = [1, 2, 3, 4].map((n) => student(n));
const draft = (over: Partial<ScheduleRecord> = {}): ScheduleRecord => ({
  id: "s1", status: "draft", generated_at: "2026-09-02T00:00:00Z", approved_at: null, term_start: null, term_end: null,
  groups: [{ id: GID, name: "Cambridge B2 · A", goal: "cambridge", cefr_level: "B2", school_year: null,
    weekday: 2, start_time: "18:00", duration_min: 90, member_ids: [uid(1), uid(2), uid(3)] }],
  ...over,
});
const req = (body: unknown) => new Request("http://localhost/api/schedule/edits", {
  method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const post = () => new Request("http://localhost/api/schedule", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: "teacher", email: "t@example.com" });
  repo.loadSchedule.mockResolvedValue(draft());
  repo.listScheduleStudents.mockResolvedValue(students);
  repo.saveDraft.mockResolvedValue({ ok: true, id: "s1" });
  repo.approveSchedule.mockResolvedValue({ ok: true, id: "s1" });
});

describe("auth (AC-1.3)", () => {
  it("all three routes return 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    for (const res of [await generate(post(), {}), await edit(req({}), {}), await approve(post(), {})]) expect(res.status).toBe(401);
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });
});

describe("POST /api/schedule/generate", () => {
  it("is blocked and lists students without availability (AC-3.1)", async () => {
    repo.listScheduleStudents.mockResolvedValue([...students, student(9, { full_name: "No Slots", availability: [] })]);
    const res = await generate(post(), {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: SM.missingAvailability, missing: [{ id: uid(9), full_name: "No Slots" }] });
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("saves the engine's draft as a regeneration", async () => {
    repo.loadSchedule.mockResolvedValue(null);
    const res = await generate(post(), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "s1", classes: 1, unallocated: 0 });
    expect(repo.saveDraft).toHaveBeenCalledWith([expect.objectContaining({ member_ids: students.map((s) => s.id) })], true);
  });

  it("returns 409 after approval", async () => {
    repo.loadSchedule.mockResolvedValue(draft({ status: "approved" }));
    expect((await generate(post(), {})).status).toBe(409);
  });
});

describe("POST /api/schedule/edits (AC-3.9)", () => {
  it("blocks an edit that would end after 20:00 (H1) and saves nothing", async () => {
    const res = await edit(req({ type: "reschedule", group_id: GID, weekday: 2, start_time: "19:00" }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^This change can't be saved:/);
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("saves an edit with a soft warning and returns it", async () => {
    const res = await edit(req({ type: "remove", student_id: uid(3) }), {});
    expect(res.status).toBe(200);
    expect((await res.json()).warnings).toEqual([expect.objectContaining({ code: "S1" })]);
    expect(repo.saveDraft).toHaveBeenCalledWith([expect.objectContaining({ member_ids: [uid(1), uid(2)] })], false);
  });

  it("assigns an unallocated student", async () => {
    const res = await edit(req({ type: "assign", student_id: uid(4), group_id: GID }), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ warnings: [] });
  });

  it("creates an individual class for an unallocated Individual student and saves it", async () => {
    repo.listScheduleStudents.mockResolvedValue([...students, student(5, { full_name: "Solo", goal: "individual", cefr_level: null })]);
    const res = await edit(req({ type: "create_individual", student_id: uid(5), weekday: 2, start_time: "17:00" }), {});
    expect(res.status).toBe(200);
    expect(repo.saveDraft).toHaveBeenCalledWith([
      expect.objectContaining({ id: GID }),
      expect.objectContaining({ name: "Individual · Solo", goal: "individual", weekday: 2, start_time: "17:00", duration_min: 60, member_ids: [uid(5)] }),
    ], false);
  });

  it("rejects a time change outside the members' availability and saves nothing", async () => {
    const res = await edit(req({ type: "reschedule", group_id: GID, weekday: 3, start_time: "18:00" }), {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(SM.outsideAvailability(["Student 1", "Student 2", "Student 3"], "Wednesday 18:00–19:30"));
    expect(repo.saveDraft).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed input, 404 without a draft, 409 after approval", async () => {
    expect((await edit(req("{bad"), {})).status).toBe(400);
    expect((await edit(req({ type: "remove", student_id: "x" }), {})).status).toBe(400);
    repo.loadSchedule.mockResolvedValue(null);
    expect((await edit(req({ type: "remove", student_id: uid(1) }), {})).status).toBe(404);
    repo.loadSchedule.mockResolvedValue(draft({ status: "approved" }));
    const res = await edit(req({ type: "remove", student_id: uid(1) }), {});
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: SM.locked });
  });

  it("returns 500 with a friendly message when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    repo.loadSchedule.mockRejectedValue(new Error("connection refused"));
    const res = await edit(req({ type: "remove", student_id: uid(1) }), {});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: SM.serverError });
  });
});

describe("POST /api/schedule/approve (AC-3.11)", () => {
  it("approves with the term derived from today (Lisbon)", async () => {
    const res = await handleApprove(() => new Date("2026-11-21T12:00:00Z"));
    expect(res.status).toBe(200);
    expect(repo.approveSchedule).toHaveBeenCalledWith({ term_start: "2026-09-01", term_end: "2027-07-31" });
  });

  it("is impossible with hard violations", async () => {
    repo.listScheduleStudents.mockResolvedValue(students.map((s) => (s.id === uid(1) ? { ...s, is_active: false } : s)));
    const res = await approve(post(), {});
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: SM.hardViolations, issues: [expect.objectContaining({ code: "H4" })] });
    expect(repo.approveSchedule).not.toHaveBeenCalled();
  });

  it("refuses an empty draft, a missing draft and a second approval", async () => {
    repo.loadSchedule.mockResolvedValue(draft({ groups: [] }));
    expect(await (await approve(post(), {})).json()).toEqual({ error: SM.emptyDraft });
    repo.loadSchedule.mockResolvedValue(null);
    expect((await approve(post(), {})).status).toBe(404);
    repo.loadSchedule.mockResolvedValue(draft({ status: "approved" }));
    expect((await approve(post(), {})).status).toBe(409);
  });

  it("maps a concurrent approval (IM409 from the RPC) to 409", async () => {
    repo.approveSchedule.mockResolvedValue({ ok: false, reason: "locked" });
    expect((await approve(post(), {})).status).toBe(409);
  });
});
