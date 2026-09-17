import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../src/config/game.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resumeIntervalData } from "../../src/modules/games/game-timing.js";
import type { StartingPageProvider } from "../../src/modules/games/starting-page.provider.js";
import { WikipediaError } from "../../src/modules/wikipedia/wikipedia.errors.js";
import { WikipediaService } from "../../src/modules/wikipedia/wikipedia.service.js";

// Effective play time is now tracked with two nullable timestamps directly on
// `Game` — there is no `game_sessions` table any more. These tests exercise the
// resume / heartbeat / activity / completion timing behaviour.

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

const START_PAGE_ID = 1;
let resolveDelayMs = 0;
let articleDelayMs = 0;
let articleDelayPageId: number | null = null;
let articleFailuresRemaining = 0;
let lastArticleReadyAt = 0;

function titleFor(pageId: number): string {
  return pageId === TARGET_PAGE_ID ? TARGET_PAGE_TITLE : `Page ${pageId}`;
}

const linkGraph = new Map<number, { pageId: number; title: string }[]>([
  [
    1,
    [2, TARGET_PAGE_ID].map((pageId) => ({ pageId, title: titleFor(pageId) })),
  ],
  [2, [3, TARGET_PAGE_ID].map((pageId) => ({ pageId, title: titleFor(pageId) }))],
  [3, [{ pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE }]],
]);

function makeFakeWikipedia(): WikipediaService {
  return {
    resolveNavigation: async (pageId: number, title: string) => {
      if (resolveDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, resolveDelayMs));
      }
      return linkGraph.get(pageId)?.find((link) => link.title === title) ?? null;
    },
    getArticle: async (pageId: number) => {
      if (
        articleDelayMs > 0 &&
        (articleDelayPageId === null || articleDelayPageId === pageId)
      ) {
        await new Promise((resolve) => setTimeout(resolve, articleDelayMs));
      }
      if (articleFailuresRemaining > 0) {
        articleFailuresRemaining -= 1;
        throw new WikipediaError("NETWORK", "Simulated article failure");
      }
      lastArticleReadyAt = Date.now();
      return {
        pageId,
        title: titleFor(pageId),
        contentHtml: `<p>Article ${pageId}</p>`,
        links: linkGraph.get(pageId) ?? [],
      };
    },
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
  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  const game = parsed.game;
  return {
    status: res.status,
    body:
      typeof game === "object" && game !== null
        ? { ...(game as Record<string, unknown>), article: parsed.article }
        : parsed,
  };
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

test("initial article loading finishes before the active interval starts", async () => {
  const cookie = await register(unique("t_initload"));
  const gameId = await createGame(cookie);
  articleDelayMs = 300;
  try {
    const opened = await req("GET", `/api/games/${gameId}`, cookie);
    assert.equal(opened.status, 200);
    assert.equal((opened.body.article as { pageId?: number }).pageId, START_PAGE_ID);

    const row = await timingRow(gameId);
    assert.ok(row.playStartedAt!.getTime() >= lastArticleReadyAt);
    assert.equal(row.effectivePlayTimeMs, 0);
  } finally {
    articleDelayMs = 0;
  }
});

test("a heartbeat during initial article preparation is capped at the preparation-start boundary", async () => {
  const cookie = await register(unique("t_init_hb"));
  const gameId = await createGame(cookie);
  const startedAt = new Date(Date.now() - 10_000);
  await prisma.game.update({
    where: { id: gameId },
    data: {
      effectivePlayTimeMs: 0,
      playStartedAt: startedAt,
      lastHeartbeatAt: startedAt,
    },
  });

  articleDelayMs = 2_000;
  try {
    const opening = req("GET", `/api/games/${gameId}`, cookie);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    assert.equal(
      (await req("POST", `/api/games/${gameId}/heartbeat`, cookie)).status,
      204,
    );
    assert.equal((await opening).status, 200);

    const row = await timingRow(gameId);
    assert.ok(row.effectivePlayTimeMs >= 9_500);
    assert.ok(
      row.effectivePlayTimeMs < 10_700,
      `article preparation leaked into effective time: ${row.effectivePlayTimeMs}`,
    );
  } finally {
    articleDelayMs = 0;
  }
});

test("initial article preparation failure leaves all timing fields unchanged", async () => {
  const cookie = await register(unique("t_init_fail"));
  const gameId = await createGame(cookie);
  const playStartedAt = new Date(Date.now() - 8_000);
  const lastHeartbeatAt = new Date(Date.now() - 3_000);
  await prisma.game.update({
    where: { id: gameId },
    data: { effectivePlayTimeMs: 12_345, playStartedAt, lastHeartbeatAt },
  });
  const before = await timingRow(gameId);

  articleFailuresRemaining = 1;
  const failed = await req("GET", `/api/games/${gameId}`, cookie);
  assert.equal(failed.status, 502);
  assert.equal((failed.body.error as { code?: string }).code, "WIKIPEDIA_UNAVAILABLE");

  const after = await timingRow(gameId);
  assert.equal(after.effectivePlayTimeMs, before.effectivePlayTimeMs);
  assert.equal(after.playStartedAt?.getTime(), before.playStartedAt?.getTime());
  assert.equal(after.lastHeartbeatAt?.getTime(), before.lastHeartbeatAt?.getTime());
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

test("a valid move finalizes through its start boundary and starts a fresh interval", async () => {
  const cookie = await register(unique("t_move"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);

  await prisma.game.update({
    where: { id: gameId },
    data: { lastHeartbeatAt: new Date(Date.now() - 60_000) },
  });

  const moved = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toTitle: titleFor(2),
  });
  assert.equal(moved.status, 200);

  const row = await timingRow(gameId);
  assert.ok(row.lastHeartbeatAt!.getTime() > Date.now() - 5_000);
  assert.ok(row.effectivePlayTimeMs >= 0);
  assert.ok(row.playStartedAt!.getTime() > Date.now() - 5_000);
});

test("successful navigation excludes artificial MediaWiki delay", async () => {
  const cookie = await register(unique("t_move_delay"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);
  await prisma.game.update({
    where: { id: gameId },
    data: {
      effectivePlayTimeMs: 0,
      playStartedAt: new Date(Date.now() - 5_000),
      lastHeartbeatAt: new Date(Date.now() - 5_000),
    },
  });

  resolveDelayMs = 800;
  try {
    const moved = await req("POST", `/api/games/${gameId}/moves`, cookie, {
      toTitle: titleFor(2),
    });
    assert.equal(moved.status, 200);
    assert.equal((moved.body.article as { pageId?: number }).pageId, 2);

    const row = await timingRow(gameId);
    assert.ok(row.effectivePlayTimeMs >= 4_500);
    assert.ok(
      row.effectivePlayTimeMs < 5_600,
      `MediaWiki delay leaked into effective time: ${row.effectivePlayTimeMs}`,
    );
  } finally {
    resolveDelayMs = 0;
  }
});

test("two prepared navigations restart after response-state work and reconcile only the client gap", async () => {
  const cookie = await register(unique("t_two_cycles"));
  const gameId = await createGame(cookie);
  const opened = await req("GET", `/api/games/${gameId}`, cookie);
  assert.equal(opened.status, 200);

  let authoritativeEffective = opened.body.effectivePlayTimeMs as number;
  let backendIntervalStart = Date.parse(opened.body.playStartedAt as string);

  resolveDelayMs = 800;
  try {
    for (const destinationPageId of [2, 3]) {
      // Model response transfer/client processing before the HUD baseline starts,
      // followed by a deterministic period of genuinely playable time.
      await new Promise((resolve) => setTimeout(resolve, 250));
      const clientBaseline = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const requestStartedByClient = Date.now();
      const localPlayableMs = requestStartedByClient - clientBaseline;

      const moved = await req("POST", `/api/games/${gameId}/moves`, cookie, {
        toTitle: titleFor(destinationPageId),
      });
      assert.equal(moved.status, 200);

      const nextEffective = moved.body.effectivePlayTimeMs as number;
      const finalizedInterval = nextEffective - authoritativeEffective;
      const intervalExpectedAtClientSend =
        requestStartedByClient - backendIntervalStart;

      // The 800 ms MediaWiki delay is absent. The small permitted difference is
      // request transport/auth work before the server-owned route boundary.
      assert.ok(
        Math.abs(finalizedInterval - intervalExpectedAtClientSend) < 300,
        `unexpected reconciliation delta: finalized=${finalizedInterval}, expected≈${intervalExpectedAtClientSend}`,
      );
      assert.ok(
        finalizedInterval - localPlayableMs < 600,
        `MediaWiki delay leaked into reconciliation: ${finalizedInterval - localPlayableMs}`,
      );

      const nextIntervalStart = Date.parse(moved.body.playStartedAt as string);
      const moves = moved.body.moves as { createdAt: string }[];
      assert.ok(nextIntervalStart >= Date.parse(moves.at(-1)!.createdAt));
      assert.ok(nextIntervalStart >= lastArticleReadyAt);

      authoritativeEffective = nextEffective;
      backendIntervalStart = nextIntervalStart;
    }
  } finally {
    resolveDelayMs = 0;
  }
});

test("an invalid move does not split the continuous playable interval", async () => {
  const cookie = await register(unique("t_invalid"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);
  const startedAt = new Date(Date.now() - 1_000);
  await prisma.game.update({
    where: { id: gameId },
    data: { effectivePlayTimeMs: 0, playStartedAt: startedAt, lastHeartbeatAt: startedAt },
  });

  const rejected = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toTitle: "Not reachable",
  });
  assert.equal(rejected.status, 422);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const won = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toTitle: TARGET_PAGE_TITLE,
  });
  assert.equal(won.status, 200);

  const row = await timingRow(gameId);
  assert.ok(
    row.effectivePlayTimeMs >= 1_200,
    `invalid move created free time: ${row.effectivePlayTimeMs}`,
  );
});

test("a rejected backtrack does not split the continuous playable interval", async () => {
  const cookie = await register(unique("t_back_reject"));
  const gameId = await createGame(cookie);
  const startedAt = new Date(Date.now() - 1_000);
  await prisma.game.update({
    where: { id: gameId },
    data: { effectivePlayTimeMs: 0, playStartedAt: startedAt, lastHeartbeatAt: startedAt },
  });

  const rejected = await req("POST", `/api/games/${gameId}/backtrack`, cookie, {});
  assert.equal(rejected.status, 422);
  assert.equal(
    (rejected.body.error as { code?: string }).code,
    "BACKTRACK_NOT_ALLOWED",
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  const won = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toTitle: TARGET_PAGE_TITLE,
  });
  assert.equal(won.status, 200);

  const row = await timingRow(gameId);
  assert.ok(
    row.effectivePlayTimeMs >= 1_200,
    `rejected backtrack created free time: ${row.effectivePlayTimeMs}`,
  );
});

test("a heartbeat during navigation cannot add the excluded loading interval", async () => {
  const cookie = await register(unique("t_hbnav"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);
  await prisma.game.update({
    where: { id: gameId },
    data: {
      effectivePlayTimeMs: 0,
      playStartedAt: new Date(Date.now() - 5_000),
      lastHeartbeatAt: new Date(Date.now() - 5_000),
    },
  });

  resolveDelayMs = 800;
  try {
    const moving = req("POST", `/api/games/${gameId}/moves`, cookie, {
      toTitle: titleFor(2),
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(
      (await req("POST", `/api/games/${gameId}/heartbeat`, cookie)).status,
      204,
    );
    assert.equal((await moving).status, 200);

    const row = await timingRow(gameId);
    assert.ok(row.effectivePlayTimeMs < 5_600);
    assert.ok(row.playStartedAt!.getTime() > row.lastHeartbeatAt!.getTime() - 10);
  } finally {
    resolveDelayMs = 0;
  }
});

test("prepared GET reconciliation and heartbeat serialize without losing bounded time", async () => {
  const cookie = await register(unique("t_get_hb_lock"));
  const gameId = await createGame(cookie);
  const playStartedAt = new Date(Date.now() - 10_000);
  const lastHeartbeatAt = new Date(Date.now() - 4_000);
  await prisma.game.update({
    where: { id: gameId },
    data: { effectivePlayTimeMs: 2_000, playStartedAt, lastHeartbeatAt },
  });

  let signalLocked!: () => void;
  const locked = new Promise<void>((resolve) => {
    signalLocked = resolve;
  });
  let releaseLock!: () => void;
  const release = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const blocker = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "games" WHERE "id" = ${gameId}::uuid FOR UPDATE`;
    signalLocked();
    await release;
  });
  await locked;

  articleDelayMs = 100;
  try {
    const opening = req("GET", `/api/games/${gameId}`, cookie);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const heartbeat = req("POST", `/api/games/${gameId}/heartbeat`, cookie);
    await new Promise((resolve) => setTimeout(resolve, 100));
    releaseLock();
    await blocker;

    const [opened, heartbeatResult] = await Promise.all([opening, heartbeat]);
    assert.equal(opened.status, 200);
    assert.equal(heartbeatResult.status, 204);

    const row = await timingRow(gameId);
    const expected =
      2_000 + lastHeartbeatAt.getTime() - playStartedAt.getTime();
    assert.equal(row.effectivePlayTimeMs, expected);
    assert.ok(row.lastHeartbeatAt!.getTime() >= row.playStartedAt!.getTime());
  } finally {
    articleDelayMs = 0;
    releaseLock();
    await blocker;
  }
});

test("prepared GET returns GAME_STATE_CHANGED when navigation wins during article preparation", async () => {
  const cookie = await register(unique("t_get_changed"));
  const gameId = await createGame(cookie);

  articleDelayMs = 800;
  articleDelayPageId = START_PAGE_ID;
  try {
    const opening = req("GET", `/api/games/${gameId}`, cookie);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const moved = await req("POST", `/api/games/${gameId}/moves`, cookie, {
      toTitle: titleFor(2),
    });
    assert.equal(moved.status, 200);

    const staleOpen = await opening;
    assert.equal(staleOpen.status, 409);
    assert.equal(
      (staleOpen.body.error as { code?: string }).code,
      "GAME_STATE_CHANGED",
    );
  } finally {
    articleDelayMs = 0;
    articleDelayPageId = null;
  }
});

test("backtracking prepares its article and excludes artificial loading delay", async () => {
  const cookie = await register(unique("t_backdelay"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);
  await req("POST", `/api/games/${gameId}/moves`, cookie, { toTitle: titleFor(2) });
  const before = await timingRow(gameId);
  await prisma.game.update({
    where: { id: gameId },
    data: {
      playStartedAt: new Date(Date.now() - 5_000),
      lastHeartbeatAt: new Date(Date.now() - 5_000),
    },
  });

  articleDelayMs = 800;
  try {
    const backed = await req("POST", `/api/games/${gameId}/backtrack`, cookie, {});
    assert.equal(backed.status, 200);
    assert.equal(backed.body.currentPageId, START_PAGE_ID);
    assert.equal((backed.body.article as { pageId?: number }).pageId, START_PAGE_ID);

    const row = await timingRow(gameId);
    const added = row.effectivePlayTimeMs - before.effectivePlayTimeMs;
    assert.ok(added >= 4_500);
    assert.ok(added < 5_600, `backtrack loading leaked into time: ${added}`);
  } finally {
    articleDelayMs = 0;
  }
});

test("refresh after navigation counts each playable interval exactly once", async () => {
  const cookie = await register(unique("t_ref_exact"));
  const gameId = await createGame(cookie);
  const initialStart = new Date(Date.now() - 5_000);
  await prisma.game.update({
    where: { id: gameId },
    data: {
      effectivePlayTimeMs: 1_000,
      playStartedAt: initialStart,
      lastHeartbeatAt: initialStart,
    },
  });

  resolveDelayMs = 500;
  try {
    const moved = await req("POST", `/api/games/${gameId}/moves`, cookie, {
      toTitle: titleFor(2),
    });
    assert.equal(moved.status, 200);
  } finally {
    resolveDelayMs = 0;
  }

  const afterMove = await timingRow(gameId);
  const postNavigationStart = new Date(Date.now() - 3_000);
  const postNavigationHeartbeat = new Date(postNavigationStart.getTime() + 2_000);
  await prisma.game.update({
    where: { id: gameId },
    data: {
      playStartedAt: postNavigationStart,
      lastHeartbeatAt: postNavigationHeartbeat,
    },
  });

  articleDelayMs = 500;
  try {
    const refreshed = await req("GET", `/api/games/${gameId}`, cookie);
    assert.equal(refreshed.status, 200);
  } finally {
    articleDelayMs = 0;
  }

  const afterRefresh = await timingRow(gameId);
  assert.equal(
    afterRefresh.effectivePlayTimeMs,
    afterMove.effectivePlayTimeMs + 2_000,
  );
  assert.ok(afterRefresh.playStartedAt!.getTime() > postNavigationHeartbeat.getTime());
  assert.equal(
    afterRefresh.lastHeartbeatAt!.getTime(),
    afterRefresh.playStartedAt!.getTime(),
  );
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
    toTitle: TARGET_PAGE_TITLE,
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

test("the winning move excludes artificial navigation processing delay", async () => {
  const cookie = await register(unique("t_win_delay"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);
  await prisma.game.update({
    where: { id: gameId },
    data: { playStartedAt: new Date(Date.now() - 5_000) },
  });

  resolveDelayMs = 800;
  try {
    const won = await req("POST", `/api/games/${gameId}/moves`, cookie, {
      toTitle: TARGET_PAGE_TITLE,
    });
    assert.equal(won.status, 200);
    assert.equal(won.body.status, "COMPLETED");
    assert.equal(won.body.article, null);

    const row = await timingRow(gameId);
    assert.ok(row.effectivePlayTimeMs >= 4_500);
    assert.ok(row.effectivePlayTimeMs < 5_600);
  } finally {
    resolveDelayMs = 0;
  }
});

test("a completed game rejects heartbeats and its effective time is final", async () => {
  const cookie = await register(unique("t_done"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);
  await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toTitle: TARGET_PAGE_TITLE,
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

// ---------------------------------------------------------------------------
// Race safety: a resume GET arriving around completion
// ---------------------------------------------------------------------------

test("a stale resume write cannot overwrite a game the winning move already completed", async () => {
  const cookie = await register(unique("t_getrace"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie); // open

  // The interval began ~2 minutes ago.
  await prisma.game.update({
    where: { id: gameId },
    data: { playStartedAt: new Date(Date.now() - 120_000) },
  });

  // Exactly what GamesService.get() reads before it issues its resume write.
  const staleRead = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });

  // The winning move completes the game and finalizes effective time.
  const win = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toTitle: TARGET_PAGE_TITLE,
  });
  assert.equal(win.body.status, "COMPLETED");
  const finalized = await timingRow(gameId);
  assert.equal(finalized.status, "COMPLETED");
  assert.ok(finalized.effectivePlayTimeMs >= 118_000);

  // Replay the resume write GamesService.get() would now attempt with its stale
  // read. The `status: IN_PROGRESS` guard must make it match no row.
  const { count } = await prisma.game.updateMany({
    where: { id: gameId, status: "IN_PROGRESS" },
    data: resumeIntervalData(staleRead, new Date()),
  });
  assert.equal(count, 0, "stale resume write must match no row");

  const after = await timingRow(gameId);
  assert.equal(after.status, "COMPLETED");
  assert.equal(after.effectivePlayTimeMs, finalized.effectivePlayTimeMs);
  assert.equal(after.playStartedAt, null);
  assert.equal(after.lastHeartbeatAt, null);
});

test("GET racing a winning move either completes or rejects the stale move without truncating time", async () => {
  const cookie = await register(unique("t_getrace2"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);
  await prisma.game.update({
    where: { id: gameId },
    data: { playStartedAt: new Date(Date.now() - 60_000) },
  });

  const [, racedWin] = await Promise.all([
    req("GET", `/api/games/${gameId}`, cookie),
    req("POST", `/api/games/${gameId}/moves`, cookie, { toTitle: TARGET_PAGE_TITLE }),
  ]);

  assert.ok(racedWin.status === 200 || racedWin.status === 409);
  if (racedWin.status === 409) {
    assert.equal(
      (racedWin.body.error as { code?: string }).code,
      "GAME_STATE_CHANGED",
    );
  }
  const win =
    racedWin.status === 200
      ? racedWin
      : await req("POST", `/api/games/${gameId}/moves`, cookie, {
          toTitle: TARGET_PAGE_TITLE,
        });
  assert.equal(win.status, 200);
  assert.equal(win.body.status, "COMPLETED");

  const row = await timingRow(gameId);
  assert.equal(row.status, "COMPLETED");
  assert.equal(row.playStartedAt, null, "playStartedAt must not be resurrected");
  assert.equal(row.lastHeartbeatAt, null, "lastHeartbeatAt must not be resurrected");
  // The ~60s interval was accounted (by whichever of GET-resume / winning move
  // ran first); it was never truncated away by a stale write.
  assert.ok(
    row.effectivePlayTimeMs >= 58_000,
    `effective time ${row.effectivePlayTimeMs} was truncated`,
  );
});

test("a heartbeat racing the winning move cannot resurrect lastHeartbeatAt on the completed game", async () => {
  const cookie = await register(unique("t_hbrace"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);

  const [hb, win] = await Promise.all([
    req("POST", `/api/games/${gameId}/heartbeat`, cookie),
    req("POST", `/api/games/${gameId}/moves`, cookie, { toTitle: TARGET_PAGE_TITLE }),
  ]);

  assert.equal(win.body.status, "COMPLETED");
  // The heartbeat either lands first (204) or after completion (409) — never
  // leaves the completed row with a non-null lastHeartbeatAt.
  assert.ok(hb.status === 204 || hb.status === 409);

  const row = await timingRow(gameId);
  assert.equal(row.status, "COMPLETED");
  assert.equal(row.playStartedAt, null);
  assert.equal(row.lastHeartbeatAt, null);
});

// ---------------------------------------------------------------------------
// Heartbeat then completion; and the (null playStartedAt, set lastHeartbeatAt) state
// ---------------------------------------------------------------------------

test("a heartbeat immediately before the winning move does not cap effective time at the heartbeat", async () => {
  const cookie = await register(unique("t_hbwin"));
  const gameId = await createGame(cookie);
  await req("GET", `/api/games/${gameId}`, cookie);

  // Interval began ~2 min ago; the previous heartbeat was ~90s ago.
  await prisma.game.update({
    where: { id: gameId },
    data: {
      playStartedAt: new Date(Date.now() - 120_000),
      lastHeartbeatAt: new Date(Date.now() - 90_000),
    },
  });

  // 1. a heartbeat now — lastHeartbeatAt jumps to ~now
  const hb = await req("POST", `/api/games/${gameId}/heartbeat`, cookie);
  assert.equal(hb.status, 204);

  // 2. the winning move immediately after
  const win = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toTitle: TARGET_PAGE_TITLE,
  });
  assert.equal(win.body.status, "COMPLETED");

  const row = await timingRow(gameId);
  // Completion accounts `now - playStartedAt` (~120s). It is NOT limited to the
  // ~0s gap between the fresh heartbeat and completion, nor to the stale
  // `lastHeartbeatAt - playStartedAt` (~30s) window.
  assert.ok(
    row.effectivePlayTimeMs >= 118_000,
    `expected ~120000, got ${row.effectivePlayTimeMs}`,
  );
  assert.ok(row.effectivePlayTimeMs <= 130_000);
  assert.equal(row.playStartedAt, null);
  assert.equal(row.lastHeartbeatAt, null);
});

test("a successful move before the first GET starts timing only after its article is ready", async () => {
  const cookie = await register(unique("t_nullps"));
  const gameId = await createGame(cookie);

  const fresh = await timingRow(gameId);
  assert.equal(fresh.playStartedAt, null);
  assert.equal(fresh.lastHeartbeatAt, null);

  // No GET / resume — a direct API client moves straight away.
  const m1 = await req("POST", `/api/games/${gameId}/moves`, cookie, { toTitle: titleFor(2) });
  assert.equal(m1.status, 200);

  const mid = await timingRow(gameId);
  assert.notEqual(mid.playStartedAt, null, "the prepared destination starts an interval");
  assert.notEqual(mid.lastHeartbeatAt, null, "the move starts the activity stamp");

  // Completion remains valid and clears the timing fields.
  const win = await req("POST", `/api/games/${gameId}/moves`, cookie, {
    toTitle: TARGET_PAGE_TITLE,
  });
  assert.equal(win.status, 200);
  assert.equal(win.body.status, "COMPLETED");

  const row = await timingRow(gameId);
  assert.equal(row.status, "COMPLETED");
  assert.ok(row.effectivePlayTimeMs >= 0);
  assert.equal(row.playStartedAt, null);
  assert.equal(row.lastHeartbeatAt, null);
});
