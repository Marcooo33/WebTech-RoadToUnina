import assert from "node:assert/strict";
import { test } from "node:test";
import express, { type Express } from "express";
import type { AddressInfo } from "node:net";
import { createRequestProtection } from "../src/middleware/request-protection.js";
import { createRateLimit } from "../src/middleware/rate-limit.js";
import {
  AUTH_RATE_LIMITS,
  createAuthRateLimits,
} from "../src/middleware/auth-rate-limits.js";
import { createDbHealthRouter } from "../src/modules/health/health.routes.js";
import { errorMiddleware } from "../src/middleware/error.middleware.js";
import { parseEnv } from "../src/config/env.js";

async function serve(app: Express, action: (url: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await action(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("production rejects unsafe configuration and defaults to same-origin static hosting", () => {
  const base = {
    DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
    JWT_SECRET: "a".repeat(32),
  };
  const local = parseEnv(base);
  assert.equal(local.TRUST_PROXY_HOPS, 0);
  assert.equal(local.SERVE_FRONTEND, "0");
  assert.equal(local.DB_HEALTH_SECRET, undefined);
  assert.throws(
    () => parseEnv({ ...base, NODE_ENV: "production" }),
    /PUBLIC_ORIGIN/,
  );
  const production = {
    ...base,
    NODE_ENV: "production",
    RENDER_EXTERNAL_URL: "https://demo.onrender.com",
  };
  assert.equal(parseEnv(production).SERVE_FRONTEND, "1");
  assert.equal(parseEnv(production).PUBLIC_ORIGIN, "https://demo.onrender.com");
  assert.throws(
    () => parseEnv({ ...production, E2E_FAKE_WIKIPEDIA: "1" }),
    /cannot be enabled/,
  );
  for (const origin of [
    "http://demo.onrender.com",
    "https://demo.onrender.com/path",
    "null",
    "https://user:pass@demo.onrender.com",
  ]) {
    assert.throws(
      () => parseEnv({ ...production, PUBLIC_ORIGIN: origin }),
      /PUBLIC_ORIGIN/,
    );
  }
  for (const hops of ["true", "-1", "6", "1.5"]) {
    assert.throws(
      () => parseEnv({ ...base, TRUST_PROXY_HOPS: hops }),
      /TRUST_PROXY_HOPS/,
    );
  }
  assert.equal(
    parseEnv({ ...base, TRUST_PROXY_HOPS: "2" }).TRUST_PROXY_HOPS,
    2,
  );
  assert.throws(
    () => parseEnv({ ...base, DB_HEALTH_SECRET: "short" }),
    /DB_HEALTH_SECRET/,
  );
});

test("CSRF rejects foreign origins and same-site siblings, preserves same-origin beacon and native API", async () => {
  const app = express();
  app.use(createRequestProtection("https://demo.onrender.com"));
  app.all("/api/check", (_req, res) => {
    res.sendStatus(204);
  });
  app.use(errorMiddleware);
  await serve(app, async (url) => {
    for (const headers of [
      { Origin: "https://attacker.example" },
      { Origin: "null" },
      { "Sec-Fetch-Site": "cross-site" },
      { "Sec-Fetch-Site": "same-site" },
      {
        Origin: "https://attacker.example",
        "X-Forwarded-Host": "attacker.example",
      },
    ]) {
      const response = await fetch(`${url}/api/check`, {
        method: "POST",
        headers,
      });
      assert.equal(response.status, 403);
    }
    assert.equal(
      (
        await fetch(`${url}/api/check`, {
          method: "POST",
          headers: {
            Origin: "https://demo.onrender.com",
            "Sec-Fetch-Site": "same-origin",
          },
        })
      ).status,
      204,
    );
    assert.equal(
      (await fetch(`${url}/api/check`, { method: "POST" })).status,
      204,
    );
    assert.equal(
      (
        await fetch(`${url}/api/check`, {
          headers: { "Sec-Fetch-Site": "cross-site" },
        })
      ).status,
      403,
    );
  });
});

test("development accepts Angular proxy origin while rejecting cross-site browser metadata", async () => {
  const app = express();
  app.use(createRequestProtection());
  app.post("/api/check", (_req, res) => {
    res.sendStatus(204);
  });
  app.use(errorMiddleware);
  await serve(app, async (url) => {
    assert.equal(
      (
        await fetch(`${url}/api/check`, {
          method: "POST",
          headers: {
            Origin: "http://localhost:4200",
            "Sec-Fetch-Site": "same-origin",
          },
        })
      ).status,
      204,
    );
    assert.equal(
      (
        await fetch(`${url}/api/check`, {
          method: "POST",
          headers: {
            Origin: "http://localhost:4200",
            "Sec-Fetch-Site": "cross-site",
          },
        })
      ).status,
      403,
    );
  });
});

test("production auth thresholds block excessive attempts with Retry-After", async () => {
  const limits = createAuthRateLimits();
  const app = express();
  for (const name of ["login", "register", "account"] as const) {
    app.post(`/${name}`, limits[name], (_req, res) => {
      res.sendStatus(204);
    });
  }
  await serve(app, async (url) => {
    for (const name of ["login", "register", "account"] as const) {
      for (let count = 0; count < AUTH_RATE_LIMITS[name].limit; count++) {
        assert.equal(
          (await fetch(`${url}/${name}`, { method: "POST" })).status,
          204,
        );
      }
      const rejected = await fetch(`${url}/${name}`, { method: "POST" });
      assert.equal(rejected.status, 429);
      assert.ok(Number(rejected.headers.get("Retry-After")) > 0);
    }
  });
});

test("limiter expires windows, bounds identities and trusts only configured proxy hops", async () => {
  let clock = 0;
  const app = express();
  app.set("trust proxy", 1);
  app.use(createRateLimit(1, 1000, () => clock, 2));
  app.get("/", (req, res) => {
    res.json({ ip: req.ip });
  });
  await serve(app, async (url) => {
    const get = (chain: string) =>
      fetch(url, { headers: { "X-Forwarded-For": chain } });
    assert.deepEqual(await (await get("198.51.100.250, 192.0.2.1")).json(), {
      ip: "192.0.2.1",
    });
    assert.equal((await get("198.51.100.251, 192.0.2.1")).status, 429);
    assert.equal((await get("192.0.2.2")).status, 200);
    assert.equal((await get("192.0.2.3")).status, 429);
    clock = 1001;
    assert.equal((await get("192.0.2.3")).status, 200);
  });
  const direct = express();
  direct.get("/", (req, res) => {
    res.json({ ip: req.ip });
  });
  await serve(direct, async (url) => {
    assert.deepEqual(
      await (
        await fetch(url, { headers: { "X-Forwarded-For": "198.51.100.1" } })
      ).json(),
      { ip: "127.0.0.1" },
    );
  });
});

test("DB endpoint disabled without secret; rejects wrong secret without queries or logs", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  let queries = 0;
  for (const secret of [undefined, "a".repeat(32)]) {
    const app = express();
    app.use(
      "/api/health",
      createDbHealthRouter({
        secret,
        readDatabase: async () => {
          queries++;
        },
      }),
    );
    await serve(app, async (url) => {
      assert.equal((await fetch(`${url}/api/health/db`)).status, 404);
      assert.equal(
        (
          await fetch(`${url}/api/health/db`, {
            headers: { "X-Health-Secret": "wrong" },
          })
        ).status,
        404,
      );
    });
  }
  assert.equal(queries, 0);
  assert.equal(log.mock.callCount(), 0);
});

test("DB endpoint returns no query data, limits successful callers and resets quota", async () => {
  let clock = 1000;
  let queries = 0;
  const secret = "a".repeat(32);
  const app = express();
  app.use(
    "/api/health",
    createDbHealthRouter({
      secret,
      now: () => clock,
      readDatabase: async () => {
        queries++;
        return [{ sensitive: "never returned" }];
      },
    }),
  );
  await serve(app, async (url) => {
    const get = () =>
      fetch(`${url}/api/health/db`, { headers: { "X-Health-Secret": secret } });
    for (let i = 0; i < 12; i++) {
      const response = await get();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await response.json(), { status: "ok" });
    }
    assert.equal((await get()).status, 429);
    assert.equal(queries, 12);
    clock += 3_600_000;
    assert.equal((await get()).status, 200);
  });
});

test("DB endpoint hides database failures and recovers without leaking errors to logs", async (t) => {
  const log = t.mock.method(console, "info", () => {});
  let failed = false;
  const secret = "a".repeat(32);
  const app = express();
  app.use(
    "/api/health",
    createDbHealthRouter({
      secret,
      readDatabase: async () => {
        if (!failed) {
          failed = true;
          throw new Error("postgresql://sensitive-credentials");
        }
      },
    }),
  );
  await serve(app, async (url) => {
    const response = await fetch(`${url}/api/health/db`, {
      headers: { "X-Health-Secret": secret },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database temporarily unavailable.",
      },
    });
    const recovered = await fetch(`${url}/api/health/db`, {
      headers: { "X-Health-Secret": secret },
    });
    assert.equal(recovered.status, 200);
    assert.deepEqual(await recovered.json(), { status: "ok" });
  });
  assert.equal(log.mock.callCount(), 2);
  for (const [index, status] of [503, 200].entries()) {
    const entry = JSON.parse(log.mock.calls[index]!.arguments[0]!);
    assert.deepEqual(Object.keys(entry).sort(), ["durationMs", "event", "status"]);
    assert.equal(entry.event, "db_health");
    assert.equal(entry.status, status);
    assert.ok(entry.durationMs >= 0);
  }
});

test("DB endpoint admits only one in-flight read", async () => {
  const secret = "a".repeat(32);
  let started!: () => void;
  let finish!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const app = express();
  app.use(
    "/api/health",
    createDbHealthRouter({
      secret,
      readDatabase: async () => {
        started();
        await pending;
      },
    }),
  );
  await serve(app, async (url) => {
    const get = () =>
      fetch(`${url}/api/health/db`, { headers: { "X-Health-Secret": secret } });
    const first = get();
    await entered;
    try {
      assert.equal((await get()).status, 429);
    } finally {
      finish();
      assert.equal((await first).status, 200);
    }
  });
});
