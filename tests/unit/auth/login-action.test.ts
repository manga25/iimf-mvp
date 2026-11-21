import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_UNAVAILABLE_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  MISSING_CREDENTIALS_MESSAGE,
} from "@/lib/auth/messages";
import { validateLogin } from "@/lib/validation/login";

const signInWithPassword = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signInWithPassword } })),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { login } = await import("@/app/login/actions");

const form = (email: string, password: string) => {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
};
const initial = { error: null, email: "" };

beforeEach(() => {
  signInWithPassword.mockReset();
  redirect.mockClear();
});

describe("validateLogin", () => {
  it("trims and lower-cases the email", () => {
    expect(validateLogin("  Teacher@IIMF.pt ", "secret")).toEqual({
      ok: true,
      data: { email: "teacher@iimf.pt", password: "secret" },
    });
  });

  it.each([
    ["", "secret", MISSING_CREDENTIALS_MESSAGE],
    ["teacher@iimf.pt", "", MISSING_CREDENTIALS_MESSAGE],
    [null, null, MISSING_CREDENTIALS_MESSAGE],
    ["not-an-email", "secret", INVALID_EMAIL_MESSAGE],
  ])("rejects email=%j password=%j", (email, password, message) => {
    expect(validateLogin(email, password)).toEqual({ ok: false, error: message });
  });
});

describe("login action (AC-1.2)", () => {
  it("does not call Supabase when the input is invalid", async () => {
    const state = await login(initial, form("", ""));
    expect(state.error).toBe(MISSING_CREDENTIALS_MESSAGE);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows a clear error and keeps the email on wrong credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    const state = await login(initial, form("teacher@iimf.pt", "wrong"));
    expect(state).toEqual({ error: INVALID_CREDENTIALS_MESSAGE, email: "teacher@iimf.pt" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("shows a service error when Supabase is unreachable", async () => {
    signInWithPassword.mockRejectedValue(new Error("fetch failed"));
    const state = await login(initial, form("teacher@iimf.pt", "secret"));
    expect(state.error).toBe(AUTH_UNAVAILABLE_MESSAGE);
  });

  it("redirects to the dashboard on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    await expect(login(initial, form("teacher@iimf.pt", "secret"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "teacher@iimf.pt", password: "secret" });
  });
});
