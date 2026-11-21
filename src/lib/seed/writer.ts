import type { StudentInput } from "@/lib/students/types";

export type StudentRow = Omit<StudentInput, "availability"> & { id: string };
export type AvailabilityRow = { student_id: string; weekday: number; start_time: string; end_time: string };

/** The database operations the seed needs. Implemented with Supabase in supabase-store.ts. */
export interface SeedStore {
  hasApprovedSchedule(): Promise<boolean>;
  countStudents(): Promise<number>;
  /** --reset: deletes draft schedules (cascades to groups/members), then all students (cascades to availability). */
  clearStudentsAndDrafts(): Promise<void>;
  insertStudents(rows: StudentRow[]): Promise<void>;
  insertAvailability(rows: AvailabilityRow[]): Promise<void>;
  deleteStudents(ids: string[]): Promise<void>;
}

export class SeedRefusedError extends Error {}

export type SeedSummary = { students: number; availabilitySlots: number; replaced: number };

/**
 * Writes the fake students (SPEC A8). Rules:
 * - Never runs after approval: the data is frozen for the term (A5, AC-2.7).
 * - Refuses to add on top of existing students unless reset = true.
 * - Supabase has no client-side transactions, so if the availability insert fails
 *   the students just inserted are deleted again (all-or-nothing).
 */
export async function runSeed(
  store: SeedStore,
  students: StudentInput[],
  { reset = false, newId = () => crypto.randomUUID() }: { reset?: boolean; newId?: () => string } = {},
): Promise<SeedSummary> {
  if (await store.hasApprovedSchedule()) {
    throw new SeedRefusedError("A schedule has already been approved, so student data is frozen for the term. Seeding is not allowed.");
  }

  const existing = await store.countStudents();
  if (existing > 0 && !reset) {
    throw new SeedRefusedError(
      `The database already has ${existing} student(s). Run "npm run seed -- --reset" to delete them (and any draft schedule) and seed again.`,
    );
  }
  if (existing > 0 || reset) await store.clearStudentsAndDrafts();

  const studentRows: StudentRow[] = [];
  const slotRows: AvailabilityRow[] = [];
  for (const { availability, ...student } of students) {
    const id = newId();
    studentRows.push({ id, ...student });
    for (const b of availability) slotRows.push({ student_id: id, ...b });
  }

  await store.insertStudents(studentRows);
  try {
    await store.insertAvailability(slotRows);
  } catch (e) {
    await store.deleteStudents(studentRows.map((s) => s.id));
    throw e;
  }

  return { students: studentRows.length, availabilitySlots: slotRows.length, replaced: existing };
}
