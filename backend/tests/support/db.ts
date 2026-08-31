import { Client } from "pg";

/**
 * Name of the dedicated database the integration suite is allowed to touch.
 * It lives in the SAME local Docker PostgreSQL container as the E2E database
 * (see `e2e/docker-compose.yml`, host port 55432) but is a SEPARATE database:
 * the integration suite and the E2E suite never share data.
 */
export const INTEGRATION_DATABASE_NAME = "roadtounina_integration";

/**
 * Default connection string for the local Docker integration database.
 * These are the throwaway credentials already committed in
 * `e2e/.env.example` / `e2e/docker-compose.yml` — never Supabase credentials.
 * Override with `INTEGRATION_DATABASE_URL` only to point at another *local*
 * database (the guard below still enforces host/port/name).
 */
export const DEFAULT_INTEGRATION_DATABASE_URL = `postgresql://postgres:postgres@localhost:55432/${INTEGRATION_DATABASE_NAME}`;

/** Resolve the integration DATABASE_URL: explicit override, else the local default. */
export function resolveIntegrationDatabaseUrl(): string {
  const override = process.env.INTEGRATION_DATABASE_URL?.trim();
  return override && override.length > 0 ? override : DEFAULT_INTEGRATION_DATABASE_URL;
}

/**
 * Positive allow-list guard. Every destructive operation the integration suite
 * performs — `CREATE DATABASE`, `prisma migrate deploy`, and the `deleteMany`
 * calls in each test file's `after` hook — only runs once this has passed,
 * BEFORE any `*.test.ts` file (and therefore `src/lib/prisma.ts`) is imported.
 *
 * It requires BOTH:
 *   - `TEST_DATABASE=integration` in the environment, and
 *   - a URL that points at exactly localhost:55432/roadtounina_integration.
 *
 * so the suite can never reach Supabase OR the E2E database (`roadtounina_e2e`).
 */
export function assertIntegrationDatabaseUrl(rawUrl: string | undefined): string {
  if (process.env.TEST_DATABASE !== "integration") {
    throw new Error(
      `TEST_DATABASE is "${process.env.TEST_DATABASE ?? "(unset)"}", expected "integration". ` +
        "Run the suite with `npm run test:integration`.",
    );
  }

  if (!rawUrl) {
    throw new Error("Integration database URL is not set.");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Integration database URL is not a valid URL: ${rawUrl}`);
  }

  const host = url.hostname;
  const port = url.port;
  const database = url.pathname.replace(/^\//, "");

  const allowedHost = host === "localhost" || host === "127.0.0.1";
  const allowedPort = port === "55432";
  const allowedDatabase = database === INTEGRATION_DATABASE_NAME;

  if (!allowedHost || !allowedPort || !allowedDatabase) {
    throw new Error(
      `Refusing to run integration tests against ${host}:${port || "(default)"}/${database}. ` +
        `Expected localhost:55432/${INTEGRATION_DATABASE_NAME} (the local Docker database). ` +
        "This guard exists so the suite can never reach Supabase or the E2E database.",
    );
  }

  return rawUrl;
}

/** Same connection, but against the container's default `postgres` database. */
function toAdminUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

async function withClient<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Wait until the Docker PostgreSQL instance actually accepts connections. */
export async function waitForDatabase(url: string, attempts = 30): Promise<void> {
  assertIntegrationDatabaseUrl(url);
  const adminUrl = toAdminUrl(url);
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await withClient(adminUrl, (c) => c.query("SELECT 1"));
      return;
    } catch (error) {
      if (i === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Create the dedicated integration database if it does not exist yet. The E2E
 * container's `POSTGRES_DB` only creates `roadtounina_e2e`; this adds the
 * second database inside the same instance without a Docker init script.
 */
export async function ensureIntegrationDatabase(url: string): Promise<void> {
  assertIntegrationDatabaseUrl(url);
  const database = new URL(url).pathname.replace(/^\//, "");
  await withClient(toAdminUrl(url), async (c) => {
    const existing = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (existing.rowCount === 0) {
      // `database` is validated by the guard above (fixed literal), safe to inline.
      await c.query(`CREATE DATABASE "${database}"`);
    }
  });
}
