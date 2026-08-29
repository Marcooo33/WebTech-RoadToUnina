import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../src/app.js";
import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../src/config/game.js";
import { prisma } from "../../src/lib/prisma.js";
import type { StartingPageProvider } from "../../src/modules/games/starting-page.provider.js";
import { WikipediaService } from "../../src/modules/wikipedia/wikipedia.service.js";

// The heartbeat timeout defaults to 90s (SESSION_HEARTBEAT_TIMEOUT). Tests never
// sleep for real time; "expired" and "aged" sessions are produced by writing
// back-dated timestamps straight to the database.
const HEARTBEAT_TIMEOUT_MS = 90_000;

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

const START_PAGE_ID = 1;

interface PageRef {
  pageId: number;
  title: string;
}

function titleFor(pageId: number): string {
  return pageId === TARGET_PAGE_ID ? TARGET_PAGE_TITLE : `Page ${pageId}`;
}

function refs(ids: number[]): PageRef[] {
  return ids.map((pageId) => ({ pageId, title: titleFor(pageId) }));
}

const linkGraph = new Map<number, PageRef[]>([
  [1, refs([2, 3, TARGET_PAGE_ID])],
  [2, refs([3, TARGET_PAGE_ID])],
  [3, refs([TARGET_PAGE_ID])],
]);

function makeFakeWikipedia(): WikipediaService {
  return {
    getValidInternalLinks: async (pageId: number) => linkGraph.get(pageId) ?? [],
    getArticle: async (pageId: number) => ({
      pageId,
      title: titleFor(pageId),
      contentHtml: `<p>Article for page ${pageId}</p>`,
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

function parseCookie(setCookie: string): string {
  return setCookie.split(";")[0].split("=")[1];
}

interface Json {
  [key: string]: unknown;
}

async function register(username: string): Promise<{ userId: string; cookie: string }> {
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
  return { userId: body.id, cookie: parseCookie(res.headers.getSetCookie()[0]) };
}

async function login(username: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: username, password: "password123" }),
  });
  assert.equal(res.status, 200);
  return parseCookie(res.headers.getSetCookie()[0]);
}

async function req(
  method: string,
  path: string,
  cookie?: string,
  body?: unknown,
): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = `access_token=${cookie}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Json) : {} };
}

const createGame = (cookie: string, mode = "TIME", difficulty = "EASY") =>
  req("POST", "/api/games", cookie, { mode, difficulty });
const startSession = (cookie: string, gameId: string) =>
  req("POST", `/api/games/${gameId}/session`, cookie);
const heartbeat = (cookie: string, gameId: string) =>
  req("POST", `/api/games/${gameId}/session/heartbeat`, cookie);
const endSession = (cookie: string, gameId: string) =>
  req("POST", `/api/games/${gameId}/session/end`, cookie);
const move = (cookie: string, gameId: string, toPageId: number, version: number) =>
  req("POST", `/api/games/${gameId}/moves`, cookie, { toPageId, version });
const backtrack = (cookie: string, gameId: string, version: number) =>
  req("POST", `/api/games/${gameId}/backtrack`, cookie, { version });
const getGame = (cookie: string, gameId: string) =>
  req("GET", `/api/games/${gameId}`, cookie);

async function activeSessionRow(gameId: string) {
  return prisma.gameSession.findFirstOrThrow({
    where: { gameId, status: "ACTIVE" },
  });
}

async function gameRow(gameId: string) {
  return prisma.game.findUniqueOrThrow({ where: { id: gameId } });
}

/** Back-date the game's ACTIVE session so it is past the heartbeat timeout. */
async function expireActiveSession(
  gameId: string,
  startedMsAgo = 300_000,
  lastHeartbeatMsAgo = 150_000,
): Promise<{ startedAt: Date; lastHeartbeatAt: Date; expectedDurationMs: number }> {
  const base = Date.now();
  const startedAt = new Date(base - startedMsAgo);
  const lastHeartbeatAt = new Date(base - lastHeartbeatMsAgo);
  const session = await activeSessionRow(gameId);
  await prisma.gameSession.update({
    where: { id: session.id },
    data: { startedAt, lastHeartbeatAt },
  });
  return {
    startedAt,
    lastHeartbeatAt,
    expectedDurationMs: startedMsAgo - lastHeartbeatMsAgo,
  };
}

/** Back-date only startedAt, keeping the session live (heartbeat = now). */
async function ageActiveSession(gameId: string, startedMsAgo: number): Promise<void> {
  const session = await activeSessionRow(gameId);
  await prisma.gameSession.update({
    where: { id: session.id },
    data: {
      startedAt: new Date(Date.now() - startedMsAgo),
      lastHeartbeatAt: new Date(),
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

// ---------------------------------------------------------------------------
// Start / resume
// ---------------------------------------------------------------------------

test("start session creates exactly one ACTIVE session", async () => {
  const { cookie } = await register(unique("s_start"));
  const { body: game } = await createGame(cookie);

  const res = await startSession(cookie, game.id as string);

  assert.equal(res.status, 200);
  const session = res.body.session as Json;
  assert.equal(session.status, "ACTIVE");
  assert.equal(session.gameId, game.id);
  assert.equal(session.endedAt, null);
  assert.equal(res.body.effectivePlayTimeMs, 0);
  assert.equal(res.body.gameVersion, 0);

  const rows = await prisma.gameSession.findMany({ where: { gameId: game.id as string } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "ACTIVE");

  // Starting a live session does not mutate the game.
  assert.equal((await gameRow(game.id as string)).version, 0);
});

test("starting twice returns the same live session (refresh-safe)", async () => {
  const { cookie } = await register(unique("s_twice"));
  const { body: game } = await createGame(cookie);

  const first = await startSession(cookie, game.id as string);
  const second = await startSession(cookie, game.id as string);

  assert.equal(second.status, 200);
  assert.equal((second.body.session as Json).id, (first.body.session as Json).id);
  assert.equal(
    await prisma.gameSession.count({ where: { gameId: game.id as string } }),
    1,
  );
});

test("the same user from another cookie/device reuses the live session", async () => {
  const username = unique("s_device");
  const { cookie } = await register(username);
  const { body: game } = await createGame(cookie);

  const first = await startSession(cookie, game.id as string);

  const otherCookie = await login(username);
  const second = await startSession(otherCookie, game.id as string);

  assert.equal(second.status, 200);
  assert.equal((second.body.session as Json).id, (first.body.session as Json).id);
  assert.equal(
    await prisma.gameSession.count({
      where: { gameId: game.id as string, status: "ACTIVE" },
    }),
    1,
  );
});

test("starting a session on a completed game is rejected", async () => {
  const { cookie } = await register(unique("s_done"));
  const { body: game } = await createGame(cookie);
  await startSession(cookie, game.id as string);

  const winning = await move(cookie, game.id as string, TARGET_PAGE_ID, 0);
  assert.equal(winning.status, 200);
  assert.equal(winning.body.status, "COMPLETED");

  const res = await startSession(cookie, game.id as string);
  assert.equal(res.status, 409);
  assert.equal((res.body.error as Json).code, "GAME_NOT_IN_PROGRESS");
});

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

test("heartbeat advances lastHeartbeatAt without changing the game version", async () => {
  const { cookie } = await register(unique("s_hb"));
  const { body: game } = await createGame(cookie);
  await startSession(cookie, game.id as string);

  // Move the heartbeat 10s into the past (still live), then beat again.
  const tenSecondsAgo = new Date(Date.now() - 10_000);
  const session = await activeSessionRow(game.id as string);
  await prisma.gameSession.update({
    where: { id: session.id },
    data: { lastHeartbeatAt: tenSecondsAgo },
  });

  const res = await heartbeat(cookie, game.id as string);

  assert.equal(res.status, 200);
  assert.equal(res.body.gameVersion, 0);
  const beat = new Date((res.body.session as Json).lastHeartbeatAt as string);
  assert.ok(beat.getTime() > tenSecondsAgo.getTime());
  assert.equal((await gameRow(game.id as string)).version, 0);
});

test("heartbeat with no active session returns NO_ACTIVE_SESSION", async () => {
  const { cookie } = await register(unique("s_hb_none"));
  const { body: game } = await createGame(cookie);

  const res = await heartbeat(cookie, game.id as string);

  assert.equal(res.status, 409);
  assert.equal((res.body.error as Json).code, "NO_ACTIVE_SESSION");
});

test("heartbeat on an expired session finalizes it once using the last heartbeat", async () => {
  const { cookie } = await register(unique("s_hb_exp"));
  const { body: game } = await createGame(cookie);
  await startSession(cookie, game.id as string);
  const { lastHeartbeatAt, expectedDurationMs } = await expireActiveSession(
    game.id as string,
  );

  const res = await heartbeat(cookie, game.id as string);
  assert.equal(res.status, 409);
  assert.equal((res.body.error as Json).code, "NO_ACTIVE_SESSION");

  const finalized = await prisma.gameSession.findFirstOrThrow({
    where: { gameId: game.id as string },
  });
  assert.equal(finalized.status, "EXPIRED");
  assert.equal(finalized.endedAt?.getTime(), lastHeartbeatAt.getTime());

  const afterGame = await gameRow(game.id as string);
  assert.equal(afterGame.effectivePlayTimeMs, expectedDurationMs);
  assert.equal(afterGame.version, 1);

  // A second heartbeat must not add the duration again.
  const again = await heartbeat(cookie, game.id as string);
  assert.equal(again.status, 409);
  const stable = await gameRow(game.id as string);
  assert.equal(stable.effectivePlayTimeMs, expectedDurationMs);
  assert.equal(stable.version, 1);
});

// ---------------------------------------------------------------------------
// Explicit end
// ---------------------------------------------------------------------------

test("explicit end finalizes the session and accumulates effective time", async () => {
  const { cookie } = await register(unique("s_end"));
  const { body: game } = await createGame(cookie);
  await startSession(cookie, game.id as string);
  await ageActiveSession(game.id as string, 60_000);

  const res = await endSession(cookie, game.id as string);

  assert.equal(res.status, 200);
  assert.equal((res.body.session as Json).status, "ENDED");
  assert.notEqual((res.body.session as Json).endedAt, null);
  assert.equal(res.body.gameVersion, 1);
  const elapsed = res.body.effectivePlayTimeMs as number;
  assert.ok(elapsed >= 60_000 && elapsed < 65_000, `elapsed=${elapsed}`);

  const afterGame = await gameRow(game.id as string);
  assert.equal(afterGame.effectivePlayTimeMs, elapsed);
  assert.equal(afterGame.version, 1);
});

test("ending with no active session returns NO_ACTIVE_SESSION", async () => {
  const { cookie } = await register(unique("s_end_none"));
  const { body: game } = await createGame(cookie);

  const res = await endSession(cookie, game.id as string);
  assert.equal(res.status, 409);
  assert.equal((res.body.error as Json).code, "NO_ACTIVE_SESSION");
});

test("multiple sessions accumulate effective time and exclude downtime", async () => {
  const { cookie } = await register(unique("s_multi"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;

  await startSession(cookie, gameId);
  await ageActiveSession(gameId, 60_000);
  const first = await endSession(cookie, gameId);
  assert.equal(first.status, 200);

  // Downtime here (wall clock) must not be counted.
  await startSession(cookie, gameId);
  await ageActiveSession(gameId, 30_000);
  const second = await endSession(cookie, gameId);
  assert.equal(second.status, 200);

  const total = (await gameRow(gameId)).effectivePlayTimeMs;
  assert.ok(total >= 90_000 && total < 100_000, `total=${total}`);
  assert.equal((await gameRow(gameId)).version, 2);
  assert.ok(total >= 0);
});

// ---------------------------------------------------------------------------
// Gameplay preconditions (docs/api.md §5.6, §5.7, §9.3)
// ---------------------------------------------------------------------------

test("move without an active session is rejected and mutates nothing", async () => {
  const { cookie } = await register(unique("s_mv_none"));
  const { body: game } = await createGame(cookie);

  const res = await move(cookie, game.id as string, 2, 0);
  assert.equal(res.status, 409);
  assert.equal((res.body.error as Json).code, "NO_ACTIVE_SESSION");

  assert.equal(
    await prisma.gameMove.count({ where: { gameId: game.id as string } }),
    0,
  );
  const after = await gameRow(game.id as string);
  assert.equal(after.clickCount, 0);
  assert.equal(after.version, 0);
});

test("backtrack without an active session is rejected", async () => {
  const { cookie } = await register(unique("s_bt_none"));
  const { body: game } = await createGame(cookie);

  const res = await backtrack(cookie, game.id as string, 0);
  assert.equal(res.status, 409);
  assert.equal((res.body.error as Json).code, "NO_ACTIVE_SESSION");
});

test("move on an expired session finalizes it, bumps version and rejects the move", async () => {
  const { cookie } = await register(unique("s_mv_exp"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  await startSession(cookie, gameId);
  const { expectedDurationMs } = await expireActiveSession(gameId);

  const res = await move(cookie, gameId, 2, 0);
  assert.equal(res.status, 409);
  assert.equal((res.body.error as Json).code, "NO_ACTIVE_SESSION");

  assert.equal(await prisma.gameMove.count({ where: { gameId } }), 0);
  const after = await gameRow(gameId);
  assert.equal(after.effectivePlayTimeMs, expectedDurationMs);
  assert.equal(after.version, 1);
  assert.equal(after.clickCount, 0);
  assert.equal(
    (await prisma.gameSession.findFirstOrThrow({ where: { gameId } })).status,
    "EXPIRED",
  );
});

test("a fresh session can be started after expiry and gameplay resumes", async () => {
  const { cookie } = await register(unique("s_resume"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  await startSession(cookie, gameId);
  await expireActiveSession(gameId);
  await move(cookie, gameId, 2, 0); // triggers finalize + reject

  const resumed = await startSession(cookie, gameId);
  assert.equal(resumed.status, 200);
  assert.equal((resumed.body.session as Json).status, "ACTIVE");
  assert.equal(resumed.body.gameVersion, 1);

  const navigated = await move(cookie, gameId, 2, 1);
  assert.equal(navigated.status, 200);
  assert.equal(navigated.body.clickCount, 1);
  assert.equal(navigated.body.currentPageId, 2);

  const sessions = await prisma.gameSession.findMany({
    where: { gameId },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].status, "EXPIRED");
  assert.equal(sessions[1].status, "ACTIVE");
});

// ---------------------------------------------------------------------------
// Completion (docs/api.md §9.4)
// ---------------------------------------------------------------------------

test("a completing move ends the active session and finalizes effective time once", async () => {
  const { cookie } = await register(unique("s_complete"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  await startSession(cookie, gameId);
  await ageActiveSession(gameId, 45_000);

  const res = await move(cookie, gameId, TARGET_PAGE_ID, 0);

  assert.equal(res.status, 200);
  assert.equal(res.body.status, "COMPLETED");
  assert.equal(res.body.version, 1); // single version bump on completion
  assert.equal(res.body.activeSession, null);
  const elapsed = res.body.effectivePlayTimeMs as number;
  assert.ok(elapsed >= 45_000 && elapsed < 50_000, `elapsed=${elapsed}`);

  const session = await prisma.gameSession.findFirstOrThrow({ where: { gameId } });
  assert.equal(session.status, "ENDED");
  assert.notEqual(session.endedAt, null);

  const afterGame = await gameRow(gameId);
  assert.equal(afterGame.effectivePlayTimeMs, elapsed);
  assert.equal(afterGame.version, 1);
  assert.ok(afterGame.effectivePlayTimeMs >= 0);
});

// ---------------------------------------------------------------------------
// DTO exposure (read-only)
// ---------------------------------------------------------------------------

test("GET owned game exposes a live active session and never mutates", async () => {
  const { cookie } = await register(unique("s_get_live"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  const started = await startSession(cookie, gameId);

  const res = await getGame(cookie, gameId);
  assert.equal(res.status, 200);
  const active = res.body.activeSession as Json;
  assert.equal(active.id, (started.body.session as Json).id);
  assert.equal(active.status, "ACTIVE");
});

test("GET reports activeSession null for a timed-out but unfinalized session", async () => {
  const { cookie } = await register(unique("s_get_stale"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  await startSession(cookie, gameId);
  await expireActiveSession(gameId);

  const res = await getGame(cookie, gameId);
  assert.equal(res.status, 200);
  assert.equal(res.body.activeSession, null);

  // GET must not have finalized anything.
  const session = await prisma.gameSession.findFirstOrThrow({ where: { gameId } });
  assert.equal(session.status, "ACTIVE");
  assert.equal((await gameRow(gameId)).version, 0);
});

test("game list hasActiveSession follows the same liveness rule", async () => {
  const { cookie } = await register(unique("s_list"));
  const live = (await createGame(cookie)).body.id as string;
  const stale = (await createGame(cookie)).body.id as string;
  await startSession(cookie, live);
  await startSession(cookie, stale);
  await expireActiveSession(stale);

  const res = await req("GET", "/api/games", cookie);
  assert.equal(res.status, 200);
  const items = res.body.items as Array<{ id: string; hasActiveSession: boolean }>;
  assert.equal(items.find((i) => i.id === live)?.hasActiveSession, true);
  assert.equal(items.find((i) => i.id === stale)?.hasActiveSession, false);

  // The list is read-only.
  assert.equal(
    (await prisma.gameSession.findFirstOrThrow({ where: { gameId: stale } })).status,
    "ACTIVE",
  );
});

// ---------------------------------------------------------------------------
// Concurrency — a session duration is never counted twice
// ---------------------------------------------------------------------------

test("two concurrent ends: exactly one finalizes and time is added once", async () => {
  const { cookie } = await register(unique("s_cc_end"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  await startSession(cookie, gameId);
  await ageActiveSession(gameId, 60_000);

  const [a, b] = await Promise.all([
    endSession(cookie, gameId),
    endSession(cookie, gameId),
  ]);

  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 409]);
  const conflict = a.status === 409 ? a : b;
  assert.equal((conflict.body.error as Json).code, "NO_ACTIVE_SESSION");

  const afterGame = await gameRow(gameId);
  assert.equal(afterGame.version, 1);
  assert.ok(
    afterGame.effectivePlayTimeMs >= 60_000 && afterGame.effectivePlayTimeMs < 65_000,
  );
  assert.equal(
    await prisma.gameSession.count({ where: { gameId, status: "ENDED" } }),
    1,
  );
});

test("concurrent heartbeats on an expired session finalize it exactly once", async () => {
  const { cookie } = await register(unique("s_cc_exp"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  await startSession(cookie, gameId);
  const { expectedDurationMs } = await expireActiveSession(gameId);

  const results = await Promise.all([
    heartbeat(cookie, gameId),
    heartbeat(cookie, gameId),
    heartbeat(cookie, gameId),
  ]);

  for (const res of results) {
    assert.equal(res.status, 409);
  }
  const afterGame = await gameRow(gameId);
  assert.equal(afterGame.effectivePlayTimeMs, expectedDurationMs);
  assert.equal(afterGame.version, 1);
});

test("heartbeat racing an explicit end never double-counts", async () => {
  const { cookie } = await register(unique("s_cc_hbend"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  await startSession(cookie, gameId);
  await ageActiveSession(gameId, 60_000);

  const [end, beat] = await Promise.all([
    endSession(cookie, gameId),
    heartbeat(cookie, gameId),
  ]);

  assert.equal(end.status, 200);
  // The heartbeat either updated the still-ACTIVE row (200) or lost the race (409).
  assert.ok(beat.status === 200 || beat.status === 409);

  const afterGame = await gameRow(gameId);
  assert.equal(afterGame.version, 1);
  assert.ok(
    afterGame.effectivePlayTimeMs >= 60_000 && afterGame.effectivePlayTimeMs < 65_000,
  );
});

test("a move racing heartbeat detection on an expired session accounts time once", async () => {
  const { cookie } = await register(unique("s_cc_mv"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;
  await startSession(cookie, gameId);
  const { expectedDurationMs } = await expireActiveSession(gameId);

  const [mv, beat] = await Promise.all([
    move(cookie, gameId, 2, 0),
    heartbeat(cookie, gameId),
  ]);

  assert.equal(mv.status, 409);
  assert.equal(beat.status, 409);

  const afterGame = await gameRow(gameId);
  assert.equal(afterGame.effectivePlayTimeMs, expectedDurationMs);
  assert.equal(afterGame.version, 1);
  assert.equal(await prisma.gameMove.count({ where: { gameId } }), 0);
});

test("effective play time is never negative and is monotonic across a game", async () => {
  const { cookie } = await register(unique("s_monotonic"));
  const { body: game } = await createGame(cookie);
  const gameId = game.id as string;

  let previous = 0;
  for (const ageMs of [20_000, 15_000, 25_000]) {
    await startSession(cookie, gameId);
    await ageActiveSession(gameId, ageMs);
    await endSession(cookie, gameId);
    const current = (await gameRow(gameId)).effectivePlayTimeMs;
    assert.ok(current >= previous, `expected ${current} >= ${previous}`);
    assert.ok(current >= 0);
    previous = current;
  }
});

test("HEARTBEAT_TIMEOUT_MS constant matches the documented default", () => {
  // Guards the assumption used by the back-dating helpers above.
  assert.equal(HEARTBEAT_TIMEOUT_MS, 90_000);
});
