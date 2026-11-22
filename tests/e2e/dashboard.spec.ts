import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, formatShortDate, lisbonToday } from "../../src/lib/calendar/dates";
import { completedTermMonths, isOverdue } from "../../src/lib/payments/months";
import { termFor } from "../../src/lib/schedule/term";
import { AUTH_STATE } from "./helpers";
import { adminClient, cleanUp, E2E_PREFIX, hasApprovedSchedule, snapshotDraft, type DraftSnapshot } from "./schedule-admin";

// AC-8.1. Runs in its own project after the notifications spec, one test at a time. The first test
// sees the pre-approval dashboard; the second approves a tiny schedule (sessions today, in 3 days and
// in the last completed month) and checks the dashboard against the Payments and Notifications pages.
test.describe.configure({ mode: "serial" });
test.use({ storageState: AUTH_STATE });

const TODAY = lisbonToday();
const TERM = termFor(new Date());
const MONTH = completedTermMonths(TERM, TODAY)[0]; // undefined in September (nothing billed yet)
const IN_3_DAYS = addDays(TODAY, 3);

const GROUP = `${E2E_PREFIX} Dash Year 5 · A`;
const ANA = `${E2E_PREFIX} Dash Ana`;
const RUI = `${E2E_PREFIX} Dash Rui`;
const NOAV = `${E2E_PREFIX} Dash NoAvail`;
const AVAILABILITY = [{ weekday: 1, start_time: "08:00", end_time: "10:00" }];

let db: SupabaseClient;
let api: APIRequestContext;
let snapshot: DraftSnapshot = null;
let ready = false;
const ids: { ana?: string; rui?: string; noav?: string; today?: string; upcoming?: string } = {};

const must = <T>({ data, error }: { data: T | null; error: { message: string } | null }, op: string): T => {
  if (error || data === null) throw new Error(`${op}: ${error?.message ?? "no data"}`);
  return data;
};

async function createStudent(full_name: string, extra: object = {}) {
  const res = await api.post("/api/students", { data: { full_name, phone: "912345678", goal: "school_support", school_year: 5, availability: AVAILABILITY, ...extra } });
  expect(res.status(), `create ${full_name}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

/** An approved schedule with one group (Ana + Rui); No-Avail stays unallocated. */
async function approveTinySchedule() {
  const schedule = must(await db.from("schedules").insert({ status: "approved", ...TERM, approved_at: new Date().toISOString() })
    .select("id").single(), "insert schedule") as { id: string };
  const group = must(await db.from("class_groups").insert({
    schedule_id: schedule.id, name: GROUP, goal: "school_support", school_year: 5, weekday: 1, start_time: "08:00", duration_min: 90,
  }).select("id").single(), "insert group") as { id: string };
  must(await db.from("group_members").insert([ids.ana, ids.rui].map((student_id) => ({ group_id: group.id, student_id }))).select(), "insert members");

  const row = (date: string, extra: object = {}) =>
    ({ group_id: group.id, date, start_time: "08:00", end_time: "09:30", status: "scheduled", modality: "in_person", ...extra });
  const billed = MONTH ? [row(MONTH), row(addDays(MONTH, 7))] : [];
  const sessions = must(await db.from("sessions").insert([row(TODAY), row(IN_3_DAYS, { modality: "online" }), ...billed])
    .select("id, date"), "insert sessions") as { id: string; date: string }[];
  ids.today = sessions.find((s) => s.date === TODAY)!.id;
  ids.upcoming = sessions.find((s) => s.date === IN_3_DAYS)!.id;

  must(await db.from("notifications").insert({
    student_id: ids.ana, type: "cancellation", recipient: "student", phone: "+351912345678", message: "Dashboard E2E", session_id: ids.upcoming,
  }).select(), "insert notification");
}

test.beforeAll(async ({}, info) => {
  const client = adminClient();
  test.skip(!client, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to run the dashboard E2E spec.");
  db = client!;
  test.skip(await hasApprovedSchedule(db), "An approved schedule already exists; this spec refuses to touch real term data.");
  snapshot = await snapshotDraft(db);
  ready = true;
  api = await playwrightRequest.newContext({ baseURL: info.project.use.baseURL, storageState: AUTH_STATE });

  ids.ana = await createStudent(ANA);
  ids.rui = await createStudent(RUI);
  ids.noav = await createStudent(NOAV, { availability: [] });
});

test.afterAll(async () => {
  if (ready) await cleanUp(db, snapshot);
  await api?.dispose();
});

test("before approval: no classes yet, and students missing availability link to their edit page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "No classes yet" })).toBeVisible();
  const alert = page.getByTestId("alert-missing-availability");
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("link", { name: `${NOAV} — add availability` })).toHaveAttribute("href", `/students/${ids.noav}/edit`);
});

test("AC-8.1 after approval: today, next 7 days, counters and alerts match the other pages", async ({ page }) => {
  await approveTinySchedule();
  await page.goto("/dashboard"); // the lazy sync bills the last completed month on this load

  // (1) Today + (2) next 7 days.
  const today = page.getByTestId("today-sessions").getByTestId("dashboard-session");
  await expect(today).toHaveCount(1);
  await expect(today).toContainText(GROUP);
  await expect(today).toContainText("08:00–09:30");
  const upcoming = page.getByTestId("upcoming-sessions");
  await expect(upcoming.getByRole("heading", { name: formatShortDate(IN_3_DAYS) })).toBeVisible();
  await expect(upcoming.getByTestId("dashboard-session").filter({ hasText: GROUP })).toContainText("Online");

  // (3) Payment counters = the stored unpaid charges, labelled as on the Payments page.
  const unpaid = must(await db.from("payments").select("month, status").eq("status", "unpaid"), "read payments") as { month: string; status: "unpaid" }[];
  const overdueCount = unpaid.filter((p) => isOverdue(p, TODAY)).length;
  expect(unpaid.length).toBe(MONTH ? 2 : 0);
  await expect(page.getByTestId("count-unpaid")).toHaveText(String(unpaid.length - overdueCount));
  await expect(page.getByTestId("count-overdue")).toHaveText(String(overdueCount));

  // (4) Alerts: pending notifications (incl. overdue ones the sync just created) and unallocated students.
  const { count: pending } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("status", "pending");
  await expect(page.getByTestId("alert-notifications")).toContainText(`${pending} notification`);
  await expect(page.getByTestId("alert-unallocated")).toContainText(`${NOAV} — No availability yet`);
  await expect(page.getByTestId("alert-missing-availability")).toHaveCount(0);

  await page.getByRole("link", { name: "Open pending notifications" }).click();
  await expect(page).toHaveURL(/\/notifications\?status=pending$/);
  await expect(page.getByTestId("notification-row")).toHaveCount(pending ?? 0);

  if (MONTH) {
    await page.goto("/dashboard");
    const status = overdueCount > 0 ? "overdue" : "unpaid";
    await page.getByRole("link", { name: new RegExp(`^2 ${status} payments`) }).click();
    await expect(page).toHaveURL(new RegExp(`/payments\\?month=${MONTH.slice(0, 7)}&status=${status}$`));
    await expect(page.getByTestId("payment-row").filter({ visible: true })).toHaveCount(2);
  }
});

test("Take attendance opens the session's panel on the Attendance page", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: `Take attendance: ${GROUP}, 08:00–09:30` }).click();
  await expect(page).toHaveURL(`/attendance?date=${TODAY}&session=${ids.today}`);
  const panel = page.getByTestId("session-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: GROUP })).toBeVisible();
  await expect(panel).toContainText(ANA);

  await panel.getByRole("button", { name: "Close session panel" }).click();
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(`/attendance?date=${TODAY}`);
});
