import { beforeEach, describe, expect, it, vi } from "vitest";

// API routes for students: auth (AC-1.3), validation (AC-2.2–2.5) and the post-approval lock (AC-2.7).
const getAuthUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthUser }));

const repo = {
  isScheduleApproved: vi.fn(),
  saveStudent: vi.fn(),
  deactivateStudent: vi.fn(),
};
vi.mock("@/lib/students/repository", () => repo);

const { POST: create } = await import("@/app/api/students/route");
const { PATCH: edit } = await import("@/app/api/students/[id]/route");
const { POST: deactivate } = await import("@/app/api/students/[id]/deactivate/route");
const { M } = await import("@/lib/students/messages");

const ID = "3f8a1c2e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const valid = {
  full_name: "Ana Silva", phone: "912345678", goal: "cambridge", cefr_level: "B2",
  availability: [{ weekday: 1, start_time: "09:00", end_time: "10:00" }, { weekday: 1, start_time: "10:00", end_time: "10:30" }],
};
const req = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/students", {
    method, headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  getAuthUser.mockResolvedValue({ id: "teacher", email: "t@example.com" });
  repo.isScheduleApproved.mockResolvedValue(false);
  repo.saveStudent.mockResolvedValue({ ok: true, id: ID });
  repo.deactivateStudent.mockResolvedValue({ ok: true, id: ID });
});

describe("POST /api/students", () => {
  it("returns 401 without a session", async () => {
    getAuthUser.mockResolvedValue(null);
    expect((await create(req(valid), {})).status).toBe(401);
    expect(repo.saveStudent).not.toHaveBeenCalled();
  });

  it("creates a student with normalised phone and merged availability (201)", async () => {
    const res = await create(req(valid), {});
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: ID });
    expect(repo.saveStudent).toHaveBeenCalledWith(null, expect.objectContaining({
      phone: "+351912345678",
      availability: [{ weekday: 1, start_time: "09:00", end_time: "10:30" }],
    }));
  });

  it("returns 400 with field-specific errors and writes nothing", async () => {
    const res = await create(req({ ...valid, goal: "school_support", cefr_level: null, school_year: 13, phone: "12345" }), {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: M.fixErrors, errors: { school_year: M.yearInvalid, phone: M.phoneInvalid } });
    expect(repo.saveStudent).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const res = await create(req("{not json"), {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: M.unreadable });
  });

  it("returns 500 with a non-technical message when the database fails", async () => {
    repo.saveStudent.mockResolvedValue({ ok: false, reason: "error" });
    const res = await create(req(valid), {});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: M.serverError });
  });

  it("returns 500 when the approval check throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    repo.isScheduleApproved.mockRejectedValue(new Error("connection refused"));
    expect((await create(req(valid), {})).status).toBe(500);
  });
});

describe("PATCH /api/students/[id]", () => {
  it("updates an existing student (200)", async () => {
    const res = await edit(req(valid, "PATCH"), ctx(ID));
    expect(res.status).toBe(200);
    expect(repo.saveStudent).toHaveBeenCalledWith(ID, expect.objectContaining({ full_name: "Ana Silva" }));
  });

  it("returns 404 for an unknown or malformed id", async () => {
    repo.saveStudent.mockResolvedValue({ ok: false, reason: "not_found" });
    expect((await edit(req(valid, "PATCH"), ctx(ID))).status).toBe(404);
    expect((await edit(req(valid, "PATCH"), ctx("not-a-uuid"))).status).toBe(404);
  });
});

describe("POST /api/students/[id]/deactivate", () => {
  it("deactivates the student", async () => {
    const res = await deactivate(req({}), ctx(ID));
    expect(res.status).toBe(200);
    expect(repo.deactivateStudent).toHaveBeenCalledWith(ID);
  });

  it("returns 401 without a session and 404 for a bad id", async () => {
    expect((await deactivate(req({}), ctx("x"))).status).toBe(404);
    getAuthUser.mockResolvedValue(null);
    expect((await deactivate(req({}), ctx(ID))).status).toBe(401);
  });
});

describe("AC-2.7 after approval", () => {
  beforeEach(() => repo.isScheduleApproved.mockResolvedValue(true));

  it("create, edit and deactivate all return 409 with a clear message", async () => {
    for (const res of [
      await create(req(valid), {}),
      await create(req({}), {}), // even an invalid body gets 409, not 400
      await edit(req(valid, "PATCH"), ctx(ID)),
      await deactivate(req({}), ctx(ID)),
    ]) {
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: M.locked });
    }
    expect(repo.saveStudent).not.toHaveBeenCalled();
    expect(repo.deactivateStudent).not.toHaveBeenCalled();
  });

  it("returns 409 when approval happens between the check and the write", async () => {
    repo.isScheduleApproved.mockResolvedValue(false);
    repo.saveStudent.mockResolvedValue({ ok: false, reason: "locked" });
    expect((await create(req(valid), {})).status).toBe(409);
  });
});
