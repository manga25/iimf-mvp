import { describe, expect, it } from "vitest";
import { validateStudent } from "@/lib/students/validation";
import { normalisePhone } from "@/lib/students/phone";
import { M } from "@/lib/students/messages";

const base = {
  full_name: "  Ana Silva ",
  phone: "912345678",
  goal: "cambridge",
  cefr_level: "B2",
  school_year: null,
  guardian_name: "",
  guardian_phone: "",
  availability: [{ weekday: 1, start_time: "09:00", end_time: "10:30" }],
};
const errorsOf = (over: Record<string, unknown>) => {
  const r = validateStudent({ ...base, ...over });
  return r.ok ? {} : r.errors;
};

describe("validateStudent — happy path", () => {
  it("accepts a valid Cambridge B2 student and normalises the data", () => {
    const r = validateStudent(base);
    expect(r).toEqual({
      ok: true,
      data: {
        full_name: "Ana Silva", phone: "+351912345678", goal: "cambridge", cefr_level: "B2", school_year: null,
        guardian_name: null, guardian_phone: null,
        availability: [{ weekday: 1, start_time: "09:00", end_time: "10:30" }],
      },
    });
  });

  it("accepts School Support with a year given as a string, and Individual with neither", () => {
    const ss = validateStudent({ ...base, goal: "school_support", cefr_level: "", school_year: "7" });
    expect(ss.ok && ss.data).toMatchObject({ school_year: 7, cefr_level: null });
    const ind = validateStudent({ ...base, goal: "individual", cefr_level: null });
    expect(ind.ok && ind.data).toMatchObject({ cefr_level: null, school_year: null });
  });

  it("accepts an empty availability (generation is blocked later, not here)", () => {
    expect(validateStudent({ ...base, availability: [] }).ok).toBe(true);
  });
});

describe("AC-2.2 goal-specific fields", () => {
  it("rejects a Cambridge student without a CEFR level", () => {
    expect(errorsOf({ cefr_level: "" })).toEqual({ cefr_level: M.levelRequired });
    expect(errorsOf({ cefr_level: "D1" })).toEqual({ cefr_level: M.levelInvalid });
  });

  it("rejects a School Support student without a year or with year 13", () => {
    expect(errorsOf({ goal: "school_support", cefr_level: null })).toEqual({ school_year: M.yearRequired });
    expect(errorsOf({ goal: "school_support", cefr_level: null, school_year: 13 })).toEqual({ school_year: M.yearInvalid });
    expect(errorsOf({ goal: "school_support", cefr_level: null, school_year: 0 })).toEqual({ school_year: M.yearInvalid });
    expect(errorsOf({ goal: "school_support", cefr_level: null, school_year: 7.5 })).toEqual({ school_year: M.yearInvalid });
  });

  it("rejects an Individual student with a level (or a year)", () => {
    expect(errorsOf({ goal: "individual" })).toEqual({ cefr_level: M.levelNotAllowed });
    expect(errorsOf({ goal: "individual", cefr_level: null, school_year: 5 })).toEqual({ school_year: M.yearNotAllowed });
  });

  it("rejects a missing or unknown goal, and a missing or too short name", () => {
    expect(errorsOf({ goal: "", cefr_level: null })).toEqual({ goal: M.goalRequired });
    expect(errorsOf({ goal: "music", cefr_level: null })).toEqual({ goal: M.goalRequired });
    expect(errorsOf({ full_name: "   " })).toEqual({ full_name: M.nameRequired });
    expect(errorsOf({ full_name: "A" })).toEqual({ full_name: M.nameLength });
    expect(errorsOf({ full_name: "x".repeat(101) })).toEqual({ full_name: M.nameLength });
  });

  it("returns an error for every bad field at once", () => {
    expect(validateStudent({})).toEqual({
      ok: false,
      errors: { full_name: M.nameRequired, phone: M.phoneRequired, goal: M.goalRequired },
    });
  });
});

describe("AC-2.3 guardian both-or-none", () => {
  it("rejects a guardian name without a phone, and vice versa", () => {
    expect(errorsOf({ guardian_name: "Maria Silva" })).toEqual({ guardian_phone: M.guardianPhoneMissing });
    expect(errorsOf({ guardian_phone: "934567890" })).toEqual({ guardian_name: M.guardianNameMissing });
  });

  it("accepts both and normalises the guardian phone", () => {
    const r = validateStudent({ ...base, guardian_name: " Maria Silva ", guardian_phone: "934 567 890" });
    expect(r.ok && r.data).toMatchObject({ guardian_name: "Maria Silva", guardian_phone: "+351934567890" });
  });

  it("rejects an invalid guardian phone", () => {
    expect(errorsOf({ guardian_name: "Maria Silva", guardian_phone: "12345" })).toEqual({ guardian_phone: M.phoneInvalid });
  });
});

describe("AC-2.4 phone normalisation", () => {
  it("stores 912345678 as +351912345678", () => {
    expect(normalisePhone("912345678")).toEqual({ ok: true, value: "+351912345678" });
    expect(normalisePhone(" 912 345-678 ")).toEqual({ ok: true, value: "+351912345678" });
  });

  it("rejects 12345", () => {
    expect(normalisePhone("12345")).toEqual({ ok: false, error: M.phoneInvalid });
    expect(errorsOf({ phone: "12345" })).toEqual({ phone: M.phoneInvalid });
  });

  it("accepts +447911123456", () => {
    expect(normalisePhone("+447911123456")).toEqual({ ok: true, value: "+447911123456" });
  });

  it("enforces E.164 for international numbers", () => {
    expect(normalisePhone("+1234567")).toMatchObject({ ok: false }); // 7 digits
    expect(normalisePhone("+12345678")).toEqual({ ok: true, value: "+12345678" }); // 8 digits
    expect(normalisePhone("+1234567890123456")).toMatchObject({ ok: false }); // 16 digits
    expect(normalisePhone("+0123456789")).toMatchObject({ ok: false }); // leading 0
    expect(normalisePhone("0044791112345")).toMatchObject({ ok: false }); // needs an explicit +
    expect(normalisePhone("")).toEqual({ ok: false, error: M.phoneRequired });
    expect(normalisePhone(912345678)).toEqual({ ok: false, error: M.phoneRequired });
  });
});
