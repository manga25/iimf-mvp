import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs 0001–0005 on an in-memory Postgres and checks set_attendance (SPEC §3.6, AC-5.3, AC-5.4).
const files = ["0001_init", "0002_student_rpc", "0003_schedule_rpc", "0004_session_rpc", "0005_attendance_rpc"].map((f) =>
  readFileSync(`supabase/migrations/${f}.sql`, "utf8"),
);

let db: PGlite;
let ana = ""; // has a guardian
let rui = "";
let groupId = "";

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const sql of files) await db.exec(sql);
  await db.exec(files[4]); // re-running must be safe
}, 30_000);

beforeEach(async () => {
  await db.exec(`delete from notifications; delete from attendance; delete from sessions;
                 delete from schedules; delete from students;`);
  const { rows } = await db.query<{ id: string }>(
    `insert into students (full_name, phone, goal, school_year, guardian_name, guardian_phone) values
       ('Ana', '+351911111111', 'school_support', 7, 'Rita', '+351922222222'),
       ('Rui', '+351933333333', 'school_support', 7, null, null) returning id`,
  );
  [ana, rui] = rows.map((r) => r.id);
  const { rows: [g] } = await db.query<{ id: string }>(
    `with s as (insert into schedules (status, term_start, term_end, approved_at)
                values ('approved', '2020-09-01', '2100-07-31', now()) returning id)
     insert into class_groups (schedule_id, name, goal, school_year, weekday, start_time, duration_min)
     select id, 'Year 7 · A', 'school_support', 7, 2, '18:00', 90 from s returning id`,
  );
  groupId = g.id;
  for (const id of [ana, rui]) await db.query("insert into group_members (group_id, student_id) values ($1, $2)", [groupId, id]);
});

const addSession = async (date = "2020-01-07", status = "scheduled") =>
  (await db.query<{ id: string }>(
    `insert into sessions (group_id, date, start_time, end_time, status) values ($1, $2::date, '18:00', '19:30', $3) returning id`,
    [groupId, date, status],
  )).rows[0].id;
const today = async () => (await db.query<{ d: string }>("select ((now() at time zone 'Europe/Lisbon')::date)::text as d")).rows[0].d;

const absenceNotes = (student: string, guardian: boolean) => JSON.stringify([
  { student_id: student, recipient: "student", phone: "+351911111111", message: "Hello student" },
  ...(guardian ? [{ student_id: student, recipient: "guardian", phone: "+351922222222", message: "Hello guardian" }] : []),
]);
type Result = { status: string; remarks: string | null; created: number; removed: number };
const mark = async (session: string, student: string, status: string, remarks: string | null = null, notes = "[]") =>
  (await db.query<{ r: Result }>(
    "select public.set_attendance($1, $2, $3::public.attendance_status, $4, $5::jsonb) as r",
    [session, student, status, remarks, notes],
  )).rows[0].r;
const errorCode = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code);
const rows = async (session: string) =>
  (await db.query<{ student_id: string; status: string; remarks: string | null }>(
    "select student_id, status, remarks from attendance where session_id = $1 order by student_id", [session],
  )).rows;
const absences = async (where = "true") =>
  (await db.query<{ recipient: string; status: string }>(
    `select recipient, status from notifications where type = 'absence' and ${where} order by recipient::text`,
  )).rows;

describe("stored rows (only non-default)", () => {
  it("stores Late/Absent and remarks, and deletes the row when back to plain Present", async () => {
    const s = await addSession();
    expect(await rows(s)).toEqual([]); // everyone Present by default (AC-5.1)
    await mark(s, rui, "late");
    expect(await rows(s)).toEqual([{ student_id: rui, status: "late", remarks: null }]);
    await mark(s, rui, "present", "  Arrived with homework done  ");
    expect(await rows(s)).toEqual([{ student_id: rui, status: "present", remarks: "Arrived with homework done" }]);
    await mark(s, rui, "present", "   ");
    expect(await rows(s)).toEqual([]);
  });

  it("allows a session dated today (by date, not time)", async () => {
    const s = await addSession(await today());
    expect((await mark(s, rui, "late")).status).toBe("late");
  });
});

describe("absence notifications (AC-5.3)", () => {
  it("creates student + guardian notifications and removes them when reverted while pending", async () => {
    const s = await addSession();
    expect(await mark(s, ana, "absent", null, absenceNotes(ana, true))).toMatchObject({ created: 2, removed: 0 });
    expect(await absences()).toEqual([{ recipient: "guardian", status: "pending" }, { recipient: "student", status: "pending" }]);

    expect(await mark(s, ana, "present")).toMatchObject({ created: 0, removed: 2 });
    expect(await absences()).toEqual([]);
    expect(await rows(s)).toEqual([]);
  });

  it("only notifies the student when there is no guardian", async () => {
    const s = await addSession();
    await mark(s, rui, "absent", null, absenceNotes(rui, false));
    expect(await absences()).toEqual([{ recipient: "student", status: "pending" }]);
  });

  it("does not duplicate notifications when staying Absent (e.g. editing remarks)", async () => {
    const s = await addSession();
    await mark(s, ana, "absent", null, absenceNotes(ana, true));
    expect(await mark(s, ana, "absent", "Sick", absenceNotes(ana, true))).toMatchObject({ created: 0, removed: 0 });
    expect(await absences()).toHaveLength(2);
    expect(await rows(s)).toEqual([{ student_id: ana, status: "absent", remarks: "Sick" }]);
  });

  it("keeps notifications that were already sent or dismissed; Absent → Late also reverts", async () => {
    const s = await addSession();
    await mark(s, ana, "absent", null, absenceNotes(ana, true));
    await db.exec("update notifications set status = 'sent', sent_at = now() where recipient = 'guardian'");
    expect(await mark(s, ana, "late")).toMatchObject({ removed: 1 });
    expect(await absences()).toEqual([{ recipient: "guardian", status: "sent" }]);
  });

  it("only touches the given student's notifications", async () => {
    const s = await addSession();
    await mark(s, ana, "absent", null, absenceNotes(ana, true));
    await mark(s, rui, "absent", null, absenceNotes(rui, false));
    await mark(s, ana, "present");
    expect(await absences()).toEqual([{ recipient: "student", status: "pending" }]);
  });

  it("requires notifications for a new absence and rejects ones for another student", async () => {
    const s = await addSession();
    expect(await errorCode(mark(s, ana, "absent"))).toBe("22023");
    expect(await errorCode(mark(s, ana, "absent", null, absenceNotes(rui, false)))).toBe("22023");
    expect(await rows(s)).toEqual([]); // rolled back
    expect(await absences()).toEqual([]);
  });
});

describe("refusals (AC-5.4)", () => {
  it("rejects future, cancelled and unknown sessions, writing nothing", async () => {
    expect(await errorCode(mark(await addSession("2099-12-01"), rui, "late"))).toBe("IM411");
    expect(await errorCode(mark(await addSession("2020-01-14", "cancelled"), rui, "late"))).toBe("IM409");
    expect(await errorCode(mark("00000000-0000-0000-0000-000000000000", rui, "late"))).toBe("IM404");
    expect(Number((await db.query<{ n: number }>("select count(*)::int as n from attendance")).rows[0].n)).toBe(0);
  });

  it("rejects remarks over 500 chars and students outside the class", async () => {
    const s = await addSession();
    expect(await errorCode(mark(s, rui, "late", "x".repeat(501)))).toBe("22023");
    expect((await mark(s, rui, "late", "x".repeat(500))).remarks).toHaveLength(500);
    const { rows: [other] } = await db.query<{ id: string }>(
      "insert into students (full_name, phone, goal) values ('Other', '+351944444444', 'individual') returning id",
    );
    expect(await errorCode(mark(s, other.id, "late"))).toBe("22023");
  });
});

describe("privileges", () => {
  it("only the authenticated role may execute set_attendance", async () => {
    const fn = "public.set_attendance(uuid, uuid, public.attendance_status, text, jsonb)";
    const { rows: [r] } = await db.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', '${fn}', 'execute') as anon, has_function_privilege('authenticated', '${fn}', 'execute') as auth`,
    );
    expect(r).toEqual({ anon: false, auth: true });
  });
});
