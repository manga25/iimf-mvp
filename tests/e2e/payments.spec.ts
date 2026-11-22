import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, formatShortDate, isoWeekday, lisbonToday } from "../../src/lib/calendar/dates";
import { addMonths, completedTermMonths, formatAmount, formatHours, isOverdue } from "../../src/lib/payments/months";
import { termFor } from "../../src/lib/schedule/term";
import { AUTH_STATE } from "./helpers";
import { adminClient, cleanUp, E2E_PREFIX, hasApprovedSchedule, snapshotDraft, type DraftSnapshot } from "./schedule-admin";

// AC-6.7 (with the lazy generation of AC-6.4/6.6 seen from the UI). Runs in its own project after
// the attendance spec, one test at a time. It builds a tiny approved schedule whose group met on
// every Monday of the last completed month; the first page load bills it. afterAll cleans up.
test.describe.configure({ mode: "serial" });
test.use({ storageState: AUTH_STATE });

const TODAY = lisbonToday();
const TERM = termFor(new Date());
const MONTH = completedTermMonths(TERM, TODAY)[0]; // undefined in September (no completed month yet)
const MONDAYS = MONTH
  ? Array.from({ length: 31 }, (_, i) => addDays(MONTH, i)).filter((d) => d < addMonths(MONTH, 1) && isoWeekday(d) === 1)
  : [];
const OVERDUE = MONTH ? isOverdue({ status: "unpaid", month: MONTH }, TODAY) : false;
const UNPAID_BADGE = OVERDUE ? "Overdue" : "Unpaid";

const GROUP = `${E2E_PREFIX} Pay Year 3 · A`;
const ANA = `${E2E_PREFIX} Pay Ana`;
const RUI = `${E2E_PREFIX} Pay Rui`;

let db: SupabaseClient;
let api: APIRequestContext;
let snapshot: DraftSnapshot = null;
let ready = false;
const ids: { ana?: string; firstSession?: string } = {};

const must = <T>({ data, error }: { data: T | null; error: { message: string } | null }, op: string): T => {
  if (error || data === null) throw new Error(`${op}: ${error?.message ?? "no data"}`);
  return data;
};

async function createStudent(full_name: string, extra: object = {}) {
  const res = await api.post("/api/students", { data: { full_name, phone: "912345678", goal: "school_support", school_year: 3, availability: [], ...extra } });
  expect(res.status(), `create ${full_name}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test.beforeAll(async ({}, info) => {
  test.skip(!MONTH, "No term month has been completed yet (September), so there is nothing to bill.");
  const client = adminClient();
  test.skip(!client, "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to run the payments E2E spec.");
  db = client!;
  test.skip(await hasApprovedSchedule(db), "An approved schedule already exists; this spec refuses to touch real term data.");
  snapshot = await snapshotDraft(db);
  ready = true;
  api = await playwrightRequest.newContext({ baseURL: info.project.use.baseURL, storageState: AUTH_STATE });

  ids.ana = await createStudent(ANA, { guardian_name: "Rita Guardian", guardian_phone: "934567890" });
  const rui = await createStudent(RUI);
  const schedule = must(await db.from("schedules").insert({ status: "approved", ...TERM, approved_at: new Date().toISOString() })
    .select("id").single(), "insert schedule") as { id: string };
  const group = must(await db.from("class_groups").insert({
    schedule_id: schedule.id, name: GROUP, goal: "school_support", school_year: 3, weekday: 1, start_time: "18:00", duration_min: 90,
  }).select("id").single(), "insert group") as { id: string };
  must(await db.from("group_members").insert([ids.ana, rui].map((student_id) => ({ group_id: group.id, student_id }))).select(), "insert members");
  const sessions = must(await db.from("sessions")
    .insert(MONDAYS.map((date) => ({ group_id: group.id, date, start_time: "18:00", end_time: "19:30" }))).select("id, date"), "insert sessions") as
    { id: string; date: string }[];
  ids.firstSession = sessions.find((s) => s.date === MONDAYS[0])!.id;
});

test.afterAll(async () => {
  if (ready) await cleanUp(db, snapshot);
  await api?.dispose();
});

const row = (page: Page, name: string) => page.getByTestId("payment-row").filter({ hasText: name }).filter({ visible: true });
const payment = async () =>
  must(await db.from("payments").select("id, hours, amount, status, paid_at").eq("student_id", ids.ana!).eq("month", MONTH).single(), "read payment") as
    { id: string; hours: number; amount: number; status: string; paid_at: string | null };
const overdueNotes = async (paymentId: string) =>
  must(await db.from("notifications").select("status, recipient").eq("payment_id", paymentId).eq("type", "overdue"), "read notifications") as
    { status: string; recipient: string }[];

const full = { hours: formatHours(MONDAYS.length * 1.5), amount: formatAmount(MONDAYS.length * 15) };
const minusOne = { hours: formatHours((MONDAYS.length - 1) * 1.5), amount: formatAmount((MONDAYS.length - 1) * 15) };

test("AC-6.7 marking Paid stores the date, freezes the amount and dismisses the overdue message", async ({ page }) => {
  await page.goto("/payments");
  const ana = row(page, ANA);
  await expect(ana).toContainText(`${full.amount} €`);
  await expect(ana).toContainText(full.hours);
  await expect(ana).toContainText(UNPAID_BADGE);
  const before = await payment();
  expect(await overdueNotes(before.id)).toEqual(OVERDUE ? [{ status: "pending", recipient: "guardian" }] : []);

  await ana.getByRole("button", { name: /^Mark as paid/ }).click();
  const dialog = page.getByRole("dialog", { name: "Mark this payment as paid?" });
  await expect(dialog.getByLabel("Payment date")).toHaveValue(TODAY);
  await dialog.getByRole("button", { name: "Mark as paid" }).click();
  await expect(dialog).toBeHidden();
  await expect(ana).toContainText("Paid");
  await expect(ana).toContainText(formatShortDate(TODAY));

  expect(await payment()).toMatchObject({ status: "paid", paid_at: TODAY, amount: MONDAYS.length * 15 });
  if (OVERDUE) expect(await overdueNotes(before.id)).toEqual([{ status: "dismissed", recipient: "guardian" }]);

  // A later attendance change does not alter a paid amount.
  must(await db.from("attendance").insert({ session_id: ids.firstSession, student_id: ids.ana, status: "absent" }).select(), "mark absent");
  await page.reload();
  await expect(row(page, ANA)).toContainText(`${full.amount} €`);
});

test("the status filter and month totals reflect paid and unpaid charges", async ({ page }) => {
  await page.goto(`/payments?month=${MONTH.slice(0, 7)}&status=paid`);
  await expect(row(page, ANA)).toBeVisible();
  await expect(row(page, RUI)).toHaveCount(0);
  await expect(page.getByTestId("total-expected")).toHaveText(`${formatAmount(MONDAYS.length * 30)} €`);
  await expect(page.getByTestId("total-received")).toHaveText(`${full.amount} €`);

  await page.getByLabel("Status").selectOption(OVERDUE ? "overdue" : "unpaid");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(row(page, RUI)).toBeVisible();
  await expect(row(page, ANA)).toHaveCount(0);
});

test("Mark as unpaid asks for confirmation, clears the date and recalculates from attendance", async ({ page }) => {
  await page.goto("/payments");
  const ana = row(page, ANA);
  await ana.getByRole("button", { name: /^Mark as unpaid/ }).click();
  const dialog = page.getByRole("dialog", { name: "Mark this payment as unpaid?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect((await payment()).status).toBe("paid");

  await ana.getByRole("button", { name: /^Mark as unpaid/ }).click();
  await dialog.getByRole("button", { name: "Mark as unpaid" }).click();
  await expect(dialog).toBeHidden();
  await expect(ana).toContainText(UNPAID_BADGE);
  await expect(ana).toContainText(`${minusOne.amount} €`);
  expect(await payment()).toMatchObject({ status: "unpaid", paid_at: null, amount: (MONDAYS.length - 1) * 15 });
});
