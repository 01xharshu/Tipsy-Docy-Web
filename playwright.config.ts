import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_STATIC
      ? "http://127.0.0.1:4173"
      : "http://127.0.0.1:3000",
    channel: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_STATIC
      ? "PORT=4173 node scripts/serve-static.mjs"
      : "npm run dev -- --hostname 127.0.0.1",
    url: process.env.E2E_STATIC
      ? "http://127.0.0.1:4173"
      : "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
