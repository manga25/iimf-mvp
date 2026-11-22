import { beforeEach, describe, expect, it, vi } from "vitest";

// PATCH /api/notifications/[id]: auth (AC-1.3), save / send / dismiss (AC-7.3), refusals.
const getAuthUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthUser }));

const repo = { applyNotificationAction: vi.fn() };
vi.mock("@/lib/notifications/repository", () => repo);

const { PATCH } = await import("@/app/api/notifications/[id]/route");
const { NM } = await import("@/lib/notifications/messages");

const NID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = NID) => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown) => new Request("http://localhost/api", {
  method: "PATCH", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
});
const stored = { id: NID, status: "sent", message: "Edited", sent_at: "2026-11-22T10:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: "teacher", email: "t@example.com" });
  repo.applyNotificationAction.mockResolvedValue({ ok: true, notification: stored });
});

describe("auth (AC-1.3)", () => {
  it("returns 401 without a session and writes nothing", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await PATCH(patch({ action: "dismiss" }), ctx())).status).toBe(401);
    expect(repo.applyNotificationAction).not.toHaveBeenCalled();
  });
});

describe("actions (AC-7.3)", () => {
  it("marks it sent with the trimmed, edited message", async () => {
    const res = await PATCH(patch({ action: "send", message: "  Edited  " }), ctx());
    expect([res.status, await res.json()]).toEqual([200, { notification: stored }]);
    expect(repo.applyNotificationAction).toHaveBeenCalledWith(NID, { action: "send", message: "Edited" });
  });

  it("saves an edit and dismisses, ignoring any message on dismiss", async () => {
    expect((await PATCH(patch({ action: "save", message: "New text" }), ctx())).status).toBe(200);
    expect(repo.applyNotificationAction).toHaveBeenLastCalledWith(NID, { action: "save", message: "New text" });
    expect((await PATCH(patch({ action: "dismiss", message: "" }), ctx())).status).toBe(200);
    expect(repo.applyNotificationAction).toHaveBeenLastCalledWith(NID, { action: "dismiss" });
  });
});

describe("refusals", () => {
  it("returns 400 for empty or too long messages, unknown actions and unreadable bodies", async () => {
    const empty = await PATCH(patch({ action: "send", message: "   " }), ctx());
    expect([empty.status, await empty.json()]).toEqual([400, { error: NM.messageEmpty, fields: { message: NM.messageEmpty } }]);
    expect((await PATCH(patch({ action: "save", message: "x".repeat(2001) }), ctx())).status).toBe(400);
    expect((await PATCH(patch({ action: "send", message: 42 }), ctx())).status).toBe(400);
    expect((await PATCH(patch({ action: "delete" }), ctx())).status).toBe(400);
    expect((await PATCH(patch("{oops"), ctx())).status).toBe(400);
    expect(repo.applyNotificationAction).not.toHaveBeenCalled();
  });

  it("accepts exactly 2000 characters", async () => {
    expect((await PATCH(patch({ action: "save", message: "x".repeat(2000) }), ctx())).status).toBe(200);
  });

  it("returns 404 for unknown or malformed ids and 409 once sent or dismissed", async () => {
    expect((await PATCH(patch({ action: "dismiss" }), ctx("nope"))).status).toBe(404);
    repo.applyNotificationAction.mockResolvedValue({ ok: false, reason: "not_found" });
    const missing = await PATCH(patch({ action: "dismiss" }), ctx());
    expect([missing.status, (await missing.json()).error]).toEqual([404, NM.notFound]);
    repo.applyNotificationAction.mockResolvedValue({ ok: false, reason: "not_pending" });
    const done = await PATCH(patch({ action: "send", message: "Hi" }), ctx());
    expect([done.status, (await done.json()).error]).toEqual([409, NM.notPending]);
  });

  it("hides unexpected errors behind a friendly message (AC-9.4)", async () => {
    repo.applyNotificationAction.mockResolvedValue({ ok: false, reason: "error" });
    const res = await PATCH(patch({ action: "dismiss" }), ctx());
    expect([res.status, (await res.json()).error]).toEqual([500, NM.serverError]);
    repo.applyNotificationAction.mockRejectedValue(new Error("db down"));
    const crash = await PATCH(patch({ action: "dismiss" }), ctx());
    expect([crash.status, (await crash.json()).error]).toEqual([500, NM.serverError]);
  });
});
