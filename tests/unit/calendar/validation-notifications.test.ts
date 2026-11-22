import { describe, expect, it } from "vitest";
import { CM } from "@/lib/calendar/messages";
import { parseModality, validateBlockedPeriod } from "@/lib/calendar/validation";
import { primaryRecipient } from "@/lib/notifications/recipient";
import { buildSessionNotifications } from "@/lib/notifications/session";
import { renderTemplate, TEMPLATES } from "@/lib/notifications/templates";

describe("validateBlockedPeriod (SPEC §3.9)", () => {
  it("accepts a valid period, trimming the reason and dropping seconds", () => {
    expect(validateBlockedPeriod({ start: "2026-12-23T00:00", end: "2027-01-02T23:59:00", reason: "  Christmas " }))
      .toEqual({ ok: true, value: { start: "2026-12-23T00:00", end: "2027-01-02T23:59", reason: "Christmas" } });
  });

  it("rejects start ≥ end, invalid dates and bad reasons with field errors", () => {
    expect(validateBlockedPeriod({ start: "2026-12-23T10:00", end: "2026-12-23T10:00", reason: "x" }))
      .toEqual({ ok: false, errors: { end: CM.endBeforeStart } });
    expect(validateBlockedPeriod({ start: "2026-02-30T10:00", end: "nope", reason: " " }))
      .toEqual({ ok: false, errors: { start: CM.startInvalid, end: CM.endInvalid, reason: CM.reasonRequired } });
    expect(validateBlockedPeriod({ start: "2026-12-23T10:00", end: "2026-12-23T11:00", reason: "x".repeat(201) }))
      .toEqual({ ok: false, errors: { reason: CM.reasonTooLong } });
    expect(validateBlockedPeriod(null).ok).toBe(false);
  });

  it("parses the modality", () => {
    expect(parseModality({ modality: "online" })).toBe("online");
    expect(parseModality({ modality: "in_person" })).toBe("in_person");
    expect(parseModality({ modality: "hybrid" })).toBeNull();
    expect(parseModality("online")).toBeNull();
  });
});

const ana = { id: "a", full_name: "Ana Silva", phone: "+351911111111", guardian_name: "Rita Silva", guardian_phone: "+351922222222" };
const rui = { id: "r", full_name: "Rui Costa", phone: "+351933333333", guardian_name: null, guardian_phone: null };
const session = { name: "Year 7 · A", date: "2026-11-24", start_time: "18:00", members: [ana, rui] };

describe("session notifications (AC-4.3, AC-4.4, AC-7.1)", () => {
  it("goes to the guardian when present, else to the student", () => {
    expect(primaryRecipient(ana)).toEqual({ recipient: "guardian", name: "Rita Silva", phone: "+351922222222" });
    expect(primaryRecipient(rui)).toEqual({ recipient: "student", name: "Rui Costa", phone: "+351933333333" });
  });

  it("builds one cancellation per student with every placeholder filled", () => {
    const notes = buildSessionNotifications("cancellation", session);
    expect(notes.map((n) => [n.student_id, n.recipient, n.phone])).toEqual([
      ["a", "guardian", "+351922222222"], ["r", "student", "+351933333333"],
    ]);
    expect(notes[0].message).toBe(
      "Hello Rita Silva, this is Margarida Freitas from IIMF. The Year 7 · A class on Tuesday, 24 November 2026 at 18:00 has been cancelled. Sorry for the inconvenience.",
    );
    for (const n of notes) expect(n.message).not.toMatch(/\{\w+\}/);
  });

  it("builds modality_change messages with the new modality", () => {
    const [online] = buildSessionNotifications("modality_change", session, "online");
    expect(online.message).toBe(
      "Hello Rita Silva, this is Margarida Freitas from IIMF. The Year 7 · A class on Tuesday, 24 November 2026 at 18:00 will be online. Thank you!",
    );
    expect(buildSessionNotifications("modality_change", session, "in_person")[1].message).toContain("will be in person.");
  });

  it("refuses to render a template with a missing value", () => {
    expect(() => renderTemplate(TEMPLATES.cancellation, { recipient_name: "X" })).toThrow(/class_name/);
  });
});
