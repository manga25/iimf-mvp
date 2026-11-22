import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs 0001–0007 on an in-memory Postgres and checks the notification actions (SPEC §3.8, AC-7.3).
const files = ["0001_init", "0002_student_rpc", "0003_schedule_rpc", "0004_session_rpc", "0005_attendance_rpc", "0006_payment_rpc", "0007_notification_rpc"]
  .map((f) => readFileSync(`supabase/migrations/${f}.sql`, "utf8"));

let db: PGlite;
let noteId = "";

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const sql of files) await db.exec(sql);
  await db.exec(files[6]); // re-running must be safe
}, 30_000);

beforeEach(async () => {
  await db.exec(`delete from notifications; delete from payments; delete from attendance; delete from sessions;
                 delete from schedules; delete from students;`);
  const { rows: [student] } = await db.query<{ id: string }>(
    "insert into students (full_name, phone, goal) values ('Ivo', '+351944444444', 'individual') returning id",
  );
  const { rows: [session] } = await db.query<{ id: string }>(
    `with s as (insert into schedules (status) values ('draft') returning id),
          g as (insert into class_groups (schedule_id, name, goal, weekday, start_time, duration_min)
                select id, 'Individual · Ivo', 'individual', 3, '10:00', 60 from s returning id)
     insert into sessions (group_id, date, start_time, end_time) select id, '2026-10-07', '10:00', '11:00' from g returning id`,
  );
  noteId = (await db.query<{ id: string }>(
    `insert into notifications (student_id, type, recipient, phone, message, session_id)
     values ($1, 'cancellation', 'student', '+351944444444', 'Original', $2) returning id`,
    [student.id, session.id],
  )).rows[0].id;
});

type Note = { status: string; message: string; sent_at: string | null };
const call = async (fn: string, ...args: (string | null)[]) => {
  const params = args.map((_, i) => `$${i + 1}`).join(", ");
  return (await db.query<{ r: Note }>(`select public.${fn}(${params}) as r`, args)).rows[0].r;
};
const errorCode = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code);
const stored = async () => (await db.query<Note>("select status, message, sent_at from notifications where id = $1", [noteId])).rows[0];
const UNKNOWN = "00000000-0000-0000-0000-000000000000";

describe("editing and sending (AC-7.3)", () => {
  it("saves a trimmed message while pending", async () => {
    expect(await call("save_notification_message", noteId, "  Edited text  ")).toMatchObject({ status: "pending", message: "Edited text" });
    expect(await stored()).toMatchObject({ message: "Edited text", status: "pending", sent_at: null });
  });

  it("marks it sent with the final text and sent_at, in one step", async () => {
    const r = await call("mark_notification_sent", noteId, "Final text");
    expect(r).toMatchObject({ status: "sent", message: "Final text" });
    expect(r.sent_at).not.toBeNull();
    expect(await stored()).toMatchObject({ status: "sent", message: "Final text" });
  });

  it("dismisses a pending notification", async () => {
    expect(await call("dismiss_notification", noteId)).toMatchObject({ status: "dismissed", sent_at: null });
  });
});

describe("refusals", () => {
  it("never changes a sent notification", async () => {
    await call("mark_notification_sent", noteId, "Final text");
    expect(await errorCode(call("save_notification_message", noteId, "Other"))).toBe("IM409");
    expect(await errorCode(call("mark_notification_sent", noteId, "Other"))).toBe("IM409");
    expect(await errorCode(call("dismiss_notification", noteId))).toBe("IM409");
    expect(await stored()).toMatchObject({ status: "sent", message: "Final text" });
  });

  it("keeps a dismissed notification dismissed", async () => {
    await call("dismiss_notification", noteId);
    expect(await errorCode(call("mark_notification_sent", noteId, "Text"))).toBe("IM409");
    expect((await stored()).status).toBe("dismissed");
  });

  it("rejects empty or too long messages and unknown ids", async () => {
    expect(await errorCode(call("save_notification_message", noteId, "   "))).toBe("22023");
    expect(await errorCode(call("mark_notification_sent", noteId, null))).toBe("22023");
    expect(await errorCode(call("save_notification_message", noteId, "x".repeat(2001)))).toBe("22023");
    expect(await call("save_notification_message", noteId, "x".repeat(2000))).toMatchObject({ status: "pending" });
    expect(await errorCode(call("dismiss_notification", UNKNOWN))).toBe("IM404");
  });
});

describe("privileges", () => {
  it("only the authenticated role may execute the notification functions", async () => {
    for (const fn of [
      "public.save_notification_message(uuid, text)", "public.mark_notification_sent(uuid, text)",
      "public.dismiss_notification(uuid)", "public.lock_pending_notification(uuid)",
    ]) {
      const { rows: [r] } = await db.query<{ anon: boolean; auth: boolean }>(
        `select has_function_privilege('anon', '${fn}', 'execute') as anon, has_function_privilege('authenticated', '${fn}', 'execute') as auth`,
      );
      expect([fn, r]).toEqual([fn, { anon: false, auth: true }]);
    }
  });
});
