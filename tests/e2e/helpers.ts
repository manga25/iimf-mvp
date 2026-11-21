import type { Page } from "@playwright/test";

export const AUTH_STATE = "playwright/.auth/teacher.json";
export const NAV_LABELS = ["Dashboard", "Students", "Schedule", "Attendance", "Payments", "Notifications"];

export const menuButton = (page: Page) => page.getByRole("button", { name: /open menu|close menu/i }).first();
export const sidebar = (page: Page) => page.getByRole("complementary", { name: "Main navigation" });

/** On mobile the sidebar is a drawer behind the menu button; open it if needed. */
export async function openNavIfMobile(page: Page) {
  const toggle = page.getByRole("button", { name: "Open menu" });
  if (await toggle.isVisible()) await toggle.click();
}
