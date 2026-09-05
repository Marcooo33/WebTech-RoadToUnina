import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../src/config/game.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import type { StartingPageProvider } from "../../src/modules/games/starting-page.provider.js";
import { WikipediaService } from "../../src/modules/wikipedia/wikipedia.service.js";

// Effective play time is now tracked with two nullable timestamps directly on
// `Game` — there is no `game_sessions` table any more. These tests exercise the
// resume / heartbeat / activity / completion timing behaviour.

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

const START_PAGE_ID = 1;

function titleFor(pageId: number): string {
  return pageId === TARGET_PAGE_ID ? TARGET_PAGE_TITLE : `Page ${pageId}`;
}

const linkGraph = new Map<number, { pageId: number; title: string }[]>([
  [
    1,
    [2, TARGET_PAGE_ID].map((pageId) => ({ pageId, title: titleFor(pageId) })),
  ],
  [2, [{ pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE }]],
]);

function makeFakeWikipedia(): WikipediaService {
  return {
    getValidInternalLinks: async (pageId: number) => linkGraph.get(pageId) ?? [],
    getArticle: async (pageId: number) => ({
      pageId,
      title: titleFor(pageId),
      contentHtml: `<p>Article ${pageId}</p>`,
      links: linkGraph.get(pageId) ?? [],
    }),
  } as unknown as WikipediaService;
}

const fakeStartingPageProvider: StartingPageProvider = {
  async getStartingPage() {
    return { pageId: START_PAGE_ID, title: titleFor(START_PAGE_ID) };
  },
};

function unique(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function register(username: string): Promise<string> {
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
  createdUserIds.push(body.id);
  const [, cookie] = res.headers.getSetCookie()[0].split(";")[0].split("=");
  return cookie;
}

async function req(
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `access_token=${cookie}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

async function createGame(cookie: string, mode = "TIME"): Promise<string> {
  const res = await req("POST", "/api/games", cookie, {
    mode,
    difficulty: "EASY",
  });
  assert.equal(res.status, 201);
  return res.body.id as string;
}

/** Reads the raw timing columns straight from the database. */
async function timingRow(gameId: string) {
  return prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    select: {
      effectivePlayTimeMs: true,
      playStartedAt: true,
      lastHeartbeatAt: true,
      status: true,
      completedAt: true,
    },
  });
}

before(async () => {
  server = createApp({
    startingPageProvider: fakeStartingPageProvider,
    wikipediaService: makeFakeWikipedia(),
  }).listen(0);
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

test("a brand-new game has no pending interval; opening it starts one", async () => {
  const cookie = await register(unique("t_new"));
  const gameId = await createGame(cookie);

  const created = await timingRow(gameId);
  assert.equal(created.playStartedAt, null);
  assert.equal(created.lastHeartbeatAt, null);
  assert.equal(created.effectivePlayTimeMs, 0);

  const opened = await req("GET", `/api/games/${gameId}`, cookie);
  assert.equal(opened.status, 200);
  assert.equal(opened.body.effectivePlayTimeMs, 0);
  assert.equal(typeof opened.body.playStartedAt, "string");

  const row = await timingRow(gameId);
  assert.notEqual(row.playStartedAt, null);
  assert.notEqual(row.lastHeartbeatAt, null);
  assert.equal(row.effectivePlayTimeMs, 0);
});

test("reopening finalizes the previous interval up to its last heartbeat and ignores the offline gap", async () => {
  const cookie = await register(unique("t_reopen"));
  const gameId = await createGame(cookie);

  await req("GET", `/api/games/${gameId}`, cookie); // establishes interval

  // Simulate: opened 10 minutes ago, last heartbeat 7 minutes ago, then the
  // browser vanished for ~7 minutes (no traffic).
  const now = Date.now();
  await prisma.game.update({
    where: { id: gameId },
    data: {
      playStartedAt: new Date(now - 10 * 60_000),
      lastHeartbeatAt: new Date(now - 7 * 60_000),
    },
  });

  const reopened = await req("GET", `/api/games/${gameId}`, cookie);
  assert.equal(reopened.status, 200);

  const row = await timingRow(gameId);
  // Only the 3 minutes between playStartedAt and lastHeartbeatAt are counted.
  assert.equal(row.effectivePlayTimeMs, 3 * 60_000);
  // A fresh interval started ~now.
  assert.ok(row.playStartedAt!.getTime() >= now - 5_000);
  assert.ok(row.lastHeartbeatAt!.getTime() >= now - 5_000);
});

test("heartbeat advances lastHeartbeatAt only and never accumulates effective time", async () => {
  const cookie = await register(unique("t_hb"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);

  const before = await timingRow(gameId);
  await prisma.game.update({
    where: { id: gameId },
    data: { lastHeartbeatAt: new Date(Date.now() - 30_000) },
  });

  const hb = await req("POST", `/api/games/${gameId}/heartbeat`, cookie);
  assert.equal(hb.status, 204);

  const after = await timingRow(gameId);
  assert.ok(after.lastHeartbeatAt!.getTime() > Date.now() - 5_000);
  assert.equal(
    after.playStartedAt!.getTime(),
    before.playStartedAt!.getTime(),
    "playStartedAt is untouched by a heartbeat",
  );
  assert.equal(after.effectivePlayTimeMs, 0);
});

test("a valid move refreshes lastHeartbeatAt as proof of activity", async () => {
  const cookie = await register(unique("t_move"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);

  await prisma.game.update({
    where: { id: gameId },
    data: { lastHeartbeatAt: new Date(Date.now() - 60_000) },
  });

  const moved = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toPageId: 2,
  });
  assert.equal(moved.status, 200);

  const row = await timingRow(gameId);
  assert.ok(row.lastHeartbeatAt!.getTime() > Date.now() - 5_000);
  assert.equal(row.effectivePlayTimeMs, 0);
});

test("the winning move finalizes effective time up to now and clears pending state", async () => {
  const cookie = await register(unique("t_win"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);

  // Pretend the interval began 2 minutes ago.
  await prisma.game.update({
    where: { id: gameId },
    data: { playStartedAt: new Date(Date.now() - 120_000) },
  });

  const win = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toPageId: TARGET_PAGE_ID,
  });
  assert.equal(win.status, 200);
  assert.equal(win.body.status, "COMPLETED");

  const row = await timingRow(gameId);
  assert.equal(row.status, "COMPLETED");
  assert.notEqual(row.completedAt, null);
  assert.equal(row.playStartedAt, null);
  assert.equal(row.lastHeartbeatAt, null);
  assert.ok(row.effectivePlayTimeMs >= 118_000);
  assert.ok(row.effectivePlayTimeMs <= 130_000);
});

test("a completed game rejects heartbeats and its effective time is final", async () => {
  const cookie = await register(unique("t_done"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);
  await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toPageId: TARGET_PAGE_ID,
  });

  const finalTime = (await timingRow(gameId)).effectivePlayTimeMs;

  const hb = await req("POST", `/api/games/${gameId}/heartbeat`, cookie);
  assert.equal(hb.status, 409);
  assert.equal((hb.body.error as { code?: string }).code, "GAME_NOT_IN_PROGRESS");

  // Reopening a completed game does not restart timing either.
  const reopened = await req("GET", `/api/games/${gameId}`, cookie);
  assert.equal(reopened.body.effectivePlayTimeMs, finalTime);
  assert.equal(reopened.body.playStartedAt, null);

  assert.equal((await timingRow(gameId)).effectivePlayTimeMs, finalTime);
});

test("effective time is monotonic across repeated opens", async () => {
  const cookie = await register(unique("t_mono"));
  const gameId = await createGame(cookie);

  let previous = 0;
  for (let i = 0; i < 4; i += 1) {
    const res = await req("GET", `/api/games/${gameId}`, cookie);
    const value = res.body.effectivePlayTimeMs as number;
    assert.ok(value >= previous, `effective time decreased: ${previous} -> ${value}`);
    assert.ok(value >= 0);
    previous = value;
  }
});
