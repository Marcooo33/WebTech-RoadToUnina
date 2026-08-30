import { Client } from "pg";

/**
 * Positive allow-list guard. Every destructive DB operation in the suite
 * (migrate, TRUNCATE) goes through this first. It must be impossible for the
 * E2E run to touch Supabase or any non-throwaway database.
 */
export function assertE2EDatabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    throw new Error("E2E_DATABASE_URL is not set (copy e2e/.env.example to e2e/.env).");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("E2E_DATABASE_URL is not a valid URL.");
  }

  const host = url.hostname;
  const port = url.port;
  const database = url.pathname.replace(/^\//, "");

  const allowedHost = host === "localhost" || host === "127.0.0.1";
  const allowedPort = port === "55432";
  const allowedDatabase = database === "roadtounina_e2e";

  if (!allowedHost || !allowedPort || !allowedDatabase) {
    throw new Error(
      `Refusing to run E2E against ${host}:${port || "(default)"}/${database}. ` +
        "Expected localhost:55432/roadtounina_e2e (the local Docker database). " +
        "This guard exists so the suite can never migrate or TRUNCATE Supabase.",
    );
  }

  return rawUrl;
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

/** Wait until Postgres actually accepts connections (belt-and-braces alongside `--wait`). */
export async function waitForDatabase(url: string, attempts = 20): Promise<void> {
  assertE2EDatabaseUrl(url);
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await withClient(url, (c) => c.query("SELECT 1"));
      return;
    } catch (error) {
      if (i === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/** Reset the four application tables. Runs once, in global setup. */
export async function truncateAll(url: string): Promise<void> {
  assertE2EDatabaseUrl(url);
  await withClient(url, (c) =>
    c.query(
      'TRUNCATE "game_sessions", "game_moves", "games", "users" RESTART IDENTITY CASCADE',
    ),
  );
}

export async function countActiveSessions(url: string, gameId: string): Promise<number> {
  assertE2EDatabaseUrl(url);
  return withClient(url, async (c) => {
    const result = await c.query(
      `SELECT COUNT(*)::int AS count FROM "game_sessions" WHERE "game_id" = $1 AND "status" = 'ACTIVE'`,
      [gameId],
    );
    return result.rows[0].count as number;
  });
}
