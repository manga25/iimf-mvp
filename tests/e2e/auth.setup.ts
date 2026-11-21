import { expect, test as setup } from "@playwright/test";
import { AUTH_STATE } from "./helpers";

// Logs in once and saves the session so layout tests don't hit Supabase's sign-in rate limit.
setup("log in as the teacher", async ({ page }) => {
  const email = process.env.E2E_TEACHER_EMAIL;
  const password = process.env.E2E_TEACHER_PASSWORD;
  if (!email || !password) throw new Error("Set E2E_TEACHER_EMAIL and E2E_TEACHER_PASSWORD in .env.local");

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().storageState({ path: AUTH_STATE });
});
