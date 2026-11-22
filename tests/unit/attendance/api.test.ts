import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarSession } from "@/lib/calendar/types";

// PUT /api/sessions/[id]/attendance: auth (AC-1.3), notifications (AC-5.3), refusals (AC-5.4).
const getAuthUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthUser }));

const calendarRepo = { getSession: vi.fn() };
vi.mock("@/lib/calendar/repository", () => calendarRepo);
const attendanceRepo = { setAttendance: vi.fn() };
vi.mock("@/lib/attendance/repository", () => attendanceRepo);

const { PUT } = await import("@/app/api/sessions/[id]/attendance/route");
const { CM } = await import("@/lib/calendar/messages");
const { AM } = await import("@/lib/attendance/messages");
const { lisbonToday, addDays } = await import("@/lib/calendar/dates");

const SID = "11111111-1111-4111-8111-111111111111";
const ANA = "22222222-2222-4222-8222-222222222222";
const RUI = "33333333-3333-4333-8333-333333333333";
const ctx = (id = SID) => ({ params: Promise.resolve({ id }) });
const put = (body: unknown) => new Request("http://localhost/api", {
  method: "PUT", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
});

const session = (over: Partial<CalendarSession> = {}): CalendarSession => ({
  id: SID, group_id: "g", name: "Year 7 · A", goal: "school_support", date: "2020-01-07", start_time: "18:00", end_time: "19:30",
  status: "scheduled", modality: "in_person", blocked_period_id: null, attendance: [],
  members: [
    { id: ANA, full_name: "Ana", phone: "+351911111111", guardian_name: "Rita", guardian_phone: "+351922222222" },
    { id: RUI, full_name: "Rui", phone: "+351933333333", guardian_name: null, guardian_phone: null },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: "teacher", email: "t@example.com" });
  calendarRepo.getSession.mockResolvedValue(session());
  attendanceRepo.setAttendance.mockImplementation(async (_id, input) => ({ ok: true, ...input, created: 0, removed: 0 }));
});

describe("auth (AC-1.3)", () => {
  it("returns 401 without a session and writes nothing", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await PUT(put({ student_id: ANA, status: "absent" }), ctx())).status).toBe(401);
    expect(attendanceRepo.setAttendance).not.toHaveBeenCalled();
  });
});

describe("saving attendance", () => {
  it("marks Absent with notifications for the student and the guardian (AC-5.3)", async () => {
    attendanceRepo.setAttendance.mockResolvedValue({ ok: true, status: "absent", remarks: null, created: 2, removed: 0 });
    const res = await PUT(put({ student_id: ANA, status: "absent", remarks: "" }), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "absent", remarks: null, created: 2, removed: 0 });
    const [id, input, notes] = attendanceRepo.setAttendance.mock.calls[0];
    expect([id, input]).toEqual([SID, { student_id: ANA, status: "absent", remarks: null }]);
    expect(notes.map((n: { recipient: string }) => n.recipient)).toEqual(["student", "guardian"]);
    expect(notes[1].message).toContain("Ana was absent from today's Year 7 · A class");
  });

  it("sends no notifications for Late/Present and passes trimmed remarks (AC-5.5)", async () => {
    const res = await PUT(put({ student_id: RUI, status: "late", remarks: "  Missed the bus " }), ctx());
    expect(res.status).toBe(200);
    expect(attendanceRepo.setAttendance).toHaveBeenCalledWith(SID, { student_id: RUI, status: "late", remarks: "Missed the bus" }, []);
  });

  it("allows a session dated today", async () => {
    calendarRepo.getSession.mockResolvedValue(session({ date: lisbonToday() }));
    expect((await PUT(put({ student_id: RUI, status: "late" }), ctx())).status).toBe(200);
  });
});

describe("refusals (AC-5.4)", () => {
  it("rejects future and cancelled sessions with 409 and writes nothing", async () => {
    calendarRepo.getSession.mockResolvedValue(session({ date: addDays(lisbonToday(), 1) }));
    const future = await PUT(put({ student_id: ANA, status: "absent" }), ctx());
    expect([future.status, (await future.json()).error]).toEqual([409, AM.future]);

    calendarRepo.getSession.mockResolvedValue(session({ status: "cancelled" }));
    const cancelled = await PUT(put({ student_id: ANA, status: "absent" }), ctx());
    expect([cancelled.status, (await cancelled.json()).error]).toEqual([409, AM.cancelled]);
    expect(attendanceRepo.setAttendance).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown or malformed session ids", async () => {
    expect((await PUT(put({ student_id: ANA, status: "late" }), ctx("not-a-uuid"))).status).toBe(404);
    calendarRepo.getSession.mockResolvedValue(null);
    const res = await PUT(put({ student_id: ANA, status: "late" }), ctx());
    expect([res.status, (await res.json()).error]).toEqual([404, CM.sessionNotFound]);
  });

  it("returns 400 with field errors for invalid input or a student outside the class", async () => {
    const bad = await PUT(put({ student_id: ANA, status: "excused", remarks: "x".repeat(501) }), ctx());
    expect(bad.status).toBe(400);
    expect((await bad.json()).fields).toEqual({ status: AM.statusInvalid, remarks: AM.remarksTooLong });

    const outsider = await PUT(put({ student_id: "44444444-4444-4444-8444-444444444444", status: "late" }), ctx());
    expect([outsider.status, (await outsider.json()).error]).toEqual([400, AM.studentInvalid]);
    expect((await PUT(put("{oops"), ctx())).status).toBe(400);
    expect(attendanceRepo.setAttendance).not.toHaveBeenCalled();
  });

  it("maps database refusals and hides unexpected errors behind a friendly message (AC-9.4)", async () => {
    attendanceRepo.setAttendance.mockResolvedValue({ ok: false, reason: "future" });
    expect((await PUT(put({ student_id: ANA, status: "late" }), ctx())).status).toBe(409);
    attendanceRepo.setAttendance.mockResolvedValue({ ok: false, reason: "error" });
    const res = await PUT(put({ student_id: ANA, status: "late" }), ctx());
    expect([res.status, (await res.json()).error]).toEqual([500, CM.serverError]);
    calendarRepo.getSession.mockRejectedValue(new Error("db down"));
    const crash = await PUT(put({ student_id: ANA, status: "late" }), ctx());
    expect([crash.status, (await crash.json()).error]).toEqual([500, CM.serverError]);
  });
});
