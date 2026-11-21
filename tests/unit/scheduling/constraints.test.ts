import { describe, expect, it } from "vitest";
import { checkSchedule, type DraftGroup } from "@/lib/scheduling";
import { cambridge, individual, levelCohort, schoolSupport } from "./fixtures";

const b1 = levelCohort(8, "B1", ["Mon 10:00-13:00"]);
const ind = individual("ind", { slots: ["Tue 10:00-11:00"], name: "Ana Silva" });
const students = [...b1, ind, cambridge("b2", "B2", { slots: ["Mon 10:00-13:00"] }), schoolSupport("y7", 7, { slots: [] })];

const group = (over: Partial<DraftGroup> = {}): DraftGroup => ({
  name: "Cambridge B1 · A", goal: "cambridge", cefr_level: "B1", school_year: null,
  weekday: 1, start_time: "10:00", duration_min: 90, member_ids: b1.slice(0, 3).map((s) => s.id), ...over,
});
const solo = (over: Partial<DraftGroup> = {}): DraftGroup => ({
  name: "Individual · Ana Silva", goal: "individual", cefr_level: null, school_year: null,
  weekday: 2, start_time: "10:00", duration_min: 60, member_ids: ["ind"], ...over,
});

const codes = (groups: DraftGroup[]) => {
  const r = checkSchedule(groups, students);
  return { hard: r.hard.map((i) => i.code), soft: r.soft.map((i) => i.code) };
};

describe("checkSchedule", () => {
  it("accepts a valid schedule", () => {
    expect(codes([group(), solo()])).toEqual({ hard: [], soft: [] });
  });

  it("H1: outside 08:00–20:00 or off the 30-min grid", () => {
    expect(codes([group({ start_time: "07:30" })]).hard).toContain("H1");
    expect(codes([group({ start_time: "19:00" })]).hard).toContain("H1"); // ends 20:30
    expect(codes([group({ start_time: "10:15" })]).hard).toContain("H1");
    expect(codes([group({ weekday: 8 })]).hard).toContain("H1");
    expect(codes([group({ start_time: "18:30" })]).hard).not.toContain("H1"); // ends exactly 20:00
  });

  it("H2: overlapping classes; back-to-back is fine", () => {
    expect(codes([group(), solo({ weekday: 1, start_time: "11:00" })]).hard).toContain("H2");
    expect(codes([group(), solo({ weekday: 1, start_time: "11:30" })]).hard).not.toContain("H2");
  });

  it("H3: more than 7 members, or an individual class without exactly 1", () => {
    expect(codes([group({ member_ids: b1.map((s) => s.id) })]).hard).toContain("H3");
    expect(codes([group({ member_ids: b1.slice(0, 7).map((s) => s.id) })]).hard).not.toContain("H3");
    expect(codes([solo({ member_ids: [] })]).hard).toContain("H3");
  });

  it("H4: wrong goal, level or year", () => {
    expect(codes([group({ member_ids: [...group().member_ids, "b2"] })]).hard).toContain("H4");
    expect(codes([group({ member_ids: [...group().member_ids, "ind"] })]).hard).toContain("H4");
    expect(codes([group({ member_ids: ["y7"], goal: "school_support", cefr_level: null, school_year: 8, name: "Year 8 · A" })]).hard).toContain("H4");
    expect(codes([group({ member_ids: [...group().member_ids, "ghost"] })]).hard).toContain("H4");
  });

  it("H5: wrong duration", () => {
    expect(codes([group({ duration_min: 60 })]).hard).toContain("H5");
    expect(codes([solo({ duration_min: 90 })]).hard).toContain("H5");
  });

  it("H6: a student in two classes", () => {
    const second = group({ name: "Cambridge B1 · B", weekday: 3, member_ids: [b1[0].id, b1[3].id, b1[4].id] });
    expect(codes([group(), second]).hard).toContain("H6");
  });

  it("S1: group below 3 is a warning only", () => {
    const r = codes([group({ member_ids: b1.slice(0, 2).map((s) => s.id) })]);
    expect(r.soft).toEqual(["S1"]);
    expect(r.hard).toEqual([]);
  });

  it("S2: member not available for the whole class is a warning only", () => {
    const r = codes([group({ start_time: "12:00" })]); // 12:00–13:30, available until 13:00
    expect(r.soft).toEqual(["S2", "S2", "S2"]);
    expect(r.hard).toEqual([]);
  });

  it("S3: weekend class is a warning only", () => {
    expect(codes([solo({ weekday: 6 })]).soft).toContain("S3");
  });

  it("messages name the groups involved", () => {
    const r = checkSchedule([group(), solo({ weekday: 1, start_time: "11:00" })], students);
    expect(r.hard[0].message).toBe("Cambridge B1 · A overlaps with Individual · Ana Silva.");
  });
});
