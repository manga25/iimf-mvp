import { beforeEach, describe, expect, it, vi } from "vitest";

// AC-1.3: API routes return 401 for unauthenticated requests.
const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}));

const { withAuth } = await import("@/lib/auth/api");
const { UNAUTHORIZED_MESSAGE } = await import("@/lib/auth/messages");

const handler = vi.fn(async (_req: Request, _ctx: unknown, user: { id: string }) =>
  Response.json({ ok: true, userId: user.id }),
);
const route = withAuth(handler);
const request = () => new Request("http://localhost/api/students");

beforeEach(() => {
  getClaims.mockReset();
  handler.mockClear();
});

describe("withAuth", () => {
  it("returns 401 with a clear message when there is no session", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const res = await route(request(), {});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: UNAUTHORIZED_MESSAGE });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is invalid or expired", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("JWT expired") });
    expect((await route(request(), {})).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the auth check itself fails", async () => {
    getClaims.mockRejectedValue(new Error("network down"));
    expect((await route(request(), {})).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler with the verified user when authenticated", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", email: "t@example.com" } }, error: null });
    const res = await route(request(), {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: "user-1" });
    expect(handler).toHaveBeenCalledOnce();
  });
});
