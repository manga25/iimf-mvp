import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs 0001–0003 on an in-memory Postgres and checks save_draft / approve_schedule (AC-3.11, AC-4.2 at approval).
const files = ["0001_init", "0002_student_rpc", "0003_schedule_rpc"].map((f) => readFileSync(`supabase/migrations/${f}.sql`, "utf8"));

let db: PGlite;
let students: string[] = [];

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const sql of files) await db.exec(sql);
  await db.exec(files[2]); // re-running must be safe
}, 30_000);

beforeEach(async () => {
  await db.exec("delete from sessions; delete from blocked_periods; delete from schedules; delete from students;");
  const { rows } = await db.query<{ id: string }>(
    `insert into students (full_name, phone, goal, cefr_level)
     select 'Student ' || n, '+35191234567' || n, 'cambridge', 'B2' from generate_series(1, 4) n returning id`,
  );
  students = rows.map((r) => r.id);
});

const group = (over: Record<string, unknown> = {}) => ({
  name: "Cambridge B2 · A", goal: "cambridge", cefr_level: "B2", school_year: null,
  weekday: 2, start_time: "18:00", duration_min: 90, member_ids: students.slice(0, 3), ...over,
});
const saveDraft = async (groups: unknown[], regenerate = false) =>
  (await db.query<{ id: string }>("select public.save_draft($1::jsonb, $2) as id", [JSON.stringify(groups), regenerate])).rows[0].id;
const approve = (start = "2026-09-01", end = "2027-07-31") =>
  db.query<{ id: string }>("select public.approve_schedule($1::date, $2::date) as id", [start, end]);
const errorCode = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code);
const count = async (sql: string) => Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) t`)).rows[0].n);

describe("save_draft", () => {
  it("creates the draft with its groups and members", async () => {
    const id = await saveDraft([group(), group({ name: "Individual · X", goal: "individual", cefr_level: null, duration_min: 60, start_time: "10:00", member_ids: [students[3]] })], true);
    expect(await count(`select 1 from schedules where id = '${id}' and status = 'draft'`)).toBe(1);
    expect(await count("select 1 from class_groups")).toBe(2);
    expect(await count("select 1 from group_members")).toBe(4);
  });

  it("replaces the previous groups and keeps the same draft row", async () => {
    const first = await saveDraft([group()], true);
    const second = await saveDraft([group({ member_ids: students.slice(0, 2), start_time: "09:00" })]);
    expect(second).toBe(first);
    expect((await db.query("select start_time from class_groups")).rows).toEqual([{ start_time: "09:00:00" }]);
    expect(await count("select 1 from group_members")).toBe(2);
  });

  it("only bumps generated_at on regeneration", async () => {
    await saveDraft([group()], true);
    await db.exec("update schedules set generated_at = '2026-01-01T00:00:00Z'");
    await saveDraft([group()]);
    expect(await count("select 1 from schedules where generated_at = '2026-01-01T00:00:00Z'")).toBe(1);
    await saveDraft([group()], true);
    expect(await count("select 1 from schedules where generated_at = '2026-01-01T00:00:00Z'")).toBe(0);
  });

  it("rolls back entirely when a group breaks a CHECK (e.g. ends after 20:00)", async () => {
    await saveDraft([group()], true);
    expect(await errorCode(saveDraft([group({ start_time: "19:00" })]))).toBe("23514");
    expect((await db.query("select start_time from class_groups")).rows).toEqual([{ start_time: "18:00:00" }]);
  });

  it("raises IM409 once a schedule is approved", async () => {
    await saveDraft([group()], true);
    await approve();
    expect(await errorCode(saveDraft([group()], true))).toBe("IM409");
  });
});

describe("approve_schedule", () => {
  it("approves the draft and creates one session per week from 1 Sep to 31 Jul (AC-3.11)", async () => {
    await saveDraft([group({ weekday: 2 }), group({ name: "B", weekday: 6, start_time: "10:00", member_ids: [students[3]] })], true);
    const { rows } = await approve();
    const { rows: [s] } = await db.query<Record<string, unknown>>("select * from schedules where id = $1", [rows[0].id]);
    expect(s).toMatchObject({ status: "approved", term_start: new Date("2026-09-01"), term_end: new Date("2027-07-31") });
    expect(s.approved_at).not.toBeNull();

    // 2026-09-01 is a Tuesday: Tuesdays 1 Sep … 27 Jul = 48; Saturdays 5 Sep … 31 Jul = 48.
    const perGroup = (await db.query<{ n: number; first: Date; last: Date; wrong_dow: number }>(
      `select count(*)::int as n, min(date) as first, max(date) as last,
              count(*) filter (where extract(isodow from date) <> cg.weekday)::int as wrong_dow
       from sessions join class_groups cg on cg.id = sessions.group_id group by cg.id, cg.weekday order by cg.weekday`,
    )).rows;
    expect(perGroup.map((g) => g.n)).toEqual([48, 48]);
    expect(perGroup.every((g) => g.wrong_dow === 0)).toBe(true);
    expect(perGroup[1].last).toEqual(new Date("2027-07-31"));
    expect((await db.query("select distinct start_time, end_time, status, modality from sessions where extract(isodow from date) = 2")).rows)
      .toEqual([{ start_time: "18:00:00", end_time: "19:30:00", status: "scheduled", modality: "in_person" }]);
  });

  it("cancels sessions overlapping an existing blocked period (Lisbon time) without notifications", async () => {
    await saveDraft([group({ weekday: 2, start_time: "18:00" })], true);
    // Christmas: 23 Dec 00:00 → 2 Jan 23:59 Lisbon (UTC+0 in winter) → Tue 29 Dec is blocked.
    const { rows: [bp] } = await db.query<{ id: string }>(
      "insert into blocked_periods (start_at, end_at, reason) values ('2026-12-23T00:00:00+00', '2027-01-02T23:59:00+00', 'Christmas') returning id",
    );
    // Ends exactly when a class starts (Tue 6 Oct 18:00 Lisbon = 17:00 UTC in summer time) → no overlap.
    await db.exec("insert into blocked_periods (start_at, end_at, reason) values ('2026-10-06T10:00:00+00', '2026-10-06T17:00:00+00', 'Morning')");
    await approve();

    const cancelled = (await db.query<{ date: Date; blocked_period_id: string }>(
      "select date, blocked_period_id from sessions where status = 'cancelled' order by date",
    )).rows;
    expect(cancelled).toEqual([{ date: new Date("2026-12-29"), blocked_period_id: bp.id }]);
    expect(await count("select 1 from notifications")).toBe(0);
  });

  it("rejects a wrong term, a missing draft, an empty draft and a second approval", async () => {
    expect(await errorCode(approve())).toBe("IM404");
    await saveDraft([], true);
    expect(await errorCode(approve())).toBe("22023");
    await saveDraft([group()], true);
    expect(await errorCode(approve("2026-08-01", "2027-07-31"))).toBe("22023");
    expect(await errorCode(approve("2026-09-01", "2028-07-31"))).toBe("22023");
    await approve();
    expect(await errorCode(approve())).toBe("IM409");
    expect(await count("select 1 from schedules where status = 'approved'")).toBe(1);
  });

  it("locks student writes after approval (shared with 0002)", async () => {
    await saveDraft([group()], true);
    await approve();
    expect(await errorCode(db.query("select public.deactivate_student($1)", [students[0]]))).toBe("IM409");
  });

  it("only the authenticated role may execute the functions", async () => {
    for (const fn of ["public.save_draft(jsonb, boolean)", "public.approve_schedule(date, date)", "public.assert_schedule_editable()"]) {
      const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', '${fn}', 'execute') as anon, has_function_privilege('authenticated', '${fn}', 'execute') as auth`,
      );
      expect(rows[0]).toEqual({ anon: false, auth: true });
    }
  });
});
