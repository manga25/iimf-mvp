import { expect, request as playwrightRequest, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { termFor } from "../../src/lib/schedule/term";
import { AUTH_STATE } from "./helpers";
import { adminClient, cleanUp, E2E_PREFIX, hasApprovedSchedule, snapshotDraft, type DraftSnapshot } from "./schedule-admin";

// AC-3.1, 3.9, 3.10, 3.11. Runs in its own Playwright project, after the others, one test at a time:
// approving is irreversible, so afterAll deletes every schedule + session and the E2E students,
// then restores the teacher's previous draft (tests/e2e/schedule-admin.ts).
test.describe.configure({ mode: "serial" });
test.use({ storageState: AUTH_STATE });

// 14 Year 1 students (no seed student is in Year 1) → the engine makes "Year 1 · A" and "Year 1 · B" with 7 each.
const COHORT = Array.from({ length: 14 }, (_, i) => `${E2E_PREFIX} ${String(i + 1).padStart(2, "0")}`);
const WEEKDAY_MORNINGS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: "08:00", end_time: "12:00" }));

let db: SupabaseClient;
let api: APIRequestContext;
let snapshot: DraftSnapshot = null;
let ready = false;

async function createStudent(full_name: string, availability: unknown[]) {
  const res = await api.post("/api/students", { data: { full_name, phone: "912345678", goal: "school_support", school_year: 1, availability } });
  expect(res.status(), `create ${full_name}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test.beforeAll(async ({}, info) => {
  const client = adminClient();
  test.skip(!client, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to run the schedule E2E spec.");
  db = client!;
  test.skip(await hasApprovedSchedule(db), "An approved schedule already exists; this spec refuses to touch real term data.");
  snapshot = await snapshotDraft(db);
  ready = true;
  api = await playwrightRequest.newContext({ baseURL: info.project.use.baseURL, storageState: AUTH_STATE });
  for (const name of COHORT) await createStudent(name, WEEKDAY_MORNINGS);
});

test.afterAll(async () => {
  if (ready) await cleanUp(db, snapshot);
  await api?.dispose();
});

const card = (page: Page, name: string) =>
  page.getByTestId("group-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
const members = (c: Locator) => c.getByTestId("member");
const generateButton = (page: Page) => page.getByRole("button", { name: /^(Generate draft|Regenerate)$/ });

async function generate(page: Page) {
  await page.goto("/schedule");
  const button = generateButton(page);
  const label = (await button.textContent())?.trim();
  await button.click();
  if (label === "Regenerate") {
    const dialog = page.getByRole("dialog", { name: "Regenerate the draft?" });
    await expect(dialog).toContainText("manual edits will be lost");
    await dialog.getByRole("button", { name: "Regenerate" }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(members(card(page, "Year 1 · A"))).toHaveCount(7);
  await expect(members(card(page, "Year 1 · B"))).toHaveCount(7);
}

async function removeMember(page: Page, group: Locator, name: string) {
  const before = await members(group).count();
  await group.getByRole("button", { name: `Remove ${name} from this class` }).click();
  await expect(members(group)).toHaveCount(before - 1);
}

test("AC-3.1 a student without availability blocks generation and is listed with a link", async ({ page }) => {
  const name = `${E2E_PREFIX} No availability`;
  const id = await createStudent(name, []);
  await page.goto("/schedule");
  const link = page.getByTestId("missing-availability").getByRole("link", { name: `${name} — add availability` });
  await expect(link).toHaveAttribute("href", `/students/${id}/edit`);
  await expect(generateButton(page)).toBeDisabled();
  expect((await api.post("/api/schedule/generate")).status()).toBe(400);

  await api.post(`/api/students/${id}/deactivate`);
  await page.reload();
  await expect(page.getByTestId("missing-availability")).toHaveCount(0);
  await expect(generateButton(page)).toBeEnabled();
});

test("generates a draft with balanced Year 1 groups (7 + 7) and fits a 375 px screen", async ({ page }) => {
  await generate(page);
  await expect(page.getByTestId("draft-status")).toContainText("Draft ·");
  await page.setViewportSize({ width: 375, height: 740 });
  await expect(card(page, "Year 1 · A")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("AC-3.9 an 8th member or an overlap is blocked with an error", async ({ page }) => {
  await page.goto("/schedule");
  const a = card(page, "Year 1 · A");
  const b = card(page, "Year 1 · B");
  const mover = (await members(b).first().locator("span").first().textContent())!.trim();

  await b.getByLabel(`Move ${mover} to`).selectOption({ label: "Year 1 · A" });
  await b.getByTestId("member").filter({ hasText: mover }).getByRole("button", { name: "Move", exact: true }).click();
  await expect(b.getByRole("alert")).toHaveText("This change can't be saved: Year 1 · A must have at most 7 students (it has 8).");
  await expect(members(a)).toHaveCount(7);
  await page.reload(); // clears the alert above so only the next one is matched

  const [, day, start] = /^(\w+) · (\d\d:\d\d)/.exec((await a.locator("header p").textContent())!.trim())!;
  await b.getByLabel("Day", { exact: true }).selectOption({ label: day });
  await b.getByLabel("Start", { exact: true }).selectOption(start);
  await b.getByRole("button", { name: "Change time" }).click();
  await expect(b.getByRole("alert")).toContainText("overlaps with");
  await page.reload();
  await expect(members(card(page, "Year 1 · B"))).toHaveCount(7);
});

test("AC-3.9 a group of 2 or a time outside availability shows a warning but is saved", async ({ page }) => {
  await page.goto("/schedule");
  const b = card(page, "Year 1 · B");
  for (let i = 0; i < 5; i++) {
    const name = (await members(b).first().locator("span").first().textContent())!.trim();
    await removeMember(page, b, name);
  }
  await expect(b).toContainText("Warning: Year 1 · B has only 2 students (minimum 3 recommended).");

  await b.getByLabel("Day", { exact: true }).selectOption({ label: "Sunday" });
  await b.getByLabel("Start", { exact: true }).selectOption("08:00");
  await b.getByRole("button", { name: "Change time" }).click();
  await expect(b.locator("header p")).toContainText("Sunday · 08:00–09:30");

  await page.reload();
  const saved = card(page, "Year 1 · B");
  await expect(members(saved)).toHaveCount(2);
  await expect(saved).toContainText("is on a weekend (Sunday)");
  await expect(saved.getByText(/is not available for the whole Year 1 · B class/)).toHaveCount(2);
  await expect(page.getByTestId("unallocated").filter({ hasText: "Removed manually" })).toHaveCount(5);
});

test("AC-3.10 Regenerate asks for confirmation and replaces the draft", async ({ page }) => {
  await page.goto("/schedule");
  await generateButton(page).click();
  const dialog = page.getByRole("dialog", { name: "Regenerate the draft?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(members(card(page, "Year 1 · B"))).toHaveCount(2); // cancelled: nothing changed

  await generate(page);
  await expect(page.getByTestId("unallocated").filter({ hasText: E2E_PREFIX })).toHaveCount(0);
});

test("AC-3.11 approval is impossible with hard errors", async ({ page }) => {
  await page.goto("/schedule");
  const a = card(page, "Year 1 · A");
  const name = (await members(a).first().locator("span").first().textContent())!.trim();
  const { data } = await db.from("students").select("id").eq("full_name", name).single();
  await api.post(`/api/students/${data!.id}/deactivate`);

  await page.reload();
  await expect(page.getByRole("button", { name: "Approve schedule" })).toBeDisabled();
  await expect(page.getByText("Fix the error before approving.")).toBeVisible();
  await expect(card(page, "Year 1 · A")).toContainText(`Error: ${name} has been deactivated.`);
  expect((await api.post("/api/schedule/approve")).status()).toBe(400);

  await removeMember(page, card(page, "Year 1 · A"), name);
  await expect(page.getByRole("button", { name: "Approve schedule" })).toBeEnabled();
});

test("AC-3.11 approving creates a session for every week of the term and makes Schedule and Students read-only", async ({ page }) => {
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Approve schedule" }).click();
  const dialog = page.getByRole("dialog", { name: "Approve the schedule?" });
  await expect(dialog.getByTestId("approve-summary")).toContainText("Classes");
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Schedule approved")).toBeVisible();
  await expect(generateButton(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change time" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);

  const { data: schedule } = await db.from("schedules").select("id, term_start, term_end").eq("status", "approved").single();
  const term = termFor(new Date());
  expect(schedule).toMatchObject(term);
  const { data: groups } = await db.from("class_groups").select("id, weekday, sessions(date)").eq("schedule_id", schedule!.id);
  expect(groups!.length).toBeGreaterThan(0);
  for (const g of groups as { weekday: number; sessions: { date: string }[] }[]) {
    const dates = g.sessions.map((s) => s.date).sort();
    expect(dates.length).toBe(weeksOf(g.weekday, term.term_start, term.term_end));
    expect(dates[0] >= term.term_start && dates.at(-1)! <= term.term_end).toBe(true);
  }

  expect((await api.post("/api/schedule/generate")).status()).toBe(409);
  expect((await api.post("/api/students", { data: {} })).status()).toBe(409);
  await page.goto("/students");
  await expect(page.getByText("Students are read-only for this term")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add student" })).toHaveCount(0);
});

/** Number of dates with ISO weekday `weekday` in [start, end]. */
function weeksOf(weekday: number, start: string, end: string) {
  let n = 0;
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    if (((d.getUTCDay() + 6) % 7) + 1 === weekday) n++;
  }
  return n;
}
