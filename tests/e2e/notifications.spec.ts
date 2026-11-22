import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lisbonToday } from "../../src/lib/calendar/dates";
import { termFor } from "../../src/lib/schedule/term";
import { AUTH_STATE } from "./helpers";
import { adminClient, cleanUp, E2E_PREFIX, hasApprovedSchedule, snapshotDraft, type DraftSnapshot } from "./schedule-admin";

// AC-7.3, AC-7.4. Runs in its own project after the payments spec, one test at a time. It builds a
// tiny approved schedule with one session and stores three notifications for it; afterAll cleans up.
test.describe.configure({ mode: "serial" });
test.use({ storageState: AUTH_STATE });

const ANA = `${E2E_PREFIX} Notif Ana`;
const RUI = `${E2E_PREFIX} Notif Rui`;
const GUARDIAN = "Rita Guardian";

let db: SupabaseClient;
let api: APIRequestContext;
let snapshot: DraftSnapshot = null;
let ready = false;
const ids: Record<"cancellation" | "absence" | "sent", string> = { cancellation: "", absence: "", sent: "" };

const must = <T>({ data, error }: { data: T | null; error: { message: string } | null }, op: string): T => {
  if (error || data === null) throw new Error(`${op}: ${error?.message ?? "no data"}`);
  return data;
};

async function createStudent(full_name: string, extra: object = {}) {
  const res = await api.post("/api/students", { data: { full_name, phone: "912345678", goal: "school_support", school_year: 4, availability: [], ...extra } });
  expect(res.status(), `create ${full_name}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test.beforeAll(async ({}, info) => {
  const client = adminClient();
  test.skip(!client, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to run the notifications E2E spec.");
  db = client!;
  test.skip(await hasApprovedSchedule(db), "An approved schedule already exists; this spec refuses to touch real term data.");
  snapshot = await snapshotDraft(db);
  ready = true;
  api = await playwrightRequest.newContext({ baseURL: info.project.use.baseURL, storageState: AUTH_STATE });

  const ana = await createStudent(ANA, { guardian_name: GUARDIAN, guardian_phone: "934567890" });
  const rui = await createStudent(RUI);
  const schedule = must(await db.from("schedules").insert({ status: "approved", ...termFor(new Date()), approved_at: new Date().toISOString() })
    .select("id").single(), "insert schedule") as { id: string };
  const group = must(await db.from("class_groups").insert({
    schedule_id: schedule.id, name: `${E2E_PREFIX} Notif Year 4 · A`, goal: "school_support", school_year: 4, weekday: 1, start_time: "18:00", duration_min: 90,
  }).select("id").single(), "insert group") as { id: string };
  must(await db.from("group_members").insert([ana, rui].map((student_id) => ({ group_id: group.id, student_id }))).select(), "insert members");
  const session = must(await db.from("sessions").insert({ group_id: group.id, date: lisbonToday(), start_time: "18:00", end_time: "19:30" })
    .select("id").single(), "insert session") as { id: string };

  // A multi-row insert sends null for missing columns, so every row lists status and sent_at.
  const pending = { status: "pending", sent_at: null };
  const notes = must(await db.from("notifications").insert([
    { student_id: ana, type: "cancellation", recipient: "guardian", phone: "+351934567890", message: "Original cancellation text", session_id: session.id, ...pending },
    { student_id: rui, type: "absence", recipient: "student", phone: "+351912345678", message: "Original absence text", session_id: session.id, ...pending },
    { student_id: rui, type: "modality_change", recipient: "student", phone: "+351912345678", message: "Already sent text", session_id: session.id,
      status: "sent", sent_at: new Date().toISOString() },
  ]).select("id, type"), "insert notifications") as { id: string; type: string }[];
  ids.cancellation = notes.find((n) => n.type === "cancellation")!.id;
  ids.absence = notes.find((n) => n.type === "absence")!.id;
  ids.sent = notes.find((n) => n.type === "modality_change")!.id;
});

test.afterAll(async () => {
  if (ready) await cleanUp(db, snapshot);
  await api?.dispose();
});

const card = (page: Page, text: string) => page.getByTestId("notification-row").filter({ hasText: text });
const stored = async (id: string) =>
  must(await db.from("notifications").select("status, message, sent_at").eq("id", id).single(), "read notification") as
    { status: string; message: string; sent_at: string | null };

test("an edited message is saved when the field loses focus", async ({ page }) => {
  await page.goto("/notifications");
  const absence = card(page, `${RUI} (student)`).filter({ hasText: "Absence" });
  await absence.getByLabel(/^Message/).fill("Saved on blur");
  await page.getByRole("heading", { name: "Notifications" }).click();
  await expect(absence.getByRole("status")).toHaveText("Message saved.");
  expect(await stored(ids.absence)).toMatchObject({ status: "pending", message: "Saved on blur" });
});

test("AC-7.3 Copy message copies the edited text and marks it Sent", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/notifications");
  const cancellation = card(page, `guardian of ${ANA}`);
  await expect(cancellation).toContainText(GUARDIAN);
  await expect(cancellation).toContainText("+351934567890");
  await expect(cancellation).toContainText("Pending");

  await cancellation.getByLabel(/^Message/).fill("Edited: the class is cancelled.");
  await cancellation.getByRole("button", { name: "Copy message" }).click();
  await expect(cancellation).toContainText("Sent");
  await expect(cancellation.getByRole("button", { name: "Copy message" })).toHaveCount(0);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Edited: the class is cancelled.");
  const saved = await stored(ids.cancellation);
  expect(saved).toMatchObject({ status: "sent", message: "Edited: the class is cancelled." });
  expect(saved.sent_at).not.toBeNull();
});

test("Open WhatsApp opens the wa.me link with the message and marks it Sent", async ({ page, context }) => {
  await context.route("https://wa.me/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>wa</title>" }));
  await page.goto("/notifications");
  const absence = card(page, `${RUI} (student)`).filter({ hasText: "Absence" });
  const [popup] = await Promise.all([page.waitForEvent("popup"), absence.getByRole("link", { name: /Open WhatsApp/ }).click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(`https://wa.me/351912345678?text=${encodeURIComponent("Saved on blur")}`);
  await popup.close();
  await expect(absence).toContainText("Sent");
  expect((await stored(ids.absence)).status).toBe("sent");
});

test("AC-7.4 the log can be filtered by type and status", async ({ page }) => {
  await page.goto("/notifications?type=modality_change");
  await expect(card(page, RUI)).toHaveCount(1);
  await expect(card(page, ANA)).toHaveCount(0);

  await page.getByLabel("Type").selectOption("all");
  await page.getByLabel("Status").selectOption("sent");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/status=sent/);
  await expect(card(page, ANA)).toHaveCount(1);
  await expect(card(page, RUI)).toHaveCount(2);
  for (const status of await page.getByTestId("notification-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-status")))) {
    expect(status).toBe("sent");
  }

  await page.goto("/notifications?status=pending&type=absence");
  await expect(card(page, RUI)).toHaveCount(0);
});

test("Dismiss turns a pending notification into Dismissed; sent ones stay read-only", async ({ page }) => {
  const extra = must(await db.from("notifications").insert({
    student_id: (must(await db.from("students").select("id").eq("full_name", ANA).single(), "read Ana") as { id: string }).id,
    type: "cancellation", recipient: "guardian", phone: "+351934567890", message: "To dismiss",
    session_id: (must(await db.from("notifications").select("session_id").eq("id", ids.sent).single(), "read session") as { session_id: string }).session_id,
  }).select("id").single(), "insert pending") as { id: string };

  await page.goto("/notifications?status=pending");
  const row = card(page, `guardian of ${ANA}`);
  await row.getByRole("button", { name: /^Dismiss/ }).click();
  await expect(row).toHaveCount(0); // it leaves the "pending" filter after the refresh
  expect((await stored(extra.id)).status).toBe("dismissed");

  await page.goto("/notifications?status=sent&type=modality_change");
  const sent = card(page, RUI);
  await expect(sent).toContainText("Already sent text");
  await expect(sent.getByRole("textbox")).toHaveCount(0);
  await expect(sent.getByRole("button")).toHaveCount(0);
});
