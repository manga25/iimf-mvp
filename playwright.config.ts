import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
const SCHEDULE_SPEC = /schedule\.spec\.ts/;
const CALENDAR_SPEC = /calendar\.spec\.ts/;
const ATTENDANCE_SPEC = /attendance\.spec\.ts/;
const SOLO_SPECS = [SCHEDULE_SPEC, CALENDAR_SPEC, ATTENDANCE_SPEC];

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"], testIgnore: SOLO_SPECS },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 740 } },
      dependencies: ["setup"],
      testIgnore: SOLO_SPECS,
    },
    // Approving the schedule locks students, so these specs run alone, after every other project.
    { name: "schedule", use: { ...devices["Desktop Chrome"] }, dependencies: ["desktop", "mobile"], testMatch: SCHEDULE_SPEC },
    { name: "calendar", use: { ...devices["Desktop Chrome"] }, dependencies: ["schedule"], testMatch: CALENDAR_SPEC },
    { name: "attendance", use: { ...devices["Desktop Chrome"] }, dependencies: ["calendar"], testMatch: ATTENDANCE_SPEC },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
