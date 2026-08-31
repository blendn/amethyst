import { defineConfig } from "@playwright/test";

const webBaseUrl = "http://127.0.0.1:5174";
const apiBaseUrl = "http://127.0.0.1:3101";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://amethyst:amethyst_test@127.0.0.1:55432/amethyst_test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: webBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:e2e",
    url: `${webBaseUrl}/api/v1/health/ready`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      PORT: "3101",
      DATABASE_URL: testDatabaseUrl,
      WEB_ORIGIN: webBaseUrl,
      AUTH_PEPPER: "e2e-test-pepper-that-is-at-least-32-bytes",
      SESSION_TTL_HOURS: "1",
      VITE_API_TARGET: apiBaseUrl,
    },
  },
});
