import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

// GET /api/me/stats is authenticated and scoped to the caller, so every
// assertion here is exact — no other test touches this user's rows.

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

interface Json {
  [key: string]: unknown;
}

function unique(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function registerUser(): Promise<{ userId: string; cookie: string }> {
  const username = unique("stats");
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: "password123",
    }),
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as { id: string };
  const setCookie = res.headers.getSetCookie()[0];
  const cookie = setCookie.split(";")[0].split("=")[1];
  createdUserIds.push(body.id);
  return { userId: body.id, cookie };
}

interface SeedOptions {
  userId: string;
  mode?: "CLICK" | "TIME";
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  status?: "IN_PROGRESS" | "COMPLETED";
  clickCount?: number;
  effectivePlayTimeMs?: number;
}

async function seedGame(options: SeedOptions): Promise<string> {
  const status = options.status ?? "COMPLETED";
  const game = await prisma.game.create({
    data: {
      userId: options.userId,
      mode: options.mode ?? "CLICK",
      difficulty: options.difficulty ?? "EASY",
      status,
      startPageId: 100,
      startPageTitle: "Start",
      currentPageId: 100,
      currentPageTitle: "Start",
      clickCount: options.clickCount ?? 0,
      backtrackCount: 0,
      effectivePlayTimeMs: options.effectivePlayTimeMs ?? 0,
      version: 1,
      startedAt: new Date(),
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
  return game.id;
}

async function getStats(cookie?: string): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.Cookie = `access_token=${cookie}`;
  }
  const res = await fetch(`${baseUrl}/api/me/stats`, { headers });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Json) : {} };
}

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

test("stats aggregate counts, best results and averages for the caller", async () => {
  const { userId, cookie } = await registerUser();

  const bestClick = await seedGame({ userId, mode: "CLICK", difficulty: "EASY", clickCount: 8, effectivePlayTimeMs: 250_000 });
  await seedGame({ userId, mode: "CLICK", difficulty: "MEDIUM", clickCount: 8, effectivePlayTimeMs: 300_000 });
  await seedGame({ userId, mode: "CLICK", difficulty: "HARD", clickCount: 14, effectivePlayTimeMs: 100_000 });
  const bestTime = await seedGame({ userId, mode: "TIME", difficulty: "HARD", clickCount: 10, effectivePlayTimeMs: 210_000 });
  await seedGame({ userId, mode: "TIME", difficulty: "EASY", clickCount: 15, effectivePlayTimeMs: 210_000 });
  await seedGame({ userId, status: "IN_PROGRESS" });
  await seedGame({ userId, status: "IN_PROGRESS" });

  const { status, body } = await getStats(cookie);
  assert.equal(status, 200);

  assert.equal(body.completedGames, 5);
  assert.equal(body.inProgressGames, 2);

  assert.deepEqual(body.bestClick, {
    gameId: bestClick,
    difficulty: "EASY",
    clickCount: 8,
    effectivePlayTimeMs: 250_000,
    completedAt: (body.bestClick as Json).completedAt,
  });
  assert.equal(typeof (body.bestClick as Json).completedAt, "string");

  assert.equal((body.bestTime as Json).gameId, bestTime);
  assert.equal((body.bestTime as Json).clickCount, 10);
  assert.equal((body.bestTime as Json).effectivePlayTimeMs, 210_000);

  // CLICK clickCounts [8, 8, 14] -> avg 10.0; TIME times [210000, 210000] -> 210000.
  assert.equal(body.averageClicks, 10);
  assert.equal(body.averageEffectiveTimeMs, 210_000);
});

test("stats return null best/average for a mode the user has never completed", async () => {
  const { userId, cookie } = await registerUser();
  await seedGame({ userId, mode: "CLICK", clickCount: 5, effectivePlayTimeMs: 60_000 });

  const { body } = await getStats(cookie);
  assert.equal(body.completedGames, 1);
  assert.equal(body.inProgressGames, 0);
  assert.notEqual(body.bestClick, null);
  assert.equal(body.bestTime, null);
  assert.equal(body.averageClicks, 5);
  assert.equal(body.averageEffectiveTimeMs, null);
});

test("stats round averageClicks to one decimal place", async () => {
  const { userId, cookie } = await registerUser();
  await seedGame({ userId, mode: "CLICK", clickCount: 4 });
  await seedGame({ userId, mode: "CLICK", clickCount: 5 });
  await seedGame({ userId, mode: "CLICK", clickCount: 5 });

  const { body } = await getStats(cookie);
  // (4 + 5 + 5) / 3 = 4.666... -> 4.7
  assert.equal(body.averageClicks, 4.7);
});

test("stats require authentication", async () => {
  const { status, body } = await getStats();
  assert.equal(status, 401);
  assert.equal((body.error as Json | undefined)?.code, "AUTHENTICATION_REQUIRED");
});
