import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

// End-to-end tests run against the real app and the local Supabase stack (`npm run db:start`).
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Pages with the WebGL globe are CPU-heavy under software rendering; two workers and a longer
  // per-test budget keep the suite from timing out on a busy machine. Failures are never retried.
  workers: 2,
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    // Always our own server in fixture mode, so tests never call Gemini, OpenStreetMap or
    // Wikimedia. Stop any dev server on port 3000 before running end-to-end tests.
    reuseExistingServer: false,
    env: { VOYAGER_FIXTURES: "1" },
    timeout: 240_000,
  },
});
