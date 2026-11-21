import { describe, expect, it } from "vitest";
import { applyEdit, parseEditOp, SM, type StoredGroup } from "@/lib/schedule";
import { cambridge, individual } from "../scheduling/fixtures";

// AC-3.9: hard violations block a manual edit; soft ones only warn.
const G1 = "11111111-1111-4111-8111-111111111111";
const G2 = "22222222-2222-4222-8222-222222222222";
const G3 = "33333333-3333-4333-8333-333333333333";
const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;

const MON = ["Mon 08:00-20:00", "Tue 08:00-20:00"];
const b2 = Array.from({ length: 11 }, (_, i) => cambridge(id(i + 1), "B2", { slots: MON, name: `B2 ${i + 1}` }));
const c1 = cambridge(id(50), "C1", { slots: MON, name: "C1 student" });
const solo = individual(id(60), { slots: MON, name: "Solo" });
const students = [...b2, c1, solo];

const group = (gid: string, name: string, members: string[], weekday = 1, start_time = "09:00"): StoredGroup => ({
  id: gid, name, goal: "cambridge", cefr_level: "B2", school_year: null, weekday, start_time, duration_min: 90, member_ids: members,
});
const base = (): StoredGroup[] => [
  group(G1, "Cambridge B2 · A", b2.slice(0, 7).map((s) => s.id)),
  group(G2, "Cambridge B2 · B", b2.slice(7, 10).map((s) => s.id), 1, "10:30"),
  { id: G3, name: "Solo", goal: "individual", cefr_level: null, school_year: null, weekday: 2, start_time: "09:00", duration_min: 60, member_ids: [solo.id] },
];

const ok = (r: ReturnType<typeof applyEdit>) => {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r;
};

describe("applyEdit — blocked (hard)", () => {
  it("blocks an 8th member (H3)", () => {
    const r = applyEdit(base(), students, { type: "assign", student_id: b2[10].id, group_id: G1 });
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.issues?.map((i) => i.code)).toEqual(["H3"]);
  });

  it("blocks a time change that overlaps another class (H2)", () => {
    const r = applyEdit(base(), students, { type: "reschedule", group_id: G2, weekday: 1, start_time: "10:00" });
    expect(r).toMatchObject({ ok: false, status: 400, error: SM.blocked("Cambridge B2 · A overlaps with Cambridge B2 · B.") });
  });

  it("blocks a class that would end after 20:00 (H1)", () => {
    const r = applyEdit(base(), students, { type: "reschedule", group_id: G2, weekday: 3, start_time: "19:00" });
    expect(r.ok).toBe(false);
  });

  it("blocks a student with another level (H4) and a 2nd student in an individual class (H3)", () => {
    expect(applyEdit(base(), students, { type: "assign", student_id: c1.id, group_id: G1 }).ok).toBe(false);
    expect(applyEdit(base(), students, { type: "assign", student_id: b2[10].id, group_id: G3 }).ok).toBe(false);
  });
});

describe("applyEdit — saved with warnings (soft)", () => {
  it("leaving a group with 2 members warns (S1) and is saved", () => {
    const r = ok(applyEdit(base(), students, { type: "remove", student_id: b2[7].id }));
    expect(r.groups.find((g) => g.id === G2)?.member_ids).toHaveLength(2);
    expect(r.warnings.map((w) => w.code)).toEqual(["S1"]);
  });

  it("a time outside a member's availability warns (S2) and a weekend warns (S3)", () => {
    const r = ok(applyEdit(base(), students, { type: "reschedule", group_id: G2, weekday: 6, start_time: "10:00" }));
    expect(r.groups.find((g) => g.id === G2)).toMatchObject({ weekday: 6, start_time: "10:00" });
    expect(new Set(r.warnings.map((w) => w.code))).toEqual(new Set(["S2", "S3"]));
  });
});

describe("applyEdit — moves and removals", () => {
  it("moves a student between compatible groups", () => {
    const r = ok(applyEdit(base(), students, { type: "assign", student_id: b2[0].id, group_id: G2 }));
    expect(r.groups.find((g) => g.id === G1)?.member_ids).toHaveLength(6);
    expect(r.groups.find((g) => g.id === G2)?.member_ids).toContain(b2[0].id);
  });

  it("assigns an unallocated student", () => {
    const r = ok(applyEdit(base(), students, { type: "assign", student_id: b2[10].id, group_id: G2 }));
    expect(r.groups.find((g) => g.id === G2)?.member_ids).toHaveLength(4);
  });

  it("removing the only member deletes the class", () => {
    const r = ok(applyEdit(base(), students, { type: "remove", student_id: solo.id }));
    expect(r.groups.map((g) => g.id)).toEqual([G1, G2]);
  });

  it("rejects unknown classes/students and no-op moves", () => {
    const unknown = "99999999-9999-4999-8999-999999999999";
    expect(applyEdit(base(), students, { type: "assign", student_id: b2[0].id, group_id: unknown })).toMatchObject({ status: 404, error: SM.groupNotFound });
    expect(applyEdit(base(), students, { type: "remove", student_id: unknown })).toMatchObject({ status: 404 });
    expect(applyEdit(base(), students, { type: "remove", student_id: b2[10].id })).toMatchObject({ status: 400, error: SM.notInGroup });
    expect(applyEdit(base(), students, { type: "assign", student_id: b2[0].id, group_id: G1 })).toMatchObject({ error: SM.alreadyInGroup });
  });

  it("existing hard issues (a deactivated member) don't block unrelated edits, and removing them works", () => {
    const withInactive = students.map((s) => (s.id === b2[0].id ? { ...s, is_active: false } : s));
    expect(applyEdit(base(), withInactive, { type: "assign", student_id: b2[10].id, group_id: G2 }).ok).toBe(true);
    expect(applyEdit(base(), withInactive, { type: "remove", student_id: b2[0].id }).ok).toBe(true);
    expect(applyEdit(base(), withInactive, { type: "assign", student_id: b2[0].id, group_id: G2 })).toMatchObject({ error: SM.studentInactive });
  });
});

describe("parseEditOp", () => {
  it("accepts the three operations and normalises the time", () => {
    expect(parseEditOp({ type: "reschedule", group_id: G1, weekday: 2, start_time: "18:00:00" }))
      .toEqual({ type: "reschedule", group_id: G1, weekday: 2, start_time: "18:00" });
    expect(parseEditOp({ type: "remove", student_id: id(1) })).toEqual({ type: "remove", student_id: id(1) });
  });

  it.each([null, "x", {}, { type: "assign", student_id: "nope", group_id: G1 }, { type: "reschedule", group_id: G1, weekday: 1.5, start_time: "09:00" },
    { type: "reschedule", group_id: G1, weekday: 1, start_time: "9am" }, { type: "drop", student_id: id(1) }])("rejects %j", (body) => {
    expect(parseEditOp(body)).toBeNull();
  });
});
