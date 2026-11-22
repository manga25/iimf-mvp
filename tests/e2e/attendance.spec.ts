import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, lisbonToday, weekStart } from "../../src/lib/calendar/dates";
import { termFor } from "../../src/lib/schedule/term";
import { AUTH_STATE } from "./helpers";
import { adminClient, cleanUp, E2E_PREFIX, hasApprovedSchedule, snapshotDraft, type DraftSnapshot } from "./schedule-admin";

// AC-5.1, 5.2, 5.4 (UI), 5.5. Runs in its own project after the calendar spec, one test at a time.
// It builds a tiny approved schedule in the database: one past session (last Monday) and one
// future session (next Monday) of the same group; afterAll removes it with the shared clean-up.
test.describe.configure({ mode: "serial" });
test.use({ storageState: AUTH_STATE });

const PAST = addDays(weekStart(lisbonToday()), -7);
const FUTURE = addDays(weekStart(lisbonToday()), 7);
const GROUP = `${E2E_PREFIX} Att Year 2 · A`;
const ANA = `${E2E_PREFIX} Att Ana`;
const RUI = `${E2E_PREFIX} Att Rui`;
const EVA = `${E2E_PREFIX} Att Eva`;

let db: SupabaseClient;
let api: APIRequestContext;
let snapshot: DraftSnapshot = null;
let ready = false;
const sessionIds: Record<string, string> = {};

const must = <T>({ data, error }: { data: T | null; error: { message: string } | null }, op: string): T => {
  if (error || data === null) throw new Error(`${op}: ${error?.message ?? "no data"}`);
  return data;
};

async function createStudent(full_name: string, extra: object = {}) {
  const res = await api.post("/api/students", { data: { full_name, phone: "912345678", goal: "school_support", school_year: 2, availability: [], ...extra } });
  expect(res.status(), `create ${full_name}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test.beforeAll(async ({}, info) => {
  const client = adminClient();
  test.skip(!client, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to run the attendance E2E spec.");
  db = client!;
  test.skip(await hasApprovedSchedule(db), "An approved schedule already exists; this spec refuses to touch real term data.");
  snapshot = await snapshotDraft(db);
  ready = true;
  api = await playwrightRequest.newContext({ baseURL: info.project.use.baseURL, storageState: AUTH_STATE });

  const members = [
    await createStudent(ANA, { guardian_name: "Rita Guardian", guardian_phone: "934567890" }),
    await createStudent(RUI),
    await createStudent(EVA),
  ];
  const schedule = must(await db.from("schedules").insert({ status: "approved", ...termFor(new Date()), approved_at: new Date().toISOString() })
    .select("id").single(), "insert schedule") as { id: string };
  const group = must(await db.from("class_groups").insert({
    schedule_id: schedule.id, name: GROUP, goal: "school_support", school_year: 2, weekday: 1, start_time: "18:00", duration_min: 90,
  }).select("id").single(), "insert group") as { id: string };
  must(await db.from("group_members").insert(members.map((student_id) => ({ group_id: group.id, student_id }))).select(), "insert members");
  for (const date of [PAST, FUTURE]) {
    const s = must(await db.from("sessions").insert({ group_id: group.id, date, start_time: "18:00", end_time: "19:30" })
      .select("id").single(), "insert session") as { id: string };
    sessionIds[date] = s.id;
  }
});

test.afterAll(async () => {
  if (ready) await cleanUp(db, snapshot);
  await api?.dispose();
});

async function openSession(page: Page, date: string) {
  await page.goto(`/attendance?date=${date}`);
  await page.getByTestId("week-view").getByTestId("session-card").filter({ hasText: GROUP }).click();
  const panel = page.getByRole("dialog", { name: GROUP });
  await expect(panel).toBeVisible();
  return panel;
}
const row = (panel: ReturnType<Page["getByRole"]>, name: string) => panel.locator(`[data-testid="attendance-row"][data-student="${name}"]`);
const attendanceRows = async () =>
  must(await db.from("attendance").select("student_id, status, remarks").eq("session_id", sessionIds[PAST]), "read attendance") as
    { status: string; remarks: string | null }[];
const absences = async () =>
  must(await db.from("notifications").select("recipient, phone, status, message").eq("session_id", sessionIds[PAST]).eq("type", "absence"), "read notifications") as
    { recipient: string; phone: string; status: string; message: string }[];

test("AC-5.1 a past session shows every student as Present with nothing to do", async ({ page }) => {
  const panel = await openSession(page, PAST);
  const rows = panel.getByTestId("attendance-row");
  await expect(rows).toHaveCount(3);
  for (const name of [ANA, RUI, EVA]) {
    await expect(row(panel, name)).toHaveAttribute("data-status", "present");
    await expect(row(panel, name).getByRole("button", { name: "Absent" })).toHaveAttribute("aria-pressed", "false");
  }
  expect(await attendanceRows()).toEqual([]);
});

test("AC-5.2 one click marks Absent (with student + guardian messages); clicking again returns to Present", async ({ page }) => {
  const panel = await openSession(page, PAST);
  const ana = row(panel, ANA);
  await ana.getByRole("button", { name: "Absent" }).click();
  await expect(ana).toHaveAttribute("data-status", "absent");
  await expect(ana.getByRole("button", { name: "Absent" })).toHaveAttribute("aria-pressed", "true");
  await expect(ana.getByRole("status")).toContainText("marked absent");

  const notes = await absences();
  expect(notes.map((n) => n.recipient).sort()).toEqual(["guardian", "student"]);
  expect(notes.every((n) => n.status === "pending" && n.message.includes(`${ANA} was absent`))).toBe(true);

  await ana.getByRole("button", { name: "Absent" }).click();
  await expect(ana).toHaveAttribute("data-status", "present");
  await expect(ana.getByRole("button", { name: "Absent" })).toHaveAttribute("aria-pressed", "false");
  expect(await absences()).toEqual([]);
  expect(await attendanceRows()).toEqual([]);

  await row(panel, EVA).getByRole("button", { name: "Late" }).click(); // Late is stored, no notifications
  await expect(row(panel, EVA)).toHaveAttribute("data-status", "late");
  expect(await absences()).toEqual([]);
});

test("AC-5.5 remarks are saved and shown when the session is reopened", async ({ page }) => {
  let panel = await openSession(page, PAST);
  await row(panel, RUI).getByLabel(`Remarks for ${RUI}`).fill("  Forgot the workbook  ");
  await row(panel, RUI).getByRole("button", { name: "Save remarks" }).click();
  await expect(row(panel, RUI).getByText("Remarks saved")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await page.reload();
  panel = await openSession(page, PAST);
  await expect(row(panel, RUI).getByLabel(`Remarks for ${RUI}`)).toHaveValue("Forgot the workbook");
  await expect(row(panel, RUI)).toHaveAttribute("data-status", "present");
  expect(await attendanceRows()).toContainEqual(expect.objectContaining({ status: "present", remarks: "Forgot the workbook" }));
});

test("AC-5.4 a future session lists its students without attendance controls", async ({ page }) => {
  const panel = await openSession(page, FUTURE);
  await expect(panel).toContainText("Attendance can be marked from the day of the session.");
  await expect(panel.getByTestId("panel-students").locator("li")).toHaveCount(3);
  await expect(panel.getByRole("button", { name: "Absent" })).toHaveCount(0);
});
