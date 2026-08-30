import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

// GET /api/history is a global, unauthenticated endpoint. No other integration
// file seeds completed games with future `completedAt` values, and tests within
// one file run sequentially, so this file dates its seeded games far in the
// future and asserts only on the identity / relative order of its own ids
// (plus `total >= seeded`) — never on exact global totals or absolute offsets.
const FAR_FUTURE = Date.UTC(2999, 0, 1);

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

interface Json {
  [key: string]: unknown;
}

interface Move {
  sequence: number;
  type: "NAVIGATION" | "BACKTRACK";
  fromPageId: number;
  fromPageTitle: string;
  toPageId: number;
  toPageTitle: string;
}

function unique(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function createUser(): Promise<{ id: string; username: string }> {
  const username = unique("hist");
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
  completedAtMs?: number;
  clickCount?: number;
  backtrackCount?: number;
  effectivePlayTimeMs?: number;
  startPageId?: number;
  startPageTitle?: string;
  currentPageId?: number;
  currentPageTitle?: string;
  moves?: Move[];
}

async function seedGame(options: SeedOptions): Promise<string> {
  const status = options.status ?? "COMPLETED";
  const startPageId = options.startPageId ?? 100;
  const startPageTitle = options.startPageTitle ?? "Start";

  const game = await prisma.game.create({
    data: {
      userId: options.userId,
      mode: options.mode ?? "CLICK",
      difficulty: options.difficulty ?? "EASY",
      status,
      startPageId,
      startPageTitle,
      currentPageId: options.currentPageId ?? startPageId,
      currentPageTitle: options.currentPageTitle ?? startPageTitle,
      clickCount: options.clickCount ?? 0,
      backtrackCount: options.backtrackCount ?? 0,
      effectivePlayTimeMs: options.effectivePlayTimeMs ?? 0,
      version: 1,
      startedAt: new Date(FAR_FUTURE - 60_000),
      completedAt:
        status === "COMPLETED"
          ? new Date(options.completedAtMs ?? FAR_FUTURE)
          : null,
    },
  });

  for (const move of options.moves ?? []) {
    await prisma.gameMove.create({ data: { gameId: game.id, ...move } });
  }

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
  return list
    .map((entry) => entry.gameId as string)
    .filter((id) => known.has(id));
}

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (createdUserIds.length > 0) {
    // Games / moves cascade from the user rows.
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

test("unauthenticated user lists completed games, newest first, without private fields", async () => {
  const user = await createUser();
  const older = await seedGame({
    userId: user.id,
    completedAtMs: FAR_FUTURE + 1_000,
    clickCount: 7,
    effectivePlayTimeMs: 300_000,
    startPageTitle: "Older start",
  });
  const newer = await seedGame({
    userId: user.id,
    completedAtMs: FAR_FUTURE + 2_000,
    clickCount: 4,
    effectivePlayTimeMs: 120_000,
    startPageTitle: "Newer start",
  });
  const inProgress = await seedGame({ userId: user.id, status: "IN_PROGRESS" });

  const { status, body } = await get("/api/history?limit=100");

  assert.equal(status, 200);
  assert.equal(body.page, 1);
  assert.equal(body.limit, 100);
  assert.equal(typeof body.total, "number");

  const list = items(body);
  const ours = idsInOrder(list, new Set([older, newer, inProgress]));
  assert.deepEqual(ours, [newer, older], "newest completedAt first, no in-progress");

  const newerItem = list.find((entry) => entry.gameId === newer) as Json;
  assert.equal(newerItem.mode, "CLICK");
  assert.equal(newerItem.difficulty, "EASY");
  assert.equal(newerItem.clickCount, 4);
  assert.equal(newerItem.effectivePlayTimeMs, 120_000);
  assert.equal(newerItem.startPageTitle, "Newer start");
  assert.equal(typeof newerItem.completedAt, "string");

  assert.deepEqual(Object.keys(newerItem.player as Json).sort(), [
    "avatarUrl",
    "id",
    "username",
  ]);
  const player = newerItem.player as Json;
  assert.equal(player.id, user.id);
  assert.equal(player.username, user.username);
  assert.equal(player.avatarUrl, null);

  const serialized = JSON.stringify(newerItem);
  assert.ok(!serialized.includes("email"), "list item must not expose email");
  assert.ok(!serialized.includes("@example.com"));
  assert.ok(!serialized.includes("passwordHash"));
  assert.ok(!serialized.includes("not-a-real-hash"));
});

test("completed game detail reconstructs the active path and full move history", async () => {
  const user = await createUser();
  // 100 -> 200 -> 300 -> 400, backtrack to 300, then 300 -> 500.
  const moves: Move[] = [
    { sequence: 1, type: "NAVIGATION", fromPageId: 100, fromPageTitle: "A", toPageId: 200, toPageTitle: "B" },
    { sequence: 2, type: "NAVIGATION", fromPageId: 200, fromPageTitle: "B", toPageId: 300, toPageTitle: "C" },
    { sequence: 3, type: "NAVIGATION", fromPageId: 300, fromPageTitle: "C", toPageId: 400, toPageTitle: "D" },
    { sequence: 4, type: "BACKTRACK", fromPageId: 400, fromPageTitle: "D", toPageId: 300, toPageTitle: "C" },
    { sequence: 5, type: "NAVIGATION", fromPageId: 300, fromPageTitle: "C", toPageId: 500, toPageTitle: "E" },
  ];
  const gameId = await seedGame({
    userId: user.id,
    mode: "TIME",
    difficulty: "MEDIUM",
    clickCount: 4,
    backtrackCount: 1,
    effectivePlayTimeMs: 420_000,
    startPageId: 100,
    startPageTitle: "A",
    currentPageId: 500,
    currentPageTitle: "E",
    moves,
  });

  const { status, body } = await get(`/api/history/${gameId}`);

  assert.equal(status, 200);
  assert.equal(body.gameId, gameId);
  assert.equal(body.mode, "TIME");
  assert.equal(body.difficulty, "MEDIUM");
  assert.equal(body.clickCount, 4);
  assert.equal(body.backtrackCount, 1);
  assert.equal(body.effectivePlayTimeMs, 420_000);
  assert.equal(body.startPageId, 100);
  assert.equal(body.startPageTitle, "A");
  assert.equal(typeof body.completedAt, "string");

  assert.deepEqual(body.path, [
    { pageId: 100, title: "A" },
    { pageId: 200, title: "B" },
    { pageId: 300, title: "C" },
    { pageId: 500, title: "E" },
  ]);

  const detailMoves = body.moves as Json[];
  assert.equal(detailMoves.length, 5);
  assert.deepEqual(
    detailMoves.map((move) => move.type),
    ["NAVIGATION", "NAVIGATION", "NAVIGATION", "BACKTRACK", "NAVIGATION"],
  );
  assert.deepEqual(
    detailMoves.map((move) => move.sequence),
    [1, 2, 3, 4, 5],
  );

  assert.deepEqual(Object.keys(body.player as Json).sort(), [
    "avatarUrl",
    "id",
    "username",
  ]);
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes("email"));
  assert.ok(!serialized.includes("@example.com"));
  assert.ok(!serialized.includes("passwordHash"));
});

test("in-progress games are never exposed through the public history", async () => {
  const user = await createUser();
  const inProgress = await seedGame({ userId: user.id, status: "IN_PROGRESS" });

  const list = await get("/api/history?limit=100");
  assert.equal(list.status, 200);
  assert.ok(
    !items(list.body).some((entry) => entry.gameId === inProgress),
    "in-progress game must not appear in the list",
  );

  const detail = await get(`/api/history/${inProgress}`);
  assert.equal(detail.status, 404);
  assert.equal((detail.body.error as Json | undefined)?.code, "NOT_FOUND");
});

test("detail for a non-existent game returns 404 NOT_FOUND", async () => {
  const { status, body } = await get(`/api/history/${randomUUID()}`);
  assert.equal(status, 404);
  assert.equal((body.error as Json | undefined)?.code, "NOT_FOUND");
});

test("detail with an invalid gameId returns 400 VALIDATION_ERROR", async () => {
  const { status, body } = await get("/api/history/not-a-uuid");
  assert.equal(status, 400);
  assert.equal((body.error as Json | undefined)?.code, "VALIDATION_ERROR");
});

test("mode and difficulty filters restrict the completed-game list", async () => {
  const user = await createUser();
  const clickEasy = await seedGame({
    userId: user.id,
    mode: "CLICK",
    difficulty: "EASY",
    completedAtMs: FAR_FUTURE + 10_000,
  });
  const timeHard = await seedGame({
    userId: user.id,
    mode: "TIME",
    difficulty: "HARD",
    completedAtMs: FAR_FUTURE + 11_000,
  });

  const byMode = await get("/api/history?limit=100&mode=CLICK");
  assert.equal(byMode.status, 200);
  const modeIds = idsInOrder(items(byMode.body), new Set([clickEasy, timeHard]));
  assert.deepEqual(modeIds, [clickEasy]);

  const byDifficulty = await get("/api/history?limit=100&difficulty=HARD");
  assert.equal(byDifficulty.status, 200);
  const difficultyIds = idsInOrder(
    items(byDifficulty.body),
    new Set([clickEasy, timeHard]),
  );
  assert.deepEqual(difficultyIds, [timeHard]);
});

test("pagination slices the ordered result consistently and echoes metadata", async () => {
  const user = await createUser();
  const g1 = await seedGame({ userId: user.id, completedAtMs: FAR_FUTURE + 20_000 });
  const g2 = await seedGame({ userId: user.id, completedAtMs: FAR_FUTURE + 21_000 });
  const g3 = await seedGame({ userId: user.id, completedAtMs: FAR_FUTURE + 22_000 });
  const known = new Set([g1, g2, g3]);

  const full = await get("/api/history?limit=100");
  assert.equal(full.status, 200);
  const fullList = items(full.body);

  // These three rows carry the latest `completedAt` in the table (far future,
  // later than any row seeded by other tests), so they always occupy the first
  // three slots of the newest-first ordering, in the order g3, g2, g1. Rows
  // beyond them belong to parallel test files that insert and delete COMPLETED
  // games concurrently, so neither `total` nor the list tail is asserted here.
  assert.deepEqual(idsInOrder(fullList, known), [g3, g2, g1]);
  assert.deepEqual(
    fullList.slice(0, 3).map((entry) => entry.gameId),
    [g3, g2, g1],
  );
  assert.equal(typeof full.body.total, "number");

  // Fixed small page size: the offset math must page through the stable head of
  // the list — page 1 is [g3, g2], and page 2 starts at g1.
  const page1 = await get("/api/history?limit=2&page=1");
  assert.equal(page1.status, 200);
  assert.equal(page1.body.page, 1);
  assert.equal(page1.body.limit, 2);
  assert.deepEqual(
    items(page1.body).map((entry) => entry.gameId),
    [g3, g2],
  );

  const page2 = await get("/api/history?limit=2&page=2");
  assert.equal(page2.status, 200);
  assert.equal(page2.body.page, 2);
  assert.equal(page2.body.limit, 2);
  assert.equal((items(page2.body)[0] as Json).gameId, g1);
});

test("a page beyond the last returns an empty list with metadata intact", async () => {
  const { status, body } = await get("/api/history?page=99999&limit=20");
  assert.equal(status, 200);
  assert.deepEqual(body.items, []);
  assert.equal(body.page, 99999);
  assert.equal(body.limit, 20);
  assert.equal(typeof body.total, "number");
});

test("invalid pagination parameters are rejected with 400 VALIDATION_ERROR", async () => {
  for (const query of ["limit=101", "page=0", "limit=-1", "page=1.0", "limit=abc"]) {
    const { status, body } = await get(`/api/history?${query}`);
    assert.equal(status, 400, `expected 400 for ${query}`);
    assert.equal((body.error as Json | undefined)?.code, "VALIDATION_ERROR");
  }
});
