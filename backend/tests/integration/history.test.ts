import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

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

interface SeedOptions {
  userId: string;
  id?: string;
  mode?: "CLICK" | "TIME";
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  status?: "IN_PROGRESS" | "COMPLETED";
  completedAt?: Date;
  clickCount?: number;
  backtrackCount?: number;
  effectivePlayTimeMs?: number;
  startPageId?: number;
  startPageTitle?: string;
  currentPageId?: number;
  currentPageTitle?: string;
  moves?: Move[];
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

async function seedGame(options: SeedOptions): Promise<string> {
  const status = options.status ?? "COMPLETED";
  const startPageId = options.startPageId ?? 100;
  const startPageTitle = options.startPageTitle ?? "Start";
  const game = await prisma.game.create({
    data: {
      ...(options.id ? { id: options.id } : {}),
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
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      completedAt:
        status === "COMPLETED"
          ? (options.completedAt ?? new Date("2026-01-01T00:10:00.000Z"))
          : null,
    },
  });

  for (const move of options.moves ?? []) {
    await prisma.gameMove.create({ data: { gameId: game.id, ...move } });
  }

  return game.id;
}

async function get(path: string): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as Json) : {},
  };
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
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

test("CLICK History orders by clicks, then effective time", async () => {
  const user = await createUser();
  const slowTie = await seedGame({
    userId: user.id,
    clickCount: 0,
    effectivePlayTimeMs: 300,
  });
  const fastTie = await seedGame({
    userId: user.id,
    clickCount: 0,
    effectivePlayTimeMs: 100,
  });
  const moreClicks = await seedGame({
    userId: user.id,
    clickCount: 1,
    effectivePlayTimeMs: 1,
  });
  const known = new Set([slowTie, fastTie, moreClicks]);

  const { status, body } = await get(
    "/api/history/click?difficulty=EASY&page=1&limit=100",
  );

  assert.equal(status, 200);
  assert.equal(body.mode, "CLICK");
  assert.equal(body.difficulty, "EASY");
  assert.deepEqual(idsInOrder(items(body), known), [fastTie, slowTie, moreClicks]);

  const entry = items(body).find((item) => item.gameId === fastTie) as Json;
  assert.equal(entry.username, user.username);
  assert.equal(entry.clickCount, 0);
  assert.equal(entry.effectivePlayTimeMs, 100);
  assert.equal(typeof entry.rank, "number");
  assert.equal(typeof entry.completedAt, "string");
  assert.ok(!JSON.stringify(entry).includes("email"));
  assert.ok(!JSON.stringify(entry).includes("passwordHash"));
});

test("TIME History orders by effective time, then clicks", async () => {
  const user = await createUser();
  const moreClicks = await seedGame({
    userId: user.id,
    mode: "TIME",
    clickCount: 5,
    effectivePlayTimeMs: 0,
  });
  const fewerClicks = await seedGame({
    userId: user.id,
    mode: "TIME",
    clickCount: 3,
    effectivePlayTimeMs: 0,
  });
  const slower = await seedGame({
    userId: user.id,
    mode: "TIME",
    clickCount: 1,
    effectivePlayTimeMs: 1,
  });
  const known = new Set([moreClicks, fewerClicks, slower]);

  const { status, body } = await get(
    "/api/history/time?difficulty=EASY&page=1&limit=100",
  );

  assert.equal(status, 200);
  assert.equal(body.mode, "TIME");
  assert.deepEqual(idsInOrder(items(body), known), [fewerClicks, moreClicks, slower]);
});

test("fully tied scores use completion time then game id", async () => {
  const user = await createUser();
  const earlier = await seedGame({
    userId: user.id,
    mode: "CLICK",
    difficulty: "MEDIUM",
    clickCount: 0,
    effectivePlayTimeMs: 0,
    completedAt: new Date("2025-01-01T00:00:00.000Z"),
  });
  const laterHighId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const laterLowId = "00000000-0000-4000-8000-000000000001";
  await seedGame({
    id: laterHighId,
    userId: user.id,
    mode: "CLICK",
    difficulty: "MEDIUM",
    clickCount: 0,
    effectivePlayTimeMs: 0,
    completedAt: new Date("2025-01-02T00:00:00.000Z"),
  });
  await seedGame({
    id: laterLowId,
    userId: user.id,
    mode: "CLICK",
    difficulty: "MEDIUM",
    clickCount: 0,
    effectivePlayTimeMs: 0,
    completedAt: new Date("2025-01-02T00:00:00.000Z"),
  });

  const response = await get(
    "/api/history/click?difficulty=MEDIUM&page=1&limit=100",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    idsInOrder(items(response.body), new Set([earlier, laterLowId, laterHighId])),
    [earlier, laterLowId, laterHighId],
  );
});

test("difficulty filters History and completed games only", async () => {
  const user = await createUser();
  const medium = await seedGame({
    userId: user.id,
    mode: "TIME",
    difficulty: "MEDIUM",
    effectivePlayTimeMs: 0,
  });
  const hard = await seedGame({
    userId: user.id,
    mode: "TIME",
    difficulty: "HARD",
    effectivePlayTimeMs: 0,
  });
  const inProgress = await seedGame({
    userId: user.id,
    mode: "TIME",
    difficulty: "MEDIUM",
    status: "IN_PROGRESS",
  });

  const response = await get(
    "/api/history/time?difficulty=MEDIUM&page=1&limit=100",
  );
  assert.equal(response.status, 200);
  const resultIds = idsInOrder(
    items(response.body),
    new Set([medium, hard, inProgress]),
  );
  assert.deepEqual(resultIds, [medium]);
});

test("History pagination returns metadata and global ranks", async () => {
  const user = await createUser();
  const first = await seedGame({
    userId: user.id,
    difficulty: "HARD",
    clickCount: 0,
    effectivePlayTimeMs: 10,
  });
  const second = await seedGame({
    userId: user.id,
    difficulty: "HARD",
    clickCount: 0,
    effectivePlayTimeMs: 20,
  });
  const third = await seedGame({
    userId: user.id,
    difficulty: "HARD",
    clickCount: 0,
    effectivePlayTimeMs: 30,
  });

  const pageOne = await get(
    "/api/history/click?difficulty=HARD&page=1&limit=2",
  );
  assert.equal(pageOne.status, 200);
  assert.equal(pageOne.body.page, 1);
  assert.equal(pageOne.body.limit, 2);
  assert.equal(typeof pageOne.body.total, "number");
  assert.equal(
    pageOne.body.totalPages,
    Math.ceil((pageOne.body.total as number) / 2),
  );
  assert.deepEqual(
    items(pageOne.body).slice(0, 2).map((entry) => entry.gameId),
    [first, second],
  );
  assert.deepEqual(
    items(pageOne.body).slice(0, 2).map((entry) => entry.rank),
    [1, 2],
  );

  const pageTwo = await get(
    "/api/history/click?difficulty=HARD&page=2&limit=2",
  );
  assert.equal(pageTwo.status, 200);
  assert.equal(pageTwo.body.page, 2);
  assert.equal((items(pageTwo.body)[0] as Json).gameId, third);
  assert.equal((items(pageTwo.body)[0] as Json).rank, 3);
});

test("completed-game detail remains public and reconstructs path and moves", async () => {
  const user = await createUser();
  const moves: Move[] = [
    { sequence: 1, type: "NAVIGATION", fromPageId: 100, fromPageTitle: "A", toPageId: 200, toPageTitle: "B" },
    { sequence: 2, type: "NAVIGATION", fromPageId: 200, fromPageTitle: "B", toPageId: 300, toPageTitle: "C" },
    { sequence: 3, type: "BACKTRACK", fromPageId: 300, fromPageTitle: "C", toPageId: 200, toPageTitle: "B" },
    { sequence: 4, type: "NAVIGATION", fromPageId: 200, fromPageTitle: "B", toPageId: 500, toPageTitle: "Target" },
  ];
  const gameId = await seedGame({
    userId: user.id,
    mode: "TIME",
    difficulty: "MEDIUM",
    clickCount: 3,
    backtrackCount: 1,
    effectivePlayTimeMs: 420_000,
    startPageId: 100,
    startPageTitle: "A",
    currentPageId: 500,
    currentPageTitle: "Target",
    moves,
  });

  const { status, body } = await get(`/api/history/${gameId}`);

  assert.equal(status, 200);
  assert.equal(body.gameId, gameId);
  assert.equal(body.mode, "TIME");
  assert.equal(body.difficulty, "MEDIUM");
  assert.equal(body.clickCount, 3);
  assert.equal(body.backtrackCount, 1);
  assert.equal(body.effectivePlayTimeMs, 420_000);
  assert.deepEqual(body.path, [
    { pageId: 100, title: "A" },
    { pageId: 200, title: "B" },
    { pageId: 500, title: "Target" },
  ]);
  assert.deepEqual(
    (body.moves as Json[]).map((move) => move.sequence),
    [1, 2, 3, 4],
  );
  assert.equal((body.player as Json).username, user.username);
  assert.ok(!JSON.stringify(body).includes("email"));
});

test("missing, in-progress and invalid detail ids are rejected", async () => {
  const user = await createUser();
  const inProgress = await seedGame({ userId: user.id, status: "IN_PROGRESS" });

  for (const gameId of [inProgress, randomUUID()]) {
    const response = await get(`/api/history/${gameId}`);
    assert.equal(response.status, 404);
    assert.equal((response.body.error as Json).code, "NOT_FOUND");
  }

  const invalid = await get("/api/history/not-a-uuid");
  assert.equal(invalid.status, 400);
  assert.equal((invalid.body.error as Json).code, "VALIDATION_ERROR");
});

test("invalid History collection queries return VALIDATION_ERROR", async () => {
  for (const suffix of [
    "",
    "?difficulty=easy",
    "?difficulty=EASY&page=0",
    "?difficulty=EASY&limit=101",
  ]) {
    for (const view of ["click", "time"]) {
      const response = await get(`/api/history/${view}${suffix}`);
      assert.equal(response.status, 400, `${view}${suffix}`);
      assert.equal((response.body.error as Json).code, "VALIDATION_ERROR");
    }
  }
});

test("obsolete collection and leaderboard routes are removed", async () => {
  for (const path of [
    "/api/history",
    "/api/leaderboards/click?difficulty=EASY",
    "/api/leaderboards/time?difficulty=EASY",
  ]) {
    const response = await get(path);
    assert.equal(response.status, 404, path);
    assert.equal((response.body.error as Json).code, "NOT_FOUND");
  }
});
