import { test, expect } from "@playwright/test";
import { once } from "node:events";
import { Client } from "pg";
import { assertE2EDatabaseUrl } from "../support/db.js";

test("DB health cancels a locked read, restores the connection and recovers", async () => {
  // Never inherit the backend .env connection. Use only the guarded disposable DB.
  const databaseUrl = assertE2EDatabaseUrl(process.env.E2E_DATABASE_URL);
  const secret = "db-health-e2e-only-secret-at-least-32-characters";
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.E2E_JWT_SECRET ??
    "e2e-test-only-jwt-secret-value-01234567890";
  process.env.DB_HEALTH_SECRET = secret;
  process.env.PUBLIC_ORIGIN = "";
  process.env.RENDER_EXTERNAL_URL = "";
  process.env.SERVE_FRONTEND = "0";

  const { createApp } = await import("../../backend/src/app.js");
  const { prisma } = await import("../../backend/src/lib/prisma.js");
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  const base = `http://127.0.0.1:${address.port}`;
  const blocker = new Client({ connectionString: databaseUrl });
  const check = () => fetch(`${base}/api/health/db`, {
    headers: { "X-Health-Secret": secret },
  });

  try {
    await blocker.connect();
    // The app pool has just one connection in this test; check it is reused and
    // the transaction-local timeout is reset after both rollback and commit.
    const before = await prisma.$queryRaw<{ pid: number; timeout: string }[]>`
      SELECT pg_backend_pid() AS pid, current_setting('statement_timeout') AS timeout
    `;
    await blocker.query("BEGIN");
    await blocker.query("LOCK TABLE users IN ACCESS EXCLUSIVE MODE");

    expect((await fetch(`${base}/health`)).status).toBe(200);
    const started = Date.now();
    const failed = await check();
    expect(failed.status).toBe(503);
    expect(Date.now() - started).toBeGreaterThanOrEqual(2_500);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(await failed.json()).toEqual({ error: {
      code: "DATABASE_UNAVAILABLE",
      message: "Database temporarily unavailable.",
    } });

    // The lock is still held: a mere HTTP timeout would leave the read waiting.
    const active = await blocker.query(`
      SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
        AND state = 'active'
        AND query LIKE '%SELECT EXISTS (SELECT 1 FROM users LIMIT 1)%'
    `);
    expect(active.rows[0].count).toBe(0);
    const afterRollback = await prisma.$queryRaw`
      SELECT pg_backend_pid() AS pid, current_setting('statement_timeout') AS timeout
    `;
    expect(afterRollback).toEqual(before);

    await blocker.query("ROLLBACK");
    const recovered = await check();
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toEqual({ status: "ok" });
    const afterCommit = await prisma.$queryRaw`
      SELECT pg_backend_pid() AS pid, current_setting('statement_timeout') AS timeout
    `;
    expect(afterCommit).toEqual(before);
  } finally {
    try {
      await blocker.query("ROLLBACK");
    } finally {
      await blocker.end();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()),
      );
      await prisma.$disconnect();
    }
  }
});
