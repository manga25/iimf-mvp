import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs 0001–0006 on an in-memory Postgres and checks the payment functions (SPEC §3.7, AC-6.1–6.7).
const files = ["0001_init", "0002_student_rpc", "0003_schedule_rpc", "0004_session_rpc", "0005_attendance_rpc", "0006_payment_rpc"]
  .map((f) => readFileSync(`supabase/migrations/${f}.sql`, "utf8"));

let db: PGlite;
let ana = ""; // group, has a guardian
let rui = ""; // group
let ivo = ""; // individual
let groupId = "";
let soloId = "";

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const sql of files) await db.exec(sql);
  await db.exec(files[5]); // re-running must be safe
}, 30_000);

beforeEach(async () => {
  await db.exec(`delete from notifications; delete from payments; delete from attendance; delete from sessions;
                 delete from schedules; delete from students;`);
  const { rows } = await db.query<{ id: string }>(
    `insert into students (full_name, phone, goal, school_year, guardian_name, guardian_phone) values
       ('Ana', '+351911111111', 'school_support', 7, 'Rita', '+351922222222'),
       ('Rui', '+351933333333', 'school_support', 7, null, null) returning id`,
  );
  [ana, rui] = rows.map((r) => r.id);
  ivo = (await db.query<{ id: string }>(
    "insert into students (full_name, phone, goal) values ('Ivo', '+351944444444', 'individual') returning id",
  )).rows[0].id;
  // A past term, so the real "today" used by set_payment_status is after every month.
  const { rows: groups } = await db.query<{ id: string }>(
    `with s as (insert into schedules (status, term_start, term_end, approved_at)
                values ('approved', '2025-09-01', '2026-07-31', now()) returning id)
     insert into class_groups (schedule_id, name, goal, school_year, weekday, start_time, duration_min)
     select id, 'Year 7 · A', 'school_support'::goal, 7::smallint, 2::smallint, '18:00'::time, 90::smallint from s
     union all
     select id, 'Individual · Ivo', 'individual'::goal, null, 3::smallint, '10:00'::time, 60::smallint from s
     returning id`,
  );
  [groupId, soloId] = groups.map((g) => g.id);
  for (const id of [ana, rui]) await db.query("insert into group_members (group_id, student_id) values ($1, $2)", [groupId, id]);
  await db.query("insert into group_members (group_id, student_id) values ($1, $2)", [soloId, ivo]);
});

const OCT_TUESDAYS = ["2025-10-07", "2025-10-14", "2025-10-21", "2025-10-28"];
const OCT_WEDNESDAYS = ["2025-10-01", "2025-10-08", "2025-10-15", "2025-10-22", "2025-10-29"];

async function addSessions(group: string, dates: string[], opts: { status?: string; modality?: string } = {}) {
  const [start, end] = group === soloId ? ["10:00", "11:00"] : ["18:00", "19:30"];
  const ids: string[] = [];
  for (const d of dates) {
    const { rows: [s] } = await db.query<{ id: string }>(
      `insert into sessions (group_id, date, start_time, end_time, status, modality)
       values ($1, $2::date, $3::time, $4::time, $5::session_status, $6::modality) returning id`,
      [group, d, start, end, opts.status ?? "scheduled", opts.modality ?? "in_person"],
    );
    ids.push(s.id);
  }
  return ids;
}
const attend = (session: string, student: string, status: string) =>
  db.query("insert into attendance (session_id, student_id, status) values ($1, $2, $3::attendance_status)", [session, student, status]);

type Sync = { upserted: number; deleted: number; overdue: { payment_id: string; student_id: string; month: string; amount: number; guardian_name: string | null }[] };
const sync = async (today: string) => (await db.query<{ r: Sync }>("select public.sync_payments($1::date) as r", [today])).rows[0].r;
const payments = async () =>
  (await db.query<{ id: string; student_id: string; month: string; hours: string; amount: string; status: string; paid_at: string | null }>(
    "select id, student_id, month::text, hours::text, amount::text, status, paid_at::text from payments order by month, student_id",
  )).rows;
const paymentOf = async (student: string, month = "2025-10-01") => (await payments()).find((p) => p.student_id === student && p.month === month);
const overdueNotes = (notes: { payment_id: string }[]) =>
  JSON.stringify(notes.map((n) => ({ payment_id: n.payment_id, recipient: "student", phone: "+351911111111", message: "Pay please" })));
const createOverdue = async (json: string, today: string) =>
  (await db.query<{ n: number }>("select public.create_overdue_notifications($1::jsonb, $2::date) as n", [json, today])).rows[0].n;
const setStatus = async (id: string, status: string, paidAt: string | null = null) =>
  (await db.query<{ r: { payment: { status: string; paid_at: string | null; amount: number }; dismissed: number } }>(
    "select public.set_payment_status($1, $2::payment_status, $3::date) as r", [id, status, paidAt],
  )).rows[0].r;
const errorCode = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code);
const overdueRows = async () =>
  (await db.query<{ payment_id: string; status: string }>("select payment_id, status from notifications where type = 'overdue'")).rows;

describe("amounts (AC-6.1, AC-6.2, AC-6.3)", () => {
  it("group student: 4 sessions → 6.0 h / 60 €; 5 sessions → 7.5 h / 75 €", async () => {
    await addSessions(groupId, OCT_TUESDAYS);
    await sync("2025-11-01");
    expect(await paymentOf(ana)).toMatchObject({ hours: "6.0", amount: "60.00", status: "unpaid", paid_at: null });
    await addSessions(groupId, ["2025-10-30"]);
    await sync("2025-11-02");
    expect(await paymentOf(ana)).toMatchObject({ hours: "7.5", amount: "75.00" });
  });

  it("1 Absent out of 4 → 4.5 h / 45 €, while a classmate pays the full 60 €", async () => {
    const [first] = await addSessions(groupId, OCT_TUESDAYS);
    await attend(first, ana, "absent");
    await sync("2025-11-01");
    expect(await paymentOf(ana)).toMatchObject({ hours: "4.5", amount: "45.00" });
    expect(await paymentOf(rui)).toMatchObject({ hours: "6.0", amount: "60.00" });
  });

  it("individual student: 4 sessions → 4.0 h / 100 €; a 5-week month has no cap", async () => {
    await addSessions(soloId, OCT_WEDNESDAYS.slice(0, 4));
    await sync("2025-11-01");
    expect(await paymentOf(ivo)).toMatchObject({ hours: "4.0", amount: "100.00" });
    await addSessions(soloId, OCT_WEDNESDAYS.slice(4));
    await sync("2025-11-01");
    expect(await paymentOf(ivo)).toMatchObject({ hours: "5.0", amount: "125.00" });
  });

  it("cancelled sessions are not billed; Late and Online sessions are", async () => {
    const [s1, s2] = await addSessions(groupId, OCT_TUESDAYS.slice(0, 2));
    await addSessions(groupId, OCT_TUESDAYS.slice(2, 3), { modality: "online" });
    await addSessions(groupId, OCT_TUESDAYS.slice(3), { status: "cancelled" });
    await attend(s1, rui, "late");
    await db.query("insert into attendance (session_id, student_id, status, remarks) values ($1, $2, 'present', 'Good')", [s2, rui]);
    await sync("2025-11-01");
    expect(await paymentOf(rui)).toMatchObject({ hours: "4.5", amount: "45.00" });
  });
});

describe("lazy generation (AC-6.4)", () => {
  it("is idempotent, bills only completed months and skips 0-hour months", async () => {
    await addSessions(groupId, ["2025-09-30", ...OCT_TUESDAYS, "2025-11-04"]);
    await sync("2025-11-01");
    expect(await sync("2025-11-01")).toMatchObject({ upserted: 0, deleted: 0 });
    const rows = await payments();
    // Sep + Oct for Ana and Rui; nothing for November (not completed) or for Ivo (0 h).
    expect(rows.map((r) => [r.month, r.student_id]).sort()).toEqual(
      [["2025-09-01", ana], ["2025-09-01", rui], ["2025-10-01", ana], ["2025-10-01", rui]].sort(),
    );
    expect(rows.some((r) => r.student_id === ivo)).toBe(false);
  });

  it("does nothing before a schedule is approved or before the first month ends", async () => {
    await addSessions(groupId, OCT_TUESDAYS);
    expect(await sync("2025-10-31")).toEqual({ upserted: 0, deleted: 0, overdue: [] });
    await db.exec("update schedules set status = 'draft', term_start = null, term_end = null, approved_at = null");
    expect(await sync("2025-11-01")).toEqual({ upserted: 0, deleted: 0, overdue: [] });
    expect(await payments()).toEqual([]);
  });

  it("never bills months after the end of the term", async () => {
    await addSessions(groupId, ["2026-07-07"]);
    await sync("2026-10-15");
    expect((await payments()).map((p) => p.month)).toEqual(["2026-07-01", "2026-07-01"]);
  });

  it("recalculates unpaid rows and deletes them when they drop to 0 hours", async () => {
    const [only] = await addSessions(groupId, ["2025-10-07"]);
    await sync("2025-11-01");
    await attend(only, ana, "absent");
    expect(await sync("2025-11-02")).toMatchObject({ deleted: 1 });
    expect(await paymentOf(ana)).toBeUndefined();
    expect(await paymentOf(rui)).toMatchObject({ hours: "1.5" });
  });
});

describe("overdue (AC-6.5, AC-6.6)", () => {
  it("lists a payment as overdue from the 22nd of the next month, not on the 21st", async () => {
    await addSessions(groupId, OCT_TUESDAYS);
    expect((await sync("2025-11-21")).overdue).toEqual([]);
    const { overdue } = await sync("2025-11-22");
    expect(overdue.map((o) => o.student_id).sort()).toEqual([ana, rui].sort());
    expect(overdue.find((o) => o.student_id === ana)).toMatchObject({ month: "2025-10-01", amount: 60, guardian_name: "Rita" });
  });

  it("creates exactly one overdue notification per payment, however often it runs", async () => {
    await addSessions(groupId, OCT_TUESDAYS);
    const { overdue } = await sync("2025-11-22");
    expect(await createOverdue(overdueNotes(overdue), "2025-11-22")).toBe(2);
    expect(await createOverdue(overdueNotes(overdue), "2025-11-23")).toBe(0);
    expect((await sync("2025-11-23")).overdue).toEqual([]);
    expect(await overdueRows()).toHaveLength(2);
  });

  it("skips payments that are not overdue and rejects a non-list", async () => {
    await addSessions(groupId, OCT_TUESDAYS);
    await sync("2025-11-01");
    const ids = (await payments()).map((p) => ({ payment_id: p.id }));
    expect(await createOverdue(overdueNotes(ids), "2025-11-21")).toBe(0);
    expect(await errorCode(createOverdue("{}", "2025-11-22"))).toBe("22023");
  });
});

describe("mark paid / unpaid (AC-6.7)", () => {
  it("stores paid_at, freezes the amount and dismisses the pending overdue notification", async () => {
    const [first] = await addSessions(groupId, OCT_TUESDAYS);
    const { overdue } = await sync("2025-11-22");
    await createOverdue(overdueNotes(overdue), "2025-11-22");
    const payment = (await paymentOf(ana))!;

    const r = await setStatus(payment.id, "paid", "2025-11-25");
    expect(r).toMatchObject({ payment: { status: "paid", paid_at: "2025-11-25", amount: 60 }, dismissed: 1 });
    expect((await overdueRows()).find((n) => n.payment_id === payment.id)?.status).toBe("dismissed");

    await attend(first, ana, "absent"); // later attendance change…
    await sync("2025-11-30");
    expect(await paymentOf(ana)).toMatchObject({ hours: "6.0", amount: "60.00", status: "paid" }); // …doesn't alter it
    expect((await overdueRows()).filter((n) => n.status === "pending")).toHaveLength(1); // Rui's stays pending
  });

  it("can be set back to Unpaid, which clears paid_at and recalculates", async () => {
    const [first] = await addSessions(groupId, OCT_TUESDAYS);
    await sync("2025-11-01");
    const payment = (await paymentOf(ana))!;
    await setStatus(payment.id, "paid", "2025-11-03");
    await attend(first, ana, "absent");
    expect((await setStatus(payment.id, "unpaid")).payment).toMatchObject({ status: "unpaid", paid_at: null, amount: 45 });
  });

  it("refuses future paid dates, the same status and unknown payments", async () => {
    await addSessions(groupId, OCT_TUESDAYS);
    await sync("2025-11-01");
    const payment = (await paymentOf(ana))!;
    expect(await errorCode(setStatus(payment.id, "paid", "2999-01-01"))).toBe("22023");
    expect(await errorCode(setStatus(payment.id, "paid", null))).toBe("22023");
    expect(await errorCode(setStatus(payment.id, "unpaid"))).toBe("IM409");
    expect(await errorCode(setStatus("00000000-0000-0000-0000-000000000000", "paid", "2025-11-03"))).toBe("IM404");
    expect(await paymentOf(ana)).toMatchObject({ status: "unpaid", paid_at: null });
  });
});

describe("privileges", () => {
  it("only the authenticated role may execute the payment functions", async () => {
    for (const fn of [
      "public.payment_charges(date)", "public.sync_payments(date)",
      "public.create_overdue_notifications(jsonb, date)", "public.set_payment_status(uuid, public.payment_status, date)",
    ]) {
      const { rows: [r] } = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', '${fn}', 'execute') as anon, has_function_privilege('authenticated', '${fn}', 'execute') as auth`,
      );
      expect([fn, r]).toEqual([fn, { anon: false, auth: true }]);
    }
  });
});
