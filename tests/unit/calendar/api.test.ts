import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarSession } from "@/lib/calendar/types";

// Calendar API: auth (AC-1.3), blocked periods (AC-4.2), cancel (AC-4.3), modality (AC-4.4).
const getAuthUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthUser }));

const repo = {
  getSession: vi.fn(), createBlockedPeriod: vi.fn(), deleteBlockedPeriod: vi.fn(),
  cancelSession: vi.fn(), setSessionModality: vi.fn(),
};
vi.mock("@/lib/calendar/repository", () => repo);

const { POST: createBlock } = await import("@/app/api/blocked-periods/route");
const { DELETE: deleteBlock } = await import("@/app/api/blocked-periods/[id]/route");
const { POST: cancel } = await import("@/app/api/sessions/[id]/cancel/route");
const { POST: modality } = await import("@/app/api/sessions/[id]/modality/route");
const { CM } = await import("@/lib/calendar/messages");

const SID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = SID) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown) => new Request("http://localhost/api", {
  method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const empty = () => new Request("http://localhost/api", { method: "POST" });

const session = (over: Partial<CalendarSession> = {}): CalendarSession => ({
  id: SID, group_id: "g", name: "Year 7 · A", goal: "school_support", date: "2099-11-24", start_time: "18:00", end_time: "19:30",
  status: "scheduled", modality: "in_person", blocked_period_id: null,
  members: [
    { id: "a", full_name: "Ana", phone: "+351911111111", guardian_name: "Rita", guardian_phone: "+351922222222" },
    { id: "r", full_name: "Rui", phone: "+351933333333", guardian_name: null, guardian_phone: null },
  ],
  attendance: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: "teacher", email: "t@example.com" });
  repo.getSession.mockResolvedValue(session());
  repo.createBlockedPeriod.mockResolvedValue({ ok: true, id: "b1", cancelled: 3 });
  repo.deleteBlockedPeriod.mockResolvedValue({ ok: true, restored: 3 });
  repo.cancelSession.mockResolvedValue({ ok: true });
  repo.setSessionModality.mockResolvedValue({ ok: true });
});

describe("auth (AC-1.3)", () => {
  it("every route returns 401 without a session and writes nothing", async () => {
    getAuthUser.mockResolvedValue(null);
    const responses = [
      await createBlock(json({}), {}), await deleteBlock(empty(), ctx()),
      await cancel(empty(), ctx()), await modality(json({ modality: "online" }), ctx()),
    ];
    for (const res of responses) expect(res.status).toBe(401);
    for (const fn of Object.values(repo)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("blocked periods (AC-4.2)", () => {
  it("creates a valid block and reports how many sessions it cancelled", async () => {
    const res = await createBlock(json({ start: "2026-12-23T00:00", end: "2027-01-02T23:59", reason: "Christmas" }), {});
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "b1", cancelled: 3 });
    expect(repo.createBlockedPeriod).toHaveBeenCalledWith({ start: "2026-12-23T00:00", end: "2027-01-02T23:59", reason: "Christmas" });
  });

  it("rejects invalid input with field errors and malformed JSON", async () => {
    const res = await createBlock(json({ start: "2026-12-23T10:00", end: "2026-12-23T09:00", reason: "" }), {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: CM.invalidInput, fields: { end: CM.endBeforeStart, reason: CM.reasonRequired } });
    expect((await createBlock(json("{bad"), {})).status).toBe(400);
    expect(repo.createBlockedPeriod).not.toHaveBeenCalled();
  });

  it("deletes a block, 404 for an unknown or malformed id", async () => {
    expect(await (await deleteBlock(empty(), ctx())).json()).toEqual({ restored: 3 });
    repo.deleteBlockedPeriod.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await deleteBlock(empty(), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: CM.blockNotFound });
    expect((await deleteBlock(empty(), ctx("nope"))).status).toBe(404);
  });
});

describe("POST /api/sessions/[id]/cancel (AC-4.3)", () => {
  it("cancels with one cancellation notification per student (guardian if present)", async () => {
    const res = await cancel(empty(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notifications: 2 });
    const [, notes] = repo.cancelSession.mock.calls[0];
    expect(notes).toEqual([
      expect.objectContaining({ student_id: "a", recipient: "guardian", phone: "+351922222222", message: expect.stringContaining("Hello Rita,") }),
      expect.objectContaining({ student_id: "r", recipient: "student", phone: "+351933333333", message: expect.stringContaining("has been cancelled") }),
    ]);
  });

  it("returns 404 for unknown sessions and 409 for cancelled or finished ones", async () => {
    repo.getSession.mockResolvedValue(null);
    expect((await cancel(empty(), ctx())).status).toBe(404);
    repo.getSession.mockResolvedValue(session({ status: "cancelled" }));
    expect(await (await cancel(empty(), ctx())).json()).toEqual({ error: CM.alreadyCancelled });
    repo.getSession.mockResolvedValue(session());
    repo.cancelSession.mockResolvedValue({ ok: false, reason: "finished" });
    const res = await cancel(empty(), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: CM.finished });
  });

  it("returns a friendly 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    repo.getSession.mockRejectedValue(new Error("connection refused"));
    const res = await cancel(empty(), ctx());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: CM.serverError });
  });
});

describe("POST /api/sessions/[id]/modality (AC-4.4)", () => {
  it("switches to Online with one modality_change notification per student", async () => {
    const res = await modality(json({ modality: "online" }), ctx());
    expect(await res.json()).toEqual({ modality: "online", notifications: 2 });
    const [id, value, notes] = repo.setSessionModality.mock.calls[0];
    expect([id, value]).toEqual([SID, "online"]);
    expect(notes.every((n: { message: string }) => n.message.includes("will be online."))).toBe(true);
  });

  it("rejects an invalid or unchanged modality and cancelled sessions", async () => {
    expect((await modality(json({ modality: "hybrid" }), ctx())).status).toBe(400);
    expect(await (await modality(json({ modality: "in_person" }), ctx())).json()).toEqual({ error: CM.sameModality });
    repo.getSession.mockResolvedValue(session({ status: "cancelled" }));
    expect((await modality(json({ modality: "online" }), ctx())).status).toBe(409);
    expect(repo.setSessionModality).not.toHaveBeenCalled();
  });
});
