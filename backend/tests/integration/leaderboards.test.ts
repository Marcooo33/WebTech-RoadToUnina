import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

// GET /api/leaderboards/* is global and unauthenticated. Rankings are by
// clickCount / effectivePlayTimeMs, not by date, so this file cannot assume its
// rows occupy fixed positions. Instead it seeds CLICK rows with clickCount 0
// (no real completed game can have fewer than one navigation, so these always
// sort to the top) and TIME rows with effectivePlayTimeMs 0, then asserts only
// on the identity / relative order of its own ids.

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

interface Json {
  [key: string]: unknown;
}

function unique(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function createUser(): Promise<{ id: string; username: string }> {
  const username = unique("lb");
  const user = await prisma.user.create({
    data: {
      username,
      email: `${username}@example.com`,
      passwordHash: "not-a-real-hash",
    },
  });
  createdUserIds.push(user.id);
  return { id: user.id, username: user.username };
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
      startedAt: new Date(),
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
  return game.id;
}

async function get(path: string): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Json) : {} };
}

function items(body: Json): Json[] {
  assert.ok(Array.isArray(body.items), "expected body.items to be an array");
  return body.items as Json[];
}

function idsInOrder(list: Json[], known: Set<string>): string[] {
  return list.map((entry) => entry.gameId as string).filter((id) => known.has(id));
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

test("CLICK leaderboard orders by clickCount then effective time, ranks sequentially", async () => {
  const user = await createUser();
  const a = await seedGame({ userId: user.id, clickCount: 0, effectivePlayTimeMs: 300_000 });
  const b = await seedGame({ userId: user.id, clickCount: 0, effectivePlayTimeMs: 120_000 });
  const c = await seedGame({ userId: user.id, clickCount: 0, effectivePlayTimeMs: 500_000 });
  const known = new Set([a, b, c]);

  const { status, body } = await get("/api/leaderboards/click?difficulty=EASY&limit=100");
  assert.equal(status, 200);
  assert.equal(body.mode, "CLICK");
  assert.equal(body.difficulty, "EASY");

  const list = items(body);
  // clickCount all 0 -> ordered by effectivePlayTimeMs asc: b (120k) < a (300k) < c (500k).
  assert.deepEqual(idsInOrder(list, known), [b, a, c]);

  // rank is the sequential list position across the whole returned list.
  const ranks = list.map((entry) => entry.rank as number);
  assert.deepEqual(ranks, Array.from({ length: ranks.length }, (_, i) => i + 1));

  const bItem = list.find((entry) => entry.gameId === b) as Json;
  assert.equal(bItem.username, user.username);
  assert.equal(bItem.clickCount, 0);
  assert.equal(bItem.effectivePlayTimeMs, 120_000);
  assert.equal(typeof bItem.completedAt, "string");

  const serialized = JSON.stringify(bItem);
  assert.ok(!serialized.includes("email"));
  assert.ok(!serialized.includes("@example.com"));
  assert.ok(!serialized.includes("passwordHash"));
  assert.ok(!serialized.includes("not-a-real-hash"));
});

test("TIME leaderboard orders by effective time then clickCount", async () => {
  const user = await createUser();
  const a = await seedGame({ userId: user.id, mode: "TIME", effectivePlayTimeMs: 0, clickCount: 5 });
  const b = await seedGame({ userId: user.id, mode: "TIME", effectivePlayTimeMs: 0, clickCount: 3 });
  const c = await seedGame({ userId: user.id, mode: "TIME", effectivePlayTimeMs: 0, clickCount: 9 });
  const known = new Set([a, b, c]);

  const { status, body } = await get("/api/leaderboards/time?difficulty=EASY&limit=100");
  assert.equal(status, 200);
  assert.equal(body.mode, "TIME");

  // effectivePlayTimeMs all 0 -> ordered by clickCount asc: b (3) < a (5) < c (9).
  assert.deepEqual(idsInOrder(items(body), known), [b, a, c]);
});

test("difficulty separates rankings", async () => {
  const user = await createUser();
  const easy = await seedGame({ userId: user.id, difficulty: "EASY", clickCount: 0 });
  const hard = await seedGame({ userId: user.id, difficulty: "HARD", clickCount: 0 });

  const res = await get("/api/leaderboards/click?difficulty=EASY&limit=100");
  const ids = idsInOrder(items(res.body), new Set([easy, hard]));
  assert.deepEqual(ids, [easy], "HARD game must not appear under difficulty=EASY");
});

test("mode separates rankings", async () => {
  const user = await createUser();
  const clickGame = await seedGame({ userId: user.id, mode: "CLICK", clickCount: 0 });
  const timeGame = await seedGame({ userId: user.id, mode: "TIME", effectivePlayTimeMs: 0 });

  const res = await get("/api/leaderboards/click?difficulty=EASY&limit=100");
  assert.ok(
    !items(res.body).some((entry) => entry.gameId === timeGame),
    "TIME game must not appear in the CLICK leaderboard",
  );
  assert.ok(items(res.body).some((entry) => entry.gameId === clickGame));
});

test("in-progress games never appear in a leaderboard", async () => {
  const user = await createUser();
  const inProgress = await seedGame({ userId: user.id, status: "IN_PROGRESS", clickCount: 0 });

  const res = await get("/api/leaderboards/click?difficulty=EASY&limit=100");
  assert.ok(!items(res.body).some((entry) => entry.gameId === inProgress));
});

test("limit caps the number of returned entries", async () => {
  const user = await createUser();
  await seedGame({ userId: user.id, clickCount: 0 });
  await seedGame({ userId: user.id, clickCount: 0 });

  const res = await get("/api/leaderboards/click?difficulty=EASY&limit=1");
  assert.equal(res.status, 200);
  assert.equal(items(res.body).length, 1);
});

test("invalid or missing query parameters return 400 VALIDATION_ERROR", async () => {
  for (const query of ["", "?difficulty=easy", "?difficulty=EASY&limit=101", "?difficulty=EASY&limit=0"]) {
    for (const board of ["click", "time"]) {
      const { status, body } = await get(`/api/leaderboards/${board}${query}`);
      assert.equal(status, 400, `expected 400 for /${board}${query}`);
      assert.equal((body.error as Json | undefined)?.code, "VALIDATION_ERROR");
    }
  }
});
