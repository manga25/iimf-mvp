import { expect, test, type Page } from "@playwright/test";
import { AUTH_STATE } from "./helpers";

test.use({ storageState: AUTH_STATE });

// Every student created here gets a unique "E2E …" name and is deactivated at the end,
// so test data never ends up in schedule generation.
const uniqueName = (label: string, project: string) => `E2E ${label} ${project} ${Date.now().toString(36)}`;
const idFromUrl = (page: Page) => new URL(page.url()).pathname.split("/")[2];
const deactivateViaApi = (page: Page, id: string) => page.request.post(`/api/students/${id}/deactivate`);
const cell = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
// The section heading is also named "Goal", so target the select by role.
const goalSelect = (page: Page) => page.getByRole("combobox", { name: "Goal", exact: true });

/** Raw mouse events don't retry like locator actions, so wait until the grid is interactive. */
async function waitForGrid(page: Page) {
  const probe = cell(page, "Sunday 19:30–20:00");
  await expect(async () => {
    await probe.click();
    await expect(probe).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass();
  await probe.click();
  await expect(probe).toHaveAttribute("aria-pressed", "false");
}

async function createViaApi(page: Page, full_name: string) {
  const res = await page.request.post("/api/students", {
    data: { full_name, phone: "912345678", goal: "individual", availability: [{ weekday: 2, start_time: "10:00", end_time: "11:00" }] },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test("AC-2.1 create a Cambridge B2 student with availability; they appear in the list", async ({ page }, info) => {
  const name = uniqueName("Cambridge", info.project.name);
  await page.goto("/students");
  await page.getByRole("link", { name: "Add student" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add student" })).toBeVisible();

  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Phone", { exact: true }).fill("912345678");
  await goalSelect(page).selectOption("cambridge");
  await page.getByLabel("CEFR level").selectOption("B2");
  await waitForGrid(page);
  for (const t of ["09:00–09:30", "09:30–10:00", "10:00–10:30"]) await cell(page, `Monday ${t}`).click();
  await expect(cell(page, "Monday 09:30–10:00")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1.5 h per week selected")).toBeVisible();

  await page.getByRole("button", { name: "Create student" }).click();
  await expect(page).toHaveURL(/\/students\/[0-9a-f-]{36}$/);
  const id = idFromUrl(page);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  // The previously visited list stays mounted but hidden, so only match visible text.
  await expect(page.getByText("+351912345678").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Cambridge · B2").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("09:00–10:30").filter({ visible: true })).toBeVisible();

  await page.goto(`/students?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name }).filter({ visible: true })).toBeVisible();

  await deactivateViaApi(page, id);
});

test("AC-2.6 deactivating removes the student from the default (active) list", async ({ page }, info) => {
  const name = uniqueName("Deactivate", info.project.name);
  const id = await createViaApi(page, name);

  await page.goto(`/students/${id}`);
  await page.getByRole("button", { name: "Deactivate" }).click();
  const dialog = page.getByRole("dialog", { name: `Deactivate ${name}?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Deactivate" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deactivate" })).toBeHidden();

  await page.goto(`/students?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("No students match these filters")).toBeVisible();

  await page.goto(`/students?q=${encodeURIComponent(name)}&status=inactive`);
  await expect(page.getByRole("link", { name }).filter({ visible: true })).toBeVisible();
});

test("validation errors are shown next to the fields and nothing is saved", async ({ page }) => {
  await page.goto("/students/new");
  await page.getByLabel("Full name").fill("Ana Silva");
  await page.getByLabel("Phone", { exact: true }).fill("12345");
  await goalSelect(page).selectOption("school_support");
  await page.getByLabel("Guardian's name").fill("Maria Silva");
  await page.getByRole("button", { name: "Create student" }).click();

  const summary = page.getByRole("alert").filter({ hasText: "Please fix the highlighted fields" });
  await expect(summary).toHaveText("Please fix the highlighted fields and try again.");
  await expect(summary).toBeFocused();
  await expect(page.getByLabel("Phone", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/Enter a 9-digit Portuguese number/)).toBeVisible();
  await expect(page.getByText("Choose a school year for School Support students.")).toBeVisible();
  await expect(page.getByText("Enter the guardian's phone, or clear the guardian's name.")).toBeVisible();
  await expect(page).toHaveURL(/\/students\/new$/);
});

test("the running server rejects invalid students with field errors (AC-2.2–2.4)", async ({ page }) => {
  const res = await page.request.post("/api/students", {
    data: { full_name: "Ana Silva", phone: "12345", goal: "individual", cefr_level: "B2", guardian_name: "Maria" },
  });
  expect(res.status()).toBe(400);
  const body = (await res.json()) as { errors: Record<string, string> };
  expect(Object.keys(body.errors).sort()).toEqual(["cefr_level", "guardian_phone", "phone"]);
});

test.describe("availability grid", () => {
  test("is keyboard operable: Space toggles, arrows move, Shift+arrow copies", async ({ page }) => {
    await page.goto("/students/new");
    await waitForGrid(page);
    const first = cell(page, "Monday 08:00–08:30");
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Shift+ArrowDown");
    await expect(cell(page, "Monday 09:00–09:30")).toBeFocused();
    await expect(cell(page, "Monday 09:00–09:30")).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("ArrowRight");
    await expect(cell(page, "Tuesday 09:00–09:30")).toBeFocused();
    await expect(cell(page, "Tuesday 09:00–09:30")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Enter");
    await expect(cell(page, "Tuesday 09:00–09:30")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("2 h per week selected")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(cell(page, "Tuesday 09:00–09:30")).toHaveAttribute("aria-pressed", "false");
  });

  test("supports click-and-drag with the mouse", async ({ page, isMobile }) => {
    test.skip(isMobile, "drag painting is a mouse interaction");
    await page.goto("/students/new");
    await waitForGrid(page);
    const box = async (name: string) => (await cell(page, name).boundingBox())!;
    const from = await box("Wednesday 14:00–14:30");
    const to = await box("Wednesday 15:30–16:00");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    for (const t of ["14:00–14:30", "14:30–15:00", "15:00–15:30", "15:30–16:00"]) {
      await expect(cell(page, `Wednesday ${t}`)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.getByText("2 h per week selected")).toBeVisible();
  });

  test("fits a 375 px screen without horizontal page scroll", async ({ page }) => {
    await page.goto("/students/new");
    await expect(cell(page, "Sunday 19:30–20:00")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
