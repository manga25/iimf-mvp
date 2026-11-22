import { expect, test } from "@playwright/test";
import { AUTH_STATE, NAV_LABELS, menuButton, openNavIfMobile, sidebar } from "./helpers";

test.use({ storageState: AUTH_STATE });

const isMobile = (w: number | undefined) => (w ?? 1280) < 1024;

test.describe("sidebar layout", () => {
  test("lists the 6 sections and highlights the active one", async ({ page }) => {
    await page.goto("/payments");
    await openNavIfMobile(page);
    const nav = sidebar(page).getByRole("navigation", { name: "Sections" });

    await expect(nav.getByRole("link")).toHaveText(NAV_LABELS);
    await expect(nav.getByRole("link", { name: "Payments" })).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test("navigates between every section", async ({ page }) => {
    await page.goto("/dashboard");
    for (const label of NAV_LABELS) {
      await openNavIfMobile(page);
      await sidebar(page).getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}$`));
      await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    }
  });

  test("shows a 404 page inside the app layout for unknown URLs", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await openNavIfMobile(page);
    await expect(sidebar(page).getByRole("navigation", { name: "Sections" }).getByRole("link")).toHaveText(NAV_LABELS);
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Go to the Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto("/students");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("desktop", () => {
  test("shows a fixed sidebar without a menu button", async ({ page, viewport }) => {
    test.skip(isMobile(viewport?.width), "desktop only");
    await page.goto("/dashboard");
    await expect(sidebar(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });
});

test.describe("mobile drawer (375px)", () => {
  test.beforeEach(({ viewport }) => test.skip(!isMobile(viewport?.width), "mobile only"));

  test("is hidden until opened, and closes with Escape returning focus", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(sidebar(page)).toBeHidden();

    const toggle = page.getByRole("button", { name: "Open menu" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(sidebar(page)).toBeVisible();
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(sidebar(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  });

  test("is keyboard operable and closes after choosing a section", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open menu" }).focus();
    await page.keyboard.press("Enter");
    await expect(sidebar(page)).toBeVisible();

    // Focus moved into the drawer; Tab stays inside it.
    await expect(sidebar(page).locator(":focus")).toHaveCount(1);
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    await expect(sidebar(page).locator(":focus")).toHaveCount(1);

    await sidebar(page).getByRole("link", { name: "Schedule" }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(sidebar(page)).toBeHidden();
  });
});
