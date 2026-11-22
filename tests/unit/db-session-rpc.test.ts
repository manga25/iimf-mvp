import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs 0001–0004 on an in-memory Postgres and checks blocked periods and session changes (AC-4.2–4.4).
const files = ["0001_init", "0002_student_rpc", "0003_schedule_rpc", "0004_session_rpc"].map((f) =>
  readFileSync(`supabase/migrations/${f}.sql`, "utf8"),
);

let db: PGlite;
let students: string[] = [];
let groupId = "";

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const sql of files) await db.exec(sql);
  await db.exec(files[3]); // re-running must be safe
}, 30_000);

beforeEach(async () => {
  await db.exec(`delete from notifications; delete from sessions; delete from blocked_periods;
                 delete from schedules; delete from students;`);
  const { rows } = await db.query<{ id: string }>(
    `insert into students (full_name, phone, goal, cefr_level)
     select 'Student ' || n, '+35191234567' || n, 'cambridge', 'B2' from generate_series(1, 3) n returning id`,
  );
  students = rows.map((r) => r.id);
  const { rows: [g] } = await db.query<{ id: string }>(
    `with s as (insert into schedules (status, term_start, term_end, approved_at)
                values ('approved', '2099-09-01', '2100-07-31', now()) returning id)
     insert into class_groups (schedule_id, name, goal, cefr_level, weekday, start_time, duration_min)
     select id, 'Cambridge B2 · A', 'cambridge', 'B2', 2, '18:00', 90 from s returning id`,
  );
  groupId = g.id;
  for (const id of students) await db.query("insert into group_members (group_id, student_id) values ($1, $2)", [groupId, id]);
});

const addSession = async (date: string, status = "scheduled") =>
  (await db.query<{ id: string }>(
    `insert into sessions (group_id, date, start_time, end_time, status) values ($1, $2, '18:00', '19:30', $3) returning id`,
    [groupId, date, status],
  )).rows[0].id;
const block = async (start: string, end: string, reason = "Holiday") =>
  (await db.query<{ r: { id: string; cancelled: number } }>("select public.create_blocked_period($1, $2, $3) as r", [start, end, reason])).rows[0].r;
const unblock = async (id: string) =>
  (await db.query<{ r: { restored: number } }>("select public.delete_blocked_period($1) as r", [id])).rows[0].r;
const sessionOf = async (id: string) =>
  (await db.query<{ status: string; modality: string; blocked_period_id: string | null }>(
    "select status, modality, blocked_period_id from sessions where id = $1", [id],
  )).rows[0];
const errorCode = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code);
const count = async (sql: string) => Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) t`)).rows[0].n);
const notes = (ids = students) =>
  JSON.stringify(ids.map((student_id) => ({ student_id, recipient: "student", phone: "+351912345678", message: "Hello" })));

describe("blocked periods (AC-4.2)", () => {
  it("cancels overlapping sessions without notifications and restores them on delete", async () => {
    const tue22 = await addSession("2099-12-22");
    const tue29 = await addSession("2099-12-29");
    const tue05 = await addSession("2100-01-05");
    const bp = await block("2099-12-23 00:00", "2100-01-02 23:59", "  Christmas  ");
    expect(bp.cancelled).toBe(1);
    expect(await sessionOf(tue29)).toMatchObject({ status: "cancelled", blocked_period_id: bp.id });
    expect((await sessionOf(tue22)).status).toBe("scheduled");
    expect((await sessionOf(tue05)).status).toBe("scheduled");
    expect(await count("select 1 from notifications")).toBe(0);
    expect((await db.query("select reason from blocked_periods")).rows).toEqual([{ reason: "Christmas" }]);

    expect(await unblock(bp.id)).toEqual({ restored: 1 });
    expect(await sessionOf(tue29)).toMatchObject({ status: "scheduled", blocked_period_id: null });
    expect(await count("select 1 from blocked_periods")).toBe(0);
  });

  it("uses Lisbon wall-clock time (summer time) and treats touching edges as no overlap", async () => {
    const s = await addSession("2100-06-01"); // Tue, 18:00–19:30 Lisbon (UTC+1)
    expect((await block("2100-06-01 10:00", "2100-06-01 18:00")).cancelled).toBe(0);
    expect((await block("2100-06-01 19:30", "2100-06-01 21:00")).cancelled).toBe(0);
    expect((await block("2100-06-01 19:00", "2100-06-01 19:15")).cancelled).toBe(1);
    expect((await sessionOf(s)).status).toBe("cancelled");
  });

  it("re-links a session to another overlapping block instead of restoring it", async () => {
    const s = await addSession("2099-12-29");
    const first = await block("2099-12-28 00:00", "2099-12-30 00:00", "First");
    const second = await block("2099-12-29 00:00", "2099-12-31 00:00", "Second");
    expect(second.cancelled).toBe(0); // already cancelled by the first block
    expect(await unblock(first.id)).toEqual({ restored: 0 });
    expect(await sessionOf(s)).toMatchObject({ status: "cancelled", blocked_period_id: second.id });
    expect(await unblock(second.id)).toEqual({ restored: 1 });
    expect((await sessionOf(s)).status).toBe("scheduled");
  });

  it("never restores a session that was cancelled individually", async () => {
    const s = await addSession("2099-12-29", "cancelled");
    const bp = await block("2099-12-23 00:00", "2100-01-02 23:59");
    expect(await unblock(bp.id)).toEqual({ restored: 0 });
    expect(await sessionOf(s)).toMatchObject({ status: "cancelled", blocked_period_id: null });
  });

  it("rejects invalid input and unknown ids", async () => {
    expect(await errorCode(block("2099-12-23 10:00", "2099-12-23 10:00"))).toBe("22023");
    expect(await errorCode(block("2099-12-23 10:00", "2099-12-23 11:00", "   "))).toBe("22023");
    expect(await errorCode(block("2099-12-23 10:00", "2099-12-23 11:00", "x".repeat(201)))).toBe("22023");
    expect(await errorCode(unblock("00000000-0000-0000-0000-000000000000"))).toBe("IM404");
  });
});

describe("cancel_session (AC-4.3)", () => {
  const cancel = (id: string, n = notes()) => db.query("select public.cancel_session($1, $2::jsonb)", [id, n]);

  it("cancels the session and stores one notification per student", async () => {
    const s = await addSession("2099-12-01");
    await cancel(s);
    expect(await sessionOf(s)).toMatchObject({ status: "cancelled", blocked_period_id: null });
    expect((await db.query("select distinct type, status, session_id from notifications")).rows)
      .toEqual([{ type: "cancellation", status: "pending", session_id: s }]);
    expect(await count("select 1 from notifications")).toBe(3);
  });

  it("refuses cancelled, finished and unknown sessions, writing nothing", async () => {
    expect(await errorCode(cancel(await addSession("2099-12-01", "cancelled")))).toBe("IM409");
    expect(await errorCode(cancel(await addSession("2020-01-07")))).toBe("IM410");
    expect(await errorCode(cancel("00000000-0000-0000-0000-000000000000"))).toBe("IM404");
    expect(await count("select 1 from notifications")).toBe(0);
  });

  it("rolls back when a notification belongs to a student outside the class", async () => {
    const s = await addSession("2099-12-01");
    const { rows: [other] } = await db.query<{ id: string }>(
      "insert into students (full_name, phone, goal) values ('Other', '+351911111111', 'individual') returning id",
    );
    expect(await errorCode(cancel(s, notes([students[0], other.id])))).toBe("22023");
    expect((await sessionOf(s)).status).toBe("scheduled");
    expect(await count("select 1 from notifications")).toBe(0);
  });
});

describe("set_session_modality (AC-4.4)", () => {
  const setModality = (id: string, m: string) => db.query("select public.set_session_modality($1, $2::public.modality, $3::jsonb)", [id, m, notes()]);

  it("switches modality and stores notifications on every change", async () => {
    const s = await addSession("2099-12-01");
    await setModality(s, "online");
    expect((await sessionOf(s)).modality).toBe("online");
    await setModality(s, "in_person");
    expect((await sessionOf(s)).modality).toBe("in_person");
    expect(await count("select 1 from notifications where type = 'modality_change' and status = 'pending'")).toBe(6);
  });

  it("refuses the same modality, cancelled and finished sessions", async () => {
    expect(await errorCode(setModality(await addSession("2099-12-01"), "in_person"))).toBe("IM412");
    expect(await errorCode(setModality(await addSession("2099-12-08", "cancelled"), "online"))).toBe("IM409");
    expect(await errorCode(setModality(await addSession("2020-01-07"), "online"))).toBe("IM410");
    expect(await count("select 1 from notifications")).toBe(0);
  });
});

describe("privileges", () => {
  it("only the authenticated role may execute the functions", async () => {
    for (const fn of [
      "public.create_blocked_period(timestamp, timestamp, text)", "public.delete_blocked_period(uuid)",
      "public.cancel_session(uuid, jsonb)", "public.set_session_modality(uuid, public.modality, jsonb)",
    ]) {
      const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', '${fn}', 'execute') as anon, has_function_privilege('authenticated', '${fn}', 'execute') as auth`,
      );
      expect(rows[0]).toEqual({ anon: false, auth: true });
    }
  });
});
