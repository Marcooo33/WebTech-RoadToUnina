import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

test("HTTP server starts and serves health while PostgreSQL is unreachable", { timeout: 15_000 }, async (t) => {
  const reservation = createServer().listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@127.0.0.1:1/roadtounina_unreachable",
      JWT_SECRET: "startup-test-secret-at-least-thirty-two-chars",
      E2E_FAKE_WIKIPEDIA: "0",
      SERVE_FRONTEND: "0",
      PUBLIC_ORIGIN: "",
      RENDER_EXTERNAL_URL: "",
      DB_HEALTH_SECRET: "",
      PORT: String(address.port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await exited;
  });
  await new Promise<void>((resolve, reject) => {
    child.stdout!.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Server listening")) resolve();
    });
    child.once("error", reject);
    child.once("exit", () => reject(new Error("Server exited before listening")));
  });
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/unknown`)).status, 404);
});
