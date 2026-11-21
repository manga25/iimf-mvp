import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Runs supabase/migrations/0001_init.sql on an in-memory Postgres (PGlite)
// and checks the constraints from SPEC §4 and the RLS rule from §4 "Security".
const MIGRATION = readFileSync("supabase/migrations/0001_init.sql", "utf8");
const TABLES = [
  "students", "availability_slots", "schedules", "class_groups", "group_members",
  "blocked_periods", "sessions", "attendance", "payments", "notifications",
];

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  // Roles that exist by default in Supabase.
  await db.exec("create role anon; create role authenticated;");
  await db.exec(MIGRATION);
}, 30_000);

const student = (over: Record<string, unknown> = {}) => ({
  full_name: "Ana Silva", phone: "+351912345678", goal: "cambridge",
  cefr_level: "B2", school_year: null, guardian_name: null, guardian_phone: null, ...over,
});

async function insertStudent(over: Record<string, unknown> = {}) {
  const s = student(over);
  const { rows } = await db.query<{ id: string }>(
    `insert into students (full_name, phone, goal, cefr_level, school_year, guardian_name, guardian_phone)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [s.full_name, s.phone, s.goal, s.cefr_level, s.school_year, s.guardian_name, s.guardian_phone],
  );
  return rows[0].id;
}

describe("migration 0001_init", () => {
  it("creates all tables with RLS enabled and an authenticated-only policy", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
    );
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);

    const { rows: policies } = await db.query<{ tablename: string; roles: string }>(
      `select tablename, roles::text from pg_policies where schemaname = 'public'`,
    );
    expect(policies.map((p) => p.tablename).sort()).toEqual([...TABLES].sort());
    expect(policies.every((p) => p.roles === "{authenticated}")).toBe(true);
  });

  it("gives the anon role no table privileges", async () => {
    const { rows } = await db.query(
      `select 1 from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("students constraints", () => {
  it("accepts valid students for each goal", async () => {
    await expect(insertStudent()).resolves.toBeTruthy();
    await expect(insertStudent({ goal: "school_support", cefr_level: null, school_year: 7,
      guardian_name: "Rui Silva", guardian_phone: "+351934567890" })).resolves.toBeTruthy();
    await expect(insertStudent({ goal: "individual", cefr_level: null })).resolves.toBeTruthy();
  });

  it.each([
    ["cambridge without level", { cefr_level: null }],
    ["school_support without year", { goal: "school_support", cefr_level: null }],
    ["school_support with year 13", { goal: "school_support", cefr_level: null, school_year: 13 }],
    ["individual with level", { goal: "individual" }],
    ["guardian name without phone", { guardian_name: "Rui Silva" }],
    ["non-E.164 phone", { phone: "912345678" }],
    ["untrimmed name", { full_name: " Ana " }],
    ["one-char name", { full_name: "A" }],
  ])("rejects %s", async (_label, over) => {
    await expect(insertStudent(over)).rejects.toThrow(/check constraint/);
  });
});

describe("availability_slots constraints", () => {
  const insertSlot = async (weekday: number, start: string, end: string) =>
    db.query(
      `insert into availability_slots (student_id, weekday, start_time, end_time) values ($1, $2, $3, $4)`,
      [await insertStudent(), weekday, start, end],
    );

  it("accepts a slot on the 30-min grid inside 08:00–20:00", async () => {
    await expect(insertSlot(1, "08:00", "20:00")).resolves.toBeTruthy();
  });

  it.each([
    ["before 08:00", 1, "07:30", "09:00"],
    ["after 20:00", 1, "19:00", "20:30"],
    ["misaligned", 1, "08:15", "09:00"],
    ["start >= end", 1, "10:00", "10:00"],
    ["weekday 8", 8, "10:00", "11:00"],
  ])("rejects %s", async (_label, wd, s, e) => {
    await expect(insertSlot(wd as number, s as string, e as string)).rejects.toThrow(/check constraint/);
  });
});

describe("schedules and class_groups constraints", () => {
  it("allows at most one draft schedule", async () => {
    await db.query(`insert into schedules (status) values ('draft')`);
    await expect(db.query(`insert into schedules (status) values ('draft')`)).rejects.toThrow(/unique/);
  });

  it("requires term dates when approved", async () => {
    await expect(db.query(`insert into schedules (status) values ('approved')`)).rejects.toThrow(/check constraint/);
  });

  it("enforces durations (H5) and the 08:00–20:00 window (H1)", async () => {
    const { rows } = await db.query<{ id: string }>(`select id from schedules where status = 'draft'`);
    const insertGroup = (goal: string, level: string | null, start: string, dur: number) =>
      db.query(
        `insert into class_groups (schedule_id, name, goal, cefr_level, weekday, start_time, duration_min)
         values ($1, 'G', $2, $3, 2, $4, $5)`,
        [rows[0].id, goal, level, start, dur],
      );
    await expect(insertGroup("cambridge", "B1", "18:30", 90)).resolves.toBeTruthy();
    await expect(insertGroup("individual", null, "19:00", 60)).resolves.toBeTruthy();
    await expect(insertGroup("cambridge", "B1", "19:00", 90)).rejects.toThrow(/check constraint/);
    await expect(insertGroup("cambridge", "B1", "10:00", 60)).rejects.toThrow(/check constraint/);
    await expect(insertGroup("individual", null, "10:00", 90)).rejects.toThrow(/check constraint/);
  });
});

describe("payments and notifications constraints", () => {
  it("enforces first-of-month, uniqueness and paid_at consistency", async () => {
    const id = await insertStudent();
    const pay = (month: string, status = "unpaid", paidAt: string | null = null) =>
      db.query(
        `insert into payments (student_id, month, hours, amount, status, paid_at)
         values ($1, $2, 6.0, 60.00, $3, $4) returning id`,
        [id, month, status, paidAt],
      );
    const { rows } = await pay("2026-10-01");
    await expect(pay("2026-10-01")).rejects.toThrow(/unique/);
    await expect(pay("2026-11-15")).rejects.toThrow(/check constraint/);
    await expect(pay("2026-12-01", "paid")).rejects.toThrow(/check constraint/);

    const overdue = () =>
      db.query(
        `insert into notifications (student_id, type, recipient, phone, message, payment_id)
         values ($1, 'overdue', 'student', '+351912345678', 'Reminder', $2)`,
        [id, (rows[0] as { id: string }).id],
      );
    await expect(overdue()).resolves.toBeTruthy();
    await expect(overdue()).rejects.toThrow(/unique/);
  });
});
