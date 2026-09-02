import { defineConfig, devices } from "@playwright/test";

const usesExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 15"] }
    },
    {
      name: "Desktop Chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  ...(usesExternalServer
    ? {}
    : {
      webServer: {
        command:
          "node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
    })
});
