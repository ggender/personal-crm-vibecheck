import { defineConfig, devices } from "@playwright/test";

// The scenarios get their own production build on their own port and their
// own database, so a running `npm run dev` and data/crm.db stay untouched.
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  // All scenarios share one database and change it: one at a time.
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A fresh build, so the scenarios never run against stale code, and a
    // fresh database with the 999 seed contacts on every run.
    command: `npm run build && npm run db:reset && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { CRM_DB_PATH: "data/e2e/crm.db" },
    // Fail instead of silently testing some other server on this port.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
