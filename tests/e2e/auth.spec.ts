import { expect, test, type Page } from "@playwright/test";
import { openNavIfMobile } from "./helpers";

// Next.js renders its own (empty) role="alert" route announcer, so target the form error.
const loginError = (page: Page) => page.locator("#login-error");

const EMAIL = process.env.E2E_TEACHER_EMAIL;
const PASSWORD = process.env.E2E_TEACHER_PASSWORD;

test.describe("AC-1.1 unauthenticated access", () => {
  for (const path of ["/", "/dashboard", "/students", "/payments"]) {
    test(`redirects ${path} to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    });
  }

  test("API routes return 401 JSON", async ({ request }) => {
    const res = await request.get("/api/students");
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: expect.stringMatching(/log in/i) });
  });
});

test.describe("AC-1.2 login", () => {
  test("shows an error and stays on /login with invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(loginError(page)).toContainText(/incorrect email or password/i);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Email")).toHaveValue("nobody@example.com");
  });

  test("shows a validation error when fields are empty", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(loginError(page)).toContainText(/enter your email and password/i);
  });

  test("lands on the Dashboard with valid credentials, then logs out", async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, "Set E2E_TEACHER_EMAIL and E2E_TEACHER_PASSWORD in .env.local");

    await page.goto("/login");
    await page.getByLabel("Email").fill(EMAIL!);
    await page.getByLabel("Password").fill(PASSWORD!);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    // A logged-in teacher visiting /login is sent back to the Dashboard.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);

    await openNavIfMobile(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
