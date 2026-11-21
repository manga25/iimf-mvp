import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSeedStudents } from "@/lib/seed/build";
import { runSeed, type SeedStore } from "@/lib/seed/writer";

// Runs the seed against the real schema (0001 + 0002) on in-memory Postgres,
// so the table CHECKs (phone, goal/level/year, guardian, 30-min grid) are exercised too.
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/0002_student_rpc.sql", "utf8"));
}, 30_000);

const pgStore: () => SeedStore = () => ({
  hasApprovedSchedule: async () => (await db.query("select 1 from schedules where status = 'approved'")).rows.length > 0,
  countStudents: async () => (await db.query<{ n: number }>("select count(*)::int as n from students")).rows[0].n,
  clearStudentsAndDrafts: async () => {
    await db.exec("delete from schedules where status = 'draft'; delete from students;");
  },
  insertStudents: async (rows) => {
    await db.query(
      `insert into students (id, full_name, phone, goal, cefr_level, school_year, guardian_name, guardian_phone)
       select * from jsonb_to_recordset($1::jsonb) as r(id uuid, full_name text, phone text, goal goal,
         cefr_level cefr_level, school_year smallint, guardian_name text, guardian_phone text)`,
      [JSON.stringify(rows)],
    );
  },
  insertAvailability: async (rows) => {
    await db.query(
      `insert into availability_slots (student_id, weekday, start_time, end_time)
       select * from jsonb_to_recordset($1::jsonb) as r(student_id uuid, weekday smallint, start_time time, end_time time)`,
      [JSON.stringify(rows)],
    );
  },
  deleteStudents: async (ids) => {
    await db.query("delete from students where id = any($1::uuid[])", [ids]);
  },
});

describe("seed against the real schema", () => {
  it("inserts all 40 students and their availability without violating any constraint", async () => {
    const students = buildSeedStudents();
    const summary = await runSeed(pgStore(), students);
    const { rows } = await db.query<{ students: number; slots: number; active: number }>(
      `select (select count(*)::int from students) as students,
              (select count(*)::int from availability_slots) as slots,
              (select count(*)::int from students where is_active) as active`,
    );
    expect(rows[0]).toEqual({ students: 40, slots: summary.availabilitySlots, active: 40 });
  });

  it("can be re-run with --reset, also removing a draft schedule", async () => {
    await db.exec("insert into schedules (status, generated_at) values ('draft', now())");
    const summary = await runSeed(pgStore(), buildSeedStudents(), { reset: true });
    expect(summary.replaced).toBe(40);
    const { rows } = await db.query<{ students: number; drafts: number }>(
      "select (select count(*)::int from students) as students, (select count(*)::int from schedules) as drafts",
    );
    expect(rows[0]).toEqual({ students: 40, drafts: 0 });
  });
});
