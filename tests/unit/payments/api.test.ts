import { beforeEach, describe, expect, it, vi } from "vitest";

// PUT /api/payments/[id]: auth (AC-1.3), mark paid / unpaid (AC-6.7), refusals.
const getAuthUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthUser }));

const repo = { setPaymentStatus: vi.fn() };
vi.mock("@/lib/payments/repository", () => repo);

const { PUT } = await import("@/app/api/payments/[id]/route");
const { PM } = await import("@/lib/payments/messages");
const { lisbonToday, addDays } = await import("@/lib/calendar/dates");

const PID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = PID) => ({ params: Promise.resolve({ id }) });
const put = (body: unknown) => new Request("http://localhost/api", {
  method: "PUT", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const stored = { id: PID, student_id: "s", month: "2026-10-01", hours: 6, amount: 60, status: "paid", paid_at: "2026-11-03" };

beforeEach(() => {
  vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: "teacher", email: "t@example.com" });
  repo.setPaymentStatus.mockResolvedValue({ ok: true, payment: stored });
});

describe("auth (AC-1.3)", () => {
  it("returns 401 without a session and writes nothing", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await PUT(put({ status: "paid", paid_at: lisbonToday() }), ctx())).status).toBe(401);
    expect(repo.setPaymentStatus).not.toHaveBeenCalled();
  });
});

describe("marking paid / unpaid (AC-6.7)", () => {
  it("marks Paid with today's date and returns the stored payment", async () => {
    const res = await PUT(put({ status: "paid", paid_at: lisbonToday() }), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ payment: stored });
    expect(repo.setPaymentStatus).toHaveBeenCalledWith(PID, { status: "paid", paid_at: lisbonToday() });
  });

  it("marks Unpaid, ignoring any date", async () => {
    expect((await PUT(put({ status: "unpaid", paid_at: "2026-11-03" }), ctx())).status).toBe(200);
    expect(repo.setPaymentStatus).toHaveBeenCalledWith(PID, { status: "unpaid", paid_at: null });
  });
});

describe("refusals", () => {
  it("returns 400 for a future date, a bad status or an unreadable body", async () => {
    const future = await PUT(put({ status: "paid", paid_at: addDays(lisbonToday(), 1) }), ctx());
    expect([future.status, await future.json()]).toEqual([400, { error: PM.paidAtFuture, fields: { paid_at: PM.paidAtFuture } }]);
    expect((await PUT(put({ status: "overdue" }), ctx())).status).toBe(400);
    expect((await PUT(put("{oops"), ctx())).status).toBe(400);
    expect(repo.setPaymentStatus).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown or malformed ids and 409 for the same status", async () => {
    expect((await PUT(put({ status: "unpaid" }), ctx("nope"))).status).toBe(404);
    repo.setPaymentStatus.mockResolvedValue({ ok: false, reason: "not_found" });
    const missing = await PUT(put({ status: "unpaid" }), ctx());
    expect([missing.status, (await missing.json()).error]).toEqual([404, PM.notFound]);
    repo.setPaymentStatus.mockResolvedValue({ ok: false, reason: "same_status" });
    expect((await PUT(put({ status: "unpaid" }), ctx())).status).toBe(409);
  });

  it("hides unexpected errors behind a friendly message (AC-9.4)", async () => {
    repo.setPaymentStatus.mockResolvedValue({ ok: false, reason: "error" });
    const res = await PUT(put({ status: "unpaid" }), ctx());
    expect([res.status, (await res.json()).error]).toEqual([500, PM.serverError]);
    repo.setPaymentStatus.mockRejectedValue(new Error("db down"));
    const crash = await PUT(put({ status: "unpaid" }), ctx());
    expect([crash.status, (await crash.json()).error]).toEqual([500, PM.serverError]);
  });
});
