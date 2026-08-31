/**
 * Prepare the local Docker integration database: guard → wait for Postgres →
 * create `roadtounina_integration` if missing → apply the project's real Prisma
 * migrations with `prisma migrate deploy`.
 *
 * Invoked by `tests/run-integration.mjs` after the container is up, and never
 * against Supabase: every step goes through `assertIntegrationDatabaseUrl`
 * first, and `DATABASE_URL` is forced to the guarded URL for the Prisma call.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  assertIntegrationDatabaseUrl,
  ensureIntegrationDatabase,
  resolveIntegrationDatabaseUrl,
  waitForDatabase,
} from "./support/db.js";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Pick up an optional INTEGRATION_DATABASE_URL override from backend/.env.
dotenv.config({ path: path.join(backendDir, ".env"), quiet: true });

async function main(): Promise<void> {
  const databaseUrl = assertIntegrationDatabaseUrl(resolveIntegrationDatabaseUrl());

  await waitForDatabase(databaseUrl);
  await ensureIntegrationDatabase(databaseUrl);

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: backendDir,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

main().catch((error) => {
  console.error(
    `\n[integration] database preparation failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
