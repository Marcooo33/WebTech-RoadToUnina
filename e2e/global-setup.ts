import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { assertE2EDatabaseUrl, truncateAll, waitForDatabase } from "./support/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, "..", "backend");

dotenv.config({ path: path.resolve(here, ".env") });

export default async function globalSetup(): Promise<void> {
  const databaseUrl = assertE2EDatabaseUrl(process.env.E2E_DATABASE_URL);

  // Postgres may report "started" before it accepts connections.
  await waitForDatabase(databaseUrl);

  // Apply the committed migrations (schema + CHECK constraints) to the
  // throwaway DB.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: backendDir,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  // Clean slate for the run. Per-test isolation is then by unique data.
  await truncateAll(databaseUrl);
}
