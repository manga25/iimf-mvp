import { beforeEach, describe, expect, it, vi } from "vitest";

// ensurePayments(): lazy generation glue (SPEC §3.7, AC-6.6) — renders overdue messages and never throws.
const repo = { syncPayments: vi.fn(), createOverdueNotifications: vi.fn() };
vi.mock("@/lib/payments/repository", () => repo);
vi.mock("next/server", () => ({ connection: async () => {} }));

const { ensurePayments } = await import("@/lib/payments/sync");

beforeEach(() => vi.clearAllMocks());

describe("ensurePayments", () => {
  it("creates notifications for the overdue payments returned by the sync", async () => {
    repo.syncPayments.mockResolvedValue([{
      payment_id: "p1", student_id: "s", month: "2026-10-01", amount: 45, full_name: "Ana",
      phone: "+351911111111", guardian_name: null, guardian_phone: null,
    }]);
    await ensurePayments();
    const [notes] = repo.createOverdueNotifications.mock.calls[0];
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ payment_id: "p1", recipient: "student" });
    expect(notes[0].message).toContain("the October 2026 payment for Ana (45.00 €)");
  });

  it("skips the second call when nothing is overdue, and swallows errors", async () => {
    repo.syncPayments.mockResolvedValue([]);
    await ensurePayments();
    expect(repo.createOverdueNotifications).not.toHaveBeenCalled();
    repo.syncPayments.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(ensurePayments()).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
