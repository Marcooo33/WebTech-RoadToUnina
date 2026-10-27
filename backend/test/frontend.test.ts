import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import express from "express";
import { serveFrontend } from "../src/lib/frontend.js";

test("production SPA serves assets and deep links without masking API or asset errors", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "roadtounina-frontend-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "images"));
  await writeFile(join(directory, "index.html"), "<!doctype html><title>ROADTOUNINA</title>");
  await writeFile(join(directory, "main-1234abcd.js"), "console.log('app');");
  await writeFile(join(directory, "images", "landing.jpg"), "image fixture");
  await writeFile(join(directory, ".env"), "must not be served");
  const app = express();
  app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
  app.use("/api", (_req, res) => { res.status(404).json({ error: "not found" }); });
  serveFrontend(app, directory);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  for (const route of ["/", "/index.html", "/login", "/history/123", "/guest/game/123"]) {
    const response = await fetch(`${base}${route}`, { headers: { Accept: "text/html" } });
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get("content-type")!, /text\/html/);
    assert.equal(response.headers.get("cache-control"), "no-cache");
    assert.match(await response.text(), /ROADTOUNINA/);
  }
  const bundle = await fetch(`${base}/main-1234abcd.js`);
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get("cache-control")!, /immutable/);
  assert.match(bundle.headers.get("content-type")!, /javascript/);
  assert.equal((await fetch(`${base}/images/landing.jpg`)).status, 200);
  assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: "ok" });
  const api = await fetch(`${base}/api/unknown`, { headers: { Accept: "text/html" } });
  assert.equal(api.status, 404);
  assert.match(api.headers.get("content-type")!, /json/);
  for (const route of ["/missing.js", "/images/missing.jpg", "/.env", "/.git/config"]) {
    assert.equal((await fetch(`${base}${route}`)).status, 404, route);
  }
  assert.equal((await fetch(`${base}/login`, { method: "POST" })).status, 404);
  assert.equal((await fetch(`${base}/login`, { headers: { Accept: "application/json" } })).status, 404);
  const head = await fetch(`${base}/login`, { method: "HEAD", headers: { Accept: "text/html" } });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("missing Angular build fails clearly instead of exposing another directory", () => {
  assert.throws(() => serveFrontend(express(), join(tmpdir(), "roadtounina-missing-build", "browser")), /Angular build missing/);
});
