import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs 0001 + 0002 on an in-memory Postgres and checks the student write functions.
const M1 = readFileSync("supabase/migrations/0001_init.sql", "utf8");
const M2 = readFileSync("supabase/migrations/0002_student_rpc.sql", "utf8");
const SAVE_SIG = "public.save_student(uuid, text, text, public.goal, public.cefr_level, smallint, text, text, jsonb)";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  await db.exec(M1);
  await db.exec(M2);
  await db.exec(M2); // re-running must be safe (the teacher may paste it twice)
}, 30_000);

beforeEach(async () => {
  await db.exec("delete from schedules; delete from availability_slots; delete from students;");
});

const availability = (blocks: [number, string, string][]) =>
  JSON.stringify(blocks.map(([weekday, start_time, end_time]) => ({ weekday, start_time, end_time })));

async function save(id: string | null, over: Partial<Record<string, unknown>> = {}, blocks: [number, string, string][] = []) {
  const v = { name: "Ana Silva", phone: "+351912345678", goal: "cambridge", level: "B2", year: null, ...over };
  const { rows } = await db.query<{ id: string }>(
    `select public.save_student($1, $2, $3, $4::public.goal, $5::public.cefr_level, $6::smallint, null, null, $7::jsonb) as id`,
    [id, v.name, v.phone, v.goal, v.level, v.year, availability(blocks)],
  );
  return rows[0].id;
}

const slotsOf = async (id: string) =>
  (await db.query<{ weekday: number; start_time: string; end_time: string }>(
    "select weekday, start_time, end_time from availability_slots where student_id = $1 order by weekday, start_time",
    [id],
  )).rows;

const errorCode = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code);

describe("save_student", () => {
  it("creates a student with their availability in one call", async () => {
    const id = await save(null, {}, [[1, "09:00", "10:30"], [3, "14:00", "15:00"]]);
    const { rows } = await db.query<{ full_name: string; is_active: boolean }>("select * from students where id = $1", [id]);
    expect(rows[0]).toMatchObject({ full_name: "Ana Silva", is_active: true });
    expect(await slotsOf(id)).toEqual([
      { weekday: 1, start_time: "09:00:00", end_time: "10:30:00" },
      { weekday: 3, start_time: "14:00:00", end_time: "15:00:00" },
    ]);
  });

  it("updates the student and replaces their availability", async () => {
    const id = await save(null, {}, [[1, "09:00", "10:30"]]);
    await save(id, { name: "Ana Sousa", goal: "school_support", level: null, year: 7 }, [[2, "18:00", "19:30"]]);
    const { rows } = await db.query<{ full_name: string; cefr_level: string | null; school_year: number }>(
      "select full_name, cefr_level, school_year from students where id = $1", [id],
    );
    expect(rows[0]).toEqual({ full_name: "Ana Sousa", cefr_level: null, school_year: 7 });
    expect(await slotsOf(id)).toEqual([{ weekday: 2, start_time: "18:00:00", end_time: "19:30:00" }]);
  });

  it("raises IM404 when updating an unknown student", async () => {
    expect(await errorCode(save("00000000-0000-0000-0000-000000000000"))).toBe("IM404");
  });

  it("rolls back the student when an availability block is invalid", async () => {
    expect(await errorCode(save(null, {}, [[1, "07:00", "09:00"]]))).toBe("23514");
    expect((await db.query("select 1 from students")).rows).toHaveLength(0);
  });

  it("raises IM409 and writes nothing once a schedule is approved (AC-2.7)", async () => {
    const id = await save(null);
    await db.exec(`insert into schedules (status, term_start, term_end, approved_at)
                   values ('approved', '2026-09-01', '2027-07-31', now())`);
    expect(await errorCode(save(null, { name: "Rui Costa" }))).toBe("IM409");
    expect(await errorCode(save(id, { name: "Changed" }))).toBe("IM409");
    const { rows } = await db.query<{ full_name: string }>("select full_name from students");
    expect(rows).toEqual([{ full_name: "Ana Silva" }]);
  });

  it("still allows writes while the schedule is only a draft", async () => {
    await db.exec("insert into schedules (status) values ('draft')");
    expect(await save(null)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("deactivate_student", () => {
  it("soft-deletes the student", async () => {
    const id = await save(null);
    await db.query("select public.deactivate_student($1)", [id]);
    const { rows } = await db.query<{ is_active: boolean }>("select is_active from students where id = $1", [id]);
    expect(rows[0].is_active).toBe(false);
  });

  it("raises IM404 for an unknown student and IM409 after approval", async () => {
    expect(await errorCode(db.query("select public.deactivate_student('00000000-0000-0000-0000-000000000000')"))).toBe("IM404");
    const id = await save(null);
    await db.exec(`insert into schedules (status, term_start, term_end, approved_at)
                   values ('approved', '2026-09-01', '2027-07-31', now())`);
    expect(await errorCode(db.query("select public.deactivate_student($1)", [id]))).toBe("IM409");
  });
});

describe("privileges", () => {
  it("grants table privileges to authenticated (RLS still filters) and none to anon", async () => {
    const { rows } = await db.query<{ table_name: string; auth: boolean; anon: boolean }>(
      `select c.relname as table_name,
              has_table_privilege('authenticated', c.oid, 'select, insert, update, delete') as auth,
              has_table_privilege('anon', c.oid, 'select') as anon
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rows).toHaveLength(10);
    for (const r of rows) expect({ table: r.table_name, auth: r.auth, anon: r.anon }).toEqual({ table: r.table_name, auth: true, anon: false });
  });

  it("lets only the authenticated role execute the write functions", async () => {
    for (const fn of [SAVE_SIG, "public.deactivate_student(uuid)"]) {
      const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', '${fn}', 'execute') as anon,
                has_function_privilege('authenticated', '${fn}', 'execute') as auth`,
      );
      expect(rows[0]).toEqual({ anon: false, auth: true });
    }
  });
});
