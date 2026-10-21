import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-phone", use: { ...devices["Pixel 5"] } },
  ],
  webServer: [
    {
      command:
        "npm --workspace=apps/web-landing run preview -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "npm --workspace=apps/mobile-app run preview -- --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "npm --workspace=apps/web-admin run preview -- --host 127.0.0.1 --port 4175",
      url: "http://127.0.0.1:4175",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "npm --workspace=apps/p2p-panel run preview -- --host 127.0.0.1 --port 4176",
      url: "http://127.0.0.1:4176",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
