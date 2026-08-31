/**
 * Integration-test preload (`node --import ./tests/setup.ts`).
 *
 * Runs BEFORE any `*.test.ts` file — and therefore before `src/lib/prisma.ts`
 * and `src/config/env.loader.ts` — is imported. Its only jobs are the
 * fail-fast safety guard and pinning `process.env` for the suite. The database
 * is brought up / migrated by `tests/run-integration.mjs` beforehand.
 *
 * If the configuration is not the dedicated local integration database, this
 * exits the process immediately, before Prisma is ever constructed.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { assertIntegrationDatabaseUrl, resolveIntegrationDatabaseUrl } from "./support/db.js";

// Allow an optional INTEGRATION_DATABASE_URL override to live in backend/.env,
// like the rest of the backend configuration. DATABASE_URL from that file is
// deliberately overwritten below with the guarded local URL.
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env"),
  quiet: true,
});

let databaseUrl: string;
try {
  databaseUrl = assertIntegrationDatabaseUrl(resolveIntegrationDatabaseUrl());
} catch (error) {
  console.error(
    `\n[integration] refusing to start: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}

// From here Prisma, the env loader and the app all read a guaranteed-local
// configuration. dotenv (loaded by env.loader.ts / prisma.config.ts) does not
// override values that are already present in process.env.
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "test";
process.env.E2E_FAKE_WIKIPEDIA = "0";
process.env.JWT_SECRET ||= "integration-tests-only-jwt-secret-0123456789";
