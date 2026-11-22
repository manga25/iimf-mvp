import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { endTime } from "../../src/components/schedule/goalStyles";
import { addDays, lisbonToday, weekStart } from "../../src/lib/calendar/dates";
import { termFor } from "../../src/lib/schedule/term";
import { AUTH_STATE } from "./helpers";
import { adminClient, cleanUp, E2E_PREFIX, hasApprovedSchedule, snapshotDraft, type DraftSnapshot } from "./schedule-admin";

// AC-4.1, 4.2 (UI), 4.3, 4.4. Runs in its own project after the schedule spec, one test at a time.
// It builds a tiny approved schedule directly in the database (next week: Monday group + Wednesday
// individual class) and afterAll removes it with the same clean-up as the schedule spec.
test.describe.configure({ mode: "serial" });
test.use({ storageState: AUTH_STATE });

const MONDAY = addDays(weekStart(lisbonToday()), 7); // next week → sessions are in the future
const WEDNESDAY = addDays(MONDAY, 2);
const GROUP = `${E2E_PREFIX} Cal Year 1 · A`;
const SOLO = `${E2E_PREFIX} Cal Individual`;
const BLOCK = `${E2E_PREFIX} Cal block`;

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
  const res = await api.post("/api/students", { data: { full_name, phone: "912345678", goal: "school_support", school_year: 1, availability: [], ...extra } });
  expect(res.status(), `create ${full_name}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function addClass(scheduleId: string, name: string, weekday: number, start: string, minutes: number, members: string[], date: string) {
  const goal = members.length === 1 ? { goal: "individual", school_year: null } : { goal: "school_support", school_year: 1 };
  const group = must(await db.from("class_groups").insert({ schedule_id: scheduleId, name, weekday, start_time: start, duration_min: minutes, ...goal })
    .select("id").single(), "insert group") as { id: string };
  must(await db.from("group_members").insert(members.map((student_id) => ({ group_id: group.id, student_id }))).select(), "insert members");
  const session = must(await db.from("sessions").insert({ group_id: group.id, date, start_time: start, end_time: endTime(start, minutes) }).select("id").single(), "insert session") as { id: string };
  sessionIds[name] = session.id;
}

test.beforeAll(async ({}, info) => {
  const client = adminClient();
  test.skip(!client, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to run the calendar E2E spec.");
  db = client!;
  test.skip(await hasApprovedSchedule(db), "An approved schedule already exists; this spec refuses to touch real term data.");
  snapshot = await snapshotDraft(db);
  ready = true;
  api = await playwrightRequest.newContext({ baseURL: info.project.use.baseURL, storageState: AUTH_STATE });

  const members = [
    await createStudent(`${E2E_PREFIX} Cal Ana`, { guardian_name: "Rita Guardian", guardian_phone: "934567890" }),
    await createStudent(`${E2E_PREFIX} Cal Rui`),
    await createStudent(`${E2E_PREFIX} Cal Eva`),
  ];
  const solo = await createStudent(`${E2E_PREFIX} Cal Solo`, { goal: "individual", school_year: undefined });

  const term = termFor(new Date());
  const schedule = must(await db.from("schedules").insert({ status: "approved", ...term, approved_at: new Date().toISOString() })
    .select("id").single(), "insert schedule") as { id: string };
  await addClass(schedule.id, GROUP, 1, "18:00", 90, members, MONDAY);
  await addClass(schedule.id, SOLO, 3, "10:00", 60, [solo], WEDNESDAY);
});

test.afterAll(async () => {
  if (ready) await cleanUp(db, snapshot);
  await api?.dispose();
});

const weekCards = (page: Page) => page.getByTestId("week-view").getByTestId("session-card");
const notificationsOf = async (sessionId: string) =>
  must(await db.from("notifications").select("type, recipient, phone, message, status").eq("session_id", sessionId), "read notifications") as
    { type: string; recipient: string; phone: string; message: string; status: string }[];

async function openSession(page: Page, name: string) {
  await weekCards(page).filter({ hasText: name }).click();
  const panel = page.getByRole("dialog", { name });
  await expect(panel).toBeVisible();
  return panel;
}

test("AC-4.1 the week view shows every session of the week on desktop", async ({ page }) => {
  await page.goto(`/attendance?date=${MONDAY}`);
  await expect(page.getByTestId("week-view")).toBeVisible();
  await expect(page.getByTestId("day-view")).toBeHidden();
  await expect(weekCards(page)).toHaveCount(2);
  await expect(page.getByTestId("week-view").locator(`[data-date="${WEDNESDAY}"]`)).toContainText(SOLO);

  await page.getByRole("link", { name: "Next week →" }).click();
  await expect(weekCards(page)).toHaveCount(0);
});

test("AC-4.1 a 375 px screen shows the day view with day navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto(`/attendance?date=${MONDAY}`);
  const day = page.getByTestId("day-view");
  await expect(day).toBeVisible();
  await expect(page.getByTestId("week-view")).toBeHidden();
  await expect(day.getByTestId("session-card")).toHaveCount(1);
  await expect(day).toContainText(GROUP);

  await page.getByRole("link", { name: "Next day" }).click();
  await expect(page).toHaveURL(new RegExp(`date=${addDays(MONDAY, 1)}`));
  await page.getByRole("link", { name: "Next day" }).click();
  await expect(day).toContainText(SOLO);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("AC-4.4 changing a session to Online shows the badge and creates one notification per student", async ({ page }) => {
  await page.goto(`/attendance?date=${MONDAY}`);
  const panel = await openSession(page, GROUP);
  await expect(panel.getByTestId("panel-students").locator("li")).toHaveCount(3);
  await panel.getByRole("button", { name: "Change to Online" }).click();
  await expect(panel.getByRole("status")).toContainText("Changed to Online. 3 notifications added");
  await expect(panel.getByRole("button", { name: "Change to In-Person" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(weekCards(page).filter({ hasText: GROUP })).toContainText("Online");

  const notes = await notificationsOf(sessionIds[GROUP]);
  expect(notes).toHaveLength(3);
  expect(notes.every((n) => n.type === "modality_change" && n.status === "pending" && n.message.includes("will be online."))).toBe(true);
  expect(notes.filter((n) => n.recipient === "guardian")).toEqual([
    expect.objectContaining({ phone: "+351934567890", message: expect.stringMatching(/^Hello Rita Guardian,/) }),
  ]);
});

test("AC-4.3 cancelling a session asks for confirmation and creates one cancellation per student", async ({ page }) => {
  await page.goto(`/attendance?date=${MONDAY}`);
  const panel = await openSession(page, GROUP);
  await panel.getByRole("button", { name: "Cancel session" }).click();
  const confirm = page.getByRole("dialog", { name: "Cancel this session?" });
  await confirm.getByRole("button", { name: "Keep session" }).click();
  await expect(confirm).toBeHidden();
  expect((await notificationsOf(sessionIds[GROUP])).filter((n) => n.type === "cancellation")).toHaveLength(0);

  await panel.getByRole("button", { name: "Cancel session" }).click();
  await confirm.getByRole("button", { name: "Cancel session" }).click();
  await expect(confirm).toBeHidden();
  await expect(panel).toContainText("This session is cancelled.");
  await expect(weekCards(page).filter({ hasText: GROUP })).toHaveAttribute("data-status", "cancelled");

  const cancellations = (await notificationsOf(sessionIds[GROUP])).filter((n) => n.type === "cancellation");
  expect(cancellations).toHaveLength(3);
  expect(cancellations.map((n) => n.recipient).sort()).toEqual(["guardian", "student", "student"]);
});

test("AC-4.2 a blocked period cancels overlapping sessions without notifications; deleting it restores them", async ({ page }) => {
  await page.goto(`/attendance?date=${MONDAY}`);
  await page.getByRole("button", { name: "Block period" }).click();
  await page.getByLabel("Starts").fill(`${WEDNESDAY}T00:00`);
  await page.getByLabel("Ends").fill(`${WEDNESDAY}T23:30`);
  await page.getByLabel("Reason").fill(BLOCK);
  await page.getByRole("button", { name: "Save blocked period" }).click();
  await expect(page.getByText(`“${BLOCK}” was blocked.`)).toBeVisible();

  const solo = weekCards(page).filter({ hasText: SOLO });
  await expect(solo).toHaveAttribute("data-status", "cancelled");
  await expect(page.getByTestId("week-view").locator(`[data-date="${WEDNESDAY}"]`).getByTestId("blocked-band")).toContainText(BLOCK);
  expect(await notificationsOf(sessionIds[SOLO])).toHaveLength(0);

  await page.getByRole("button", { name: `Delete blocked period ${BLOCK}` }).click();
  await page.getByRole("dialog", { name: "Delete this blocked period?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("blocked-item").filter({ hasText: BLOCK })).toHaveCount(0);
  await expect(solo).toHaveAttribute("data-status", "scheduled");
  expect(await notificationsOf(sessionIds[SOLO])).toHaveLength(0);
});
