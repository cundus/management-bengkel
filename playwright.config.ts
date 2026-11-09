import { defineConfig, devices } from "@playwright/test";

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ||
  "postgresql://wmc:wmc@localhost:5432/wmc225_e2e?schema=public";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      WMC225_DATABASE_URL: e2eDatabaseUrl,
      APP_TIMEZONE: "Asia/Jakarta",
    },
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        storageState: "playwright/.auth/user.json",
      },
    },
  ],
});
