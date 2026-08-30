import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, ".env") });

const backendDir = path.resolve(here, "..", "backend");
const frontendDir = path.resolve(here, "..", "frontend");
const e2eProxyConfig = path.resolve(here, "proxy.e2e.json");

// Dedicated ports so the E2E stack can never collide with — or, worse, silently
// reuse — a developer's running `npm run dev` (3000) / `npm start` (4200), whose
// backend points at Supabase. `reuseExistingServer: false` on both makes a port
// clash a hard error instead of a silent hand-off to the wrong backend.
const BACKEND_PORT = 3100;
const FRONTEND_PORT = 4300;

const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL;
const E2E_JWT_SECRET =
  process.env.E2E_JWT_SECRET ?? "e2e-test-only-jwt-secret-value-01234567890";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  timeout: 30_000,
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npx tsx src/server.ts",
      cwd: backendDir,
      url: `http://localhost:${BACKEND_PORT}/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_SECRET: E2E_JWT_SECRET,
        NODE_ENV: "test",
        PORT: String(BACKEND_PORT),
        E2E_FAKE_WIKIPEDIA: "1",
        SESSION_HEARTBEAT_TIMEOUT: "90s",
      },
    },
    {
      command: `npm start -- --port ${FRONTEND_PORT} --proxy-config ${JSON.stringify(e2eProxyConfig)}`,
      cwd: frontendDir,
      url: `http://localhost:${FRONTEND_PORT}`,
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
