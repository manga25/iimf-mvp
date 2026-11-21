import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
const SCHEDULE_SPEC = /schedule\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"], testIgnore: SCHEDULE_SPEC },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 740 } },
      dependencies: ["setup"],
      testIgnore: SCHEDULE_SPEC,
    },
    // Approving the schedule locks students, so this spec runs alone, after every other project.
    { name: "schedule", use: { ...devices["Desktop Chrome"] }, dependencies: ["desktop", "mobile"], testMatch: SCHEDULE_SPEC },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
