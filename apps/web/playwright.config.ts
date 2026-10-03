import { defineConfig, devices } from "@playwright/test";

// Requires the local stack: `pnpm db:start && pnpm stack:up`, the worker, and `pnpm dev`.
// Face fixtures are NOT in git: point E2E_PHOTOS_DIR at a folder of event photos and
// E2E_SELFIE at a selfie of someone who appears in them.
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
