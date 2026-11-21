import { describe, expect, it } from "vitest";
import { buildSeedStudents } from "@/lib/seed/build";
import { runSeed, SeedRefusedError, type AvailabilityRow, type SeedStore, type StudentRow } from "@/lib/seed/writer";

const students = buildSeedStudents();

/** In-memory SeedStore that records calls. */
function fakeStore(init: { approved?: boolean; existing?: number; failAvailability?: boolean } = {}) {
  const state = {
    approved: init.approved ?? false,
    students: Array.from({ length: init.existing ?? 0 }, (_, i) => ({ id: `old-${i}` }) as StudentRow),
    slots: [] as AvailabilityRow[],
    draftCleared: false,
  };
  const store: SeedStore = {
    hasApprovedSchedule: async () => state.approved,
    countStudents: async () => state.students.length,
    clearStudentsAndDrafts: async () => {
      state.draftCleared = true;
      state.students = [];
      state.slots = [];
    },
    insertStudents: async (rows) => void state.students.push(...rows),
    insertAvailability: async (rows) => {
      if (init.failAvailability) throw new Error("Inserting availability failed: boom");
      state.slots.push(...rows);
    },
    deleteStudents: async (ids) => {
      state.students = state.students.filter((s) => !ids.includes(s.id));
    },
  };
  return { store, state };
}

describe("runSeed", () => {
  it("seeds an empty database with every student and their availability", async () => {
    const { store, state } = fakeStore();
    const summary = await runSeed(store, students);
    expect(summary).toEqual({ students: 40, availabilitySlots: state.slots.length, replaced: 0 });
    expect(state.students).toHaveLength(40);
    expect(state.slots.length).toBe(students.reduce((n, s) => n + s.availability.length, 0));
    const ids = new Set(state.students.map((s) => s.id));
    expect(state.slots.every((slot) => ids.has(slot.student_id))).toBe(true);
    expect(state.students[0]).not.toHaveProperty("availability");
  });

  it("refuses after a schedule is approved, even with --reset (A5)", async () => {
    const { store, state } = fakeStore({ approved: true, existing: 3 });
    await expect(runSeed(store, students, { reset: true })).rejects.toThrow(SeedRefusedError);
    expect(state.students).toHaveLength(3);
    expect(state.draftCleared).toBe(false);
  });

  it("refuses to add on top of existing students without --reset", async () => {
    const { store, state } = fakeStore({ existing: 5 });
    await expect(runSeed(store, students)).rejects.toThrow(/already has 5 student\(s\).*--reset/);
    expect(state.students).toHaveLength(5);
  });

  it("with --reset, replaces existing students and clears the draft schedule", async () => {
    const { store, state } = fakeStore({ existing: 5 });
    const summary = await runSeed(store, students, { reset: true });
    expect(summary.replaced).toBe(5);
    expect(state.draftCleared).toBe(true);
    expect(state.students).toHaveLength(40);
    expect(state.students.some((s) => s.id.startsWith("old-"))).toBe(false);
  });

  it("deletes the inserted students again if the availability insert fails", async () => {
    const { store, state } = fakeStore({ failAvailability: true });
    await expect(runSeed(store, students)).rejects.toThrow(/boom/);
    expect(state.students).toHaveLength(0);
  });
});
