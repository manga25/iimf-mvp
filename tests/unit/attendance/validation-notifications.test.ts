import { describe, expect, it } from "vitest";
import { AM } from "@/lib/attendance/messages";
import { attendanceOf, toggledStatus } from "@/lib/attendance/types";
import { validateAttendance } from "@/lib/attendance/validation";
import { buildAbsenceNotifications } from "@/lib/notifications/absence";

const STUDENT = "22222222-2222-4222-8222-222222222222";

describe("validateAttendance (SPEC §3.6, §3.9)", () => {
  it("accepts every status, trims remarks and turns empty remarks into null", () => {
    expect(validateAttendance({ student_id: STUDENT, status: "late", remarks: "  Bus was late  " }))
      .toEqual({ ok: true, value: { student_id: STUDENT, status: "late", remarks: "Bus was late" } });
    expect(validateAttendance({ student_id: STUDENT, status: "absent", remarks: "   " }))
      .toEqual({ ok: true, value: { student_id: STUDENT, status: "absent", remarks: null } });
    expect(validateAttendance({ student_id: STUDENT, status: "present" }))
      .toEqual({ ok: true, value: { student_id: STUDENT, status: "present", remarks: null } });
  });

  it("allows 500 characters of remarks and rejects 501", () => {
    expect(validateAttendance({ student_id: STUDENT, status: "present", remarks: "x".repeat(500) }).ok).toBe(true);
    expect(validateAttendance({ student_id: STUDENT, status: "present", remarks: "x".repeat(501) }))
      .toEqual({ ok: false, errors: { remarks: AM.remarksTooLong } });
  });

  it("rejects unknown statuses, non-text remarks and bad student ids with field errors", () => {
    expect(validateAttendance({ student_id: "nope", status: "excused", remarks: 42 })).toEqual({
      ok: false, errors: { student_id: AM.studentInvalid, status: AM.statusInvalid, remarks: AM.remarksInvalid },
    });
    expect(validateAttendance(null).ok).toBe(false);
  });
});

describe("attendance helpers", () => {
  it("defaults to Present with no remarks when no row is stored (AC-5.1)", () => {
    expect(attendanceOf([], STUDENT)).toEqual({ student_id: STUDENT, status: "present", remarks: null });
    const late = { student_id: STUDENT, status: "late" as const, remarks: null };
    expect(attendanceOf([late], STUDENT)).toBe(late);
  });

  it("toggles: one click sets Late/Absent, clicking the active state again returns to Present (AC-5.2)", () => {
    expect(toggledStatus("present", "absent")).toBe("absent");
    expect(toggledStatus("absent", "absent")).toBe("present");
    expect(toggledStatus("late", "absent")).toBe("absent");
    expect(toggledStatus("late", "late")).toBe("present");
  });
});

describe("absence notifications (AC-5.3, AC-7.1)", () => {
  const session = { name: "Year 7 · A", date: "2026-11-24", start_time: "18:00" };
  const ana = { id: "a", full_name: "Ana Silva", phone: "+351911111111", guardian_name: "Rita Silva", guardian_phone: "+351922222222" };
  const rui = { id: "r", full_name: "Rui Costa", phone: "+351933333333", guardian_name: null, guardian_phone: null };

  it("notifies the student and the guardian separately", () => {
    const notes = buildAbsenceNotifications(session, ana);
    expect(notes.map((n) => [n.student_id, n.recipient, n.phone])).toEqual([
      ["a", "student", "+351911111111"], ["a", "guardian", "+351922222222"],
    ]);
    expect(notes[1].message).toBe(
      "Hello Rita Silva, this is Margarida Freitas from IIMF. Ana Silva was absent from today's Year 7 · A class (Tuesday, 24 November 2026, 18:00). Please let me know if you need anything. Thank you!",
    );
    expect(notes[0].message).toMatch(/^Hello Ana Silva, .* Ana Silva was absent/);
    for (const n of notes) expect(n.message).not.toMatch(/\{\w+\}/);
  });

  it("only notifies the student when there is no guardian", () => {
    expect(buildAbsenceNotifications(session, rui).map((n) => n.recipient)).toEqual(["student"]);
  });
});
