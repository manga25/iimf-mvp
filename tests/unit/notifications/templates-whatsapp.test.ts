import { describe, expect, it } from "vitest";
import { buildAbsenceNotifications } from "@/lib/notifications/absence";
import { parseNotificationFilters } from "@/lib/notifications/filters";
import { buildOverdueNotifications } from "@/lib/notifications/overdue";
import { buildSessionNotifications } from "@/lib/notifications/session";
import { TEMPLATES } from "@/lib/notifications/templates";
import { waLink } from "@/lib/notifications/whatsapp";

const PLACEHOLDER = /\{\w+\}/;
const ana = { id: "a", full_name: "Ana Silva", phone: "+351911111111", guardian_name: "Rita Silva", guardian_phone: "+351922222222" };
const ivo = { id: "i", full_name: "Ivo Costa", phone: "+351944444444", guardian_name: null, guardian_phone: null };
const session = { name: "Year 7 · A", date: "2026-11-24", start_time: "18:00", members: [ana, ivo] };

describe("template rendering (AC-7.1)", () => {
  it("fills every placeholder of all four types", () => {
    const messages = [
      ...buildAbsenceNotifications(session, ana),
      ...buildSessionNotifications("cancellation", session),
      ...buildSessionNotifications("modality_change", session, "online"),
      ...buildOverdueNotifications([{
        payment_id: "p", student_id: "a", month: "2026-10-01", amount: 60,
        full_name: ana.full_name, phone: ana.phone, guardian_name: ana.guardian_name, guardian_phone: ana.guardian_phone,
      }]),
    ].map((n) => n.message);
    expect(messages).toHaveLength(7);
    for (const m of messages) expect(m).not.toMatch(PLACEHOLDER);
    expect(Object.keys(TEMPLATES).sort()).toEqual(["absence", "cancellation", "modality_change", "overdue"]);
  });

  it("writes the absence message with the student, class, date and time", () => {
    const [toStudent, toGuardian] = buildAbsenceNotifications(session, ana);
    expect(toStudent.message).toBe(
      "Hello Ana Silva, this is Margarida Freitas from IIMF. Ana Silva was absent from today's Year 7 · A class (Tuesday, 24 November 2026, 18:00). Please let me know if you need anything. Thank you!",
    );
    expect(toGuardian.message).toMatch(/^Hello Rita Silva, .* Ana Silva was absent/);
  });

  it("writes the overdue message with the month and amount, to the guardian", () => {
    const [n] = buildOverdueNotifications([{
      payment_id: "p", student_id: "a", month: "2026-10-01", amount: 60,
      full_name: ana.full_name, phone: ana.phone, guardian_name: ana.guardian_name, guardian_phone: ana.guardian_phone,
    }]);
    expect(n).toMatchObject({ recipient: "guardian", phone: "+351922222222" });
    expect(n.message).toContain("the October 2026 payment for Ana Silva (60.00 €) is still pending");
  });
});

describe("wa.me link (AC-7.2)", () => {
  it("uses digits only and a URL-encoded message", () => {
    expect(waLink("+351912345678", "Hello Ana & Rita, 50 € ok?")).toBe(
      "https://wa.me/351912345678?text=Hello%20Ana%20%26%20Rita%2C%2050%20%E2%82%AC%20ok%3F",
    );
    expect(waLink("+44 7911 123456", "Hi")).toBe("https://wa.me/447911123456?text=Hi");
  });

  it("round-trips multi-line messages", () => {
    const message = "Line 1\nLine 2 · {not a placeholder}";
    const url = new URL(waLink("+351912345678", message));
    expect(url.searchParams.get("text")).toBe(message);
  });
});

describe("log filters (AC-7.4)", () => {
  it("accepts known types and statuses and falls back to all", () => {
    expect(parseNotificationFilters({ type: "absence", status: "pending" })).toEqual({ type: "absence", status: "pending" });
    expect(parseNotificationFilters({ type: ["overdue", "x"], status: "sent" })).toEqual({ type: "overdue", status: "sent" });
    expect(parseNotificationFilters({ type: "spam", status: "read" })).toEqual({ type: "all", status: "all" });
    expect(parseNotificationFilters({})).toEqual({ type: "all", status: "all" });
  });
});
