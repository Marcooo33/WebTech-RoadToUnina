import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { TARGET_PAGE_ID, TARGET_PAGE_TITLE } from "../../src/config/game.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import type { StartingPageProvider } from "../../src/modules/games/starting-page.provider.js";
import type { MediaWikiClient } from "../../src/modules/wikipedia/mediawiki.client.js";
import { WikipediaService } from "../../src/modules/wikipedia/wikipedia.service.js";
import type {
  TitleResolution,
  TitleResolutionSource,
} from "../../src/modules/wikipedia/wikipedia.types.js";

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

const START_PAGE_ID = 1;

interface PageRef {
  pageId: number;
  title: string;
}

interface MoveBody {
  sequence: number;
  type: string;
  fromPageId: number;
  fromPageTitle: string;
  toPageId: number;
  toPageTitle: string;
  createdAt: string;
}

interface GameBody {
  id?: string;
  mode?: string;
  difficulty?: string;
  status?: string;
  startPageId?: number;
  startPageTitle?: string;
  currentPageId?: number;
  currentPageTitle?: string;
  clickCount?: number;
  backtrackCount?: number;
  effectivePlayTimeMs?: number;
  playStartedAt?: string | null;
  startedAt?: string;
  completedAt?: string | null;
  createdAt?: string;
  path?: PageRef[];
  moves?: MoveBody[];
  gameId?: string;
  pageId?: number;
  title?: string;
  contentHtml?: string;
  links?: PageRef[];
  error?: { code?: string; message?: string };
}

interface RegisterBody {
  id?: string;
}

function titleFor(pageId: number): string {
  return pageId === TARGET_PAGE_ID ? TARGET_PAGE_TITLE : `Page ${pageId}`;
}

function refs(ids: number[]): PageRef[] {
  return ids.map((pageId) => ({ pageId, title: titleFor(pageId) }));
}

// Deterministic link graph used by the fake Wikipedia service. `START_PAGE_ID`
// (1) links to 2, 3, 4, 5 and the target page so completion and the
// A -> B -> C -> D -> backtrack -> C -> E scenario are all reachable.
const linkGraph = new Map<number, PageRef[]>([
  [1, refs([2, 3, 4, 5, TARGET_PAGE_ID])],
  [2, refs([3, 4, 5])],
  [3, refs([4, 2, 5])],
  [4, refs([3, 5])],
  [5, refs([TARGET_PAGE_ID])],
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

function unique(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function parseSetCookie(setCookie: string): { value: string } {
  const [first] = setCookie.split(";");
  const [, value] = first.split("=");
  return { value };
}

async function register(
  username: string,
  base: string = baseUrl,
): Promise<{ userId: string; cookie: string }> {
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: "password123",
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as RegisterBody;
  const userId = body.id;
  if (typeof userId !== "string") {
    throw new Error("register did not return a user id");
  }
  const cookie = parseSetCookie(res.headers.getSetCookie()[0]).value;
  createdUserIds.push(userId);
  return { userId, cookie };
}

async function post(
  path: string,
  body: unknown,
  cookie?: string,
  base: string = baseUrl,
): Promise<{ status: number; body: GameBody }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) {
    headers.Cookie = `access_token=${cookie}`;
  }

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as GameBody) : {} };
}

async function get(
  path: string,
  cookie?: string,
  base: string = baseUrl,
): Promise<{ status: number; body: GameBody }> {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.Cookie = `access_token=${cookie}`;
  }

  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as GameBody) : {} };
}

async function createGame(
  cookie: string,
  mode = "CLICK",
  difficulty = "EASY",
  base: string = baseUrl,
): Promise<{ status: number; body: GameBody }> {
  return post("/api/games", { mode, difficulty }, cookie, base);
}

async function move(
  cookie: string,
  gameId: string,
  toPageId: number,
  base: string = baseUrl,
): Promise<{ status: number; body: GameBody }> {
  return post(`/api/games/${gameId}/moves`, { toPageId }, cookie, base);
}

async function backtrack(
  cookie: string,
  gameId: string,
  base: string = baseUrl,
): Promise<{ status: number; body: GameBody }> {
  return post(`/api/games/${gameId}/backtrack`, {}, cookie, base);
}

async function del(
  gameId: string,
  cookie: string,
  base: string = baseUrl,
): Promise<{ status: number; body: GameBody }> {
  const res = await fetch(`${base}/api/games/${gameId}`, {
    method: "DELETE",
    headers: { Cookie: `access_token=${cookie}` },
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as GameBody) : {} };
}

const fakeStartingPageProvider: StartingPageProvider = {
  async getStartingPage() {
    return { pageId: START_PAGE_ID, title: titleFor(START_PAGE_ID) };
  },
};

async function createTestApp(wikipediaService: WikipediaService): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const appServer = createApp({
    startingPageProvider: fakeStartingPageProvider,
    wikipediaService,
  }).listen(0);
  await new Promise((resolve) => appServer.once("listening", resolve));
  const address = appServer.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => appServer.close(() => resolve())),
  };
}

before(async () => {
  server = createApp({
    startingPageProvider: fakeStartingPageProvider,
    wikipediaService: makeFakeWikipedia(),
  }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  await prisma.$disconnect();
});

async function persistedMoves(gameId: string) {
  return prisma.gameMove.findMany({
    where: { gameId },
    orderBy: { sequence: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Current article
// ---------------------------------------------------------------------------

test("owner can retrieve the current article without changing game state", async () => {
  const { cookie } = await register(unique("art1"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  const { status, body } = await get(
    `/api/games/${created.body.id}/article`,
    cookie,
  );

  assert.equal(status, 200);
  assert.equal(body.gameId, created.body.id);
  assert.equal(body.pageId, created.body.currentPageId);
  assert.equal(body.title, titleFor(created.body.currentPageId!));
  assert.equal(typeof body.contentHtml, "string");
  assert.ok(Array.isArray(body.links));
  assert.equal(body.links!.length, 5);

  const after = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(after.body.clickCount, 0);
  assert.equal(after.body.currentPageId, created.body.currentPageId);
});

test("article reflects the authoritative current page after navigation", async () => {
  const { cookie } = await register(unique("art2"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  await move(cookie, created.body.id!, 2);

  const { status, body } = await get(
    `/api/games/${created.body.id}/article`,
    cookie,
  );

  assert.equal(status, 200);
  assert.equal(body.pageId, 2);
  assert.equal(body.title, "Page 2");
});

test("non-owner cannot retrieve another user's article", async () => {
  const owner = await register(unique("arto"));
  const other = await register(unique("artt"));

  const created = await createGame(owner.cookie);
  const { status, body } = await get(
    `/api/games/${created.body.id}/article`,
    other.cookie,
  );

  assert.equal(status, 404);
  assert.equal(body.error?.code, "GAME_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// Navigation (no version, no session id)
// ---------------------------------------------------------------------------

test("valid navigation persists a NAVIGATION move and updates counters", async () => {
  const { cookie } = await register(unique("nav1"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  const { status, body } = await move(cookie, created.body.id!, 2);

  assert.equal(status, 200);
  assert.equal(body.currentPageId, 2);
  assert.equal(body.currentPageTitle, "Page 2");
  assert.equal(body.clickCount, 1);
  assert.equal(body.backtrackCount, 0);
  assert.equal(body.status, "IN_PROGRESS");
  assert.deepEqual(body.path, [
    { pageId: 1, title: "Page 1" },
    { pageId: 2, title: "Page 2" },
  ]);
  assert.equal(body.moves!.length, 1);
  assert.equal(body.moves![0].type, "NAVIGATION");
  assert.equal(body.moves![0].fromPageId, 1);
  assert.equal(body.moves![0].toPageId, 2);

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].sequence, 1);
  assert.equal(moves[0].type, "NAVIGATION");
});

test("move sequences start at 1 and increment", async () => {
  const { cookie } = await register(unique("nav2"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  await move(cookie, created.body.id!, 2);
  await move(cookie, created.body.id!, 3);

  const moves = await persistedMoves(created.body.id!);
  assert.deepEqual(
    moves.map((m) => m.sequence),
    [1, 2],
  );
});

test("invalid/teleport page is rejected with INVALID_MOVE and no mutation", async () => {
  const { cookie } = await register(unique("nav3"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  const { status, body } = await move(cookie, created.body.id!, 999999);

  assert.equal(status, 422);
  assert.equal(body.error?.code, "INVALID_MOVE");

  const after = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(after.body.clickCount, 0);
  assert.equal(after.body.currentPageId, created.body.currentPageId);

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 0);
});

test("a move body carrying a legacy version field is rejected as a validation error", async () => {
  const { cookie } = await register(unique("nav3b"));
  const created = await createGame(cookie);

  const { status, body } = await post(
    `/api/games/${created.body.id}/moves`,
    { toPageId: 2, version: 0 },
    cookie,
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("non-owner cannot navigate another user's game", async () => {
  const owner = await register(unique("navo"));
  const other = await register(unique("navt"));

  const created = await createGame(owner.cookie);
  const { status, body } = await move(other.cookie, created.body.id!, 2);

  assert.equal(status, 404);
  assert.equal(body.error?.code, "GAME_NOT_FOUND");
});

test("completed games reject further navigation", async () => {
  const { cookie } = await register(unique("nav6"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  const winning = await move(cookie, created.body.id!, TARGET_PAGE_ID);
  assert.equal(winning.status, 200);
  assert.equal(winning.body.status, "COMPLETED");

  const { status, body } = await move(cookie, created.body.id!, 2);

  assert.equal(status, 409);
  assert.equal(body.error?.code, "GAME_NOT_IN_PROGRESS");
});

test("two identical concurrent moves both persist as sequential moves", async () => {
  const { cookie } = await register(unique("conc1"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  const results = await Promise.all([
    move(cookie, created.body.id!, 2),
    move(cookie, created.body.id!, 3),
  ]);

  // Both are real user actions; neither is rejected and the move sequence stays
  // consistent (the loser of the sequence-number race retries once).
  assert.deepEqual(
    results.map((r) => r.status).sort(),
    [200, 200],
  );

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 2);
  assert.deepEqual(
    moves.map((m) => m.sequence),
    [1, 2],
  );

  const after = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(after.body.clickCount, 2);
});

// ---------------------------------------------------------------------------
// Backtracking (difficulty rules preserved)
// ---------------------------------------------------------------------------

test("EASY backtracking succeeds and decrements the active path", async () => {
  const { cookie } = await register(unique("bt1"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  await move(cookie, created.body.id!, 2);
  await move(cookie, created.body.id!, 3);

  const { status, body } = await backtrack(cookie, created.body.id!);

  assert.equal(status, 200);
  assert.equal(body.backtrackCount, 1);
  assert.equal(body.clickCount, 2);
  assert.equal(body.currentPageId, 2);
  assert.deepEqual(body.path, [
    { pageId: 1, title: "Page 1" },
    { pageId: 2, title: "Page 2" },
  ]);

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 3);
  const bt = moves[2];
  assert.equal(bt.type, "BACKTRACK");
  assert.equal(bt.fromPageId, 3);
  assert.equal(bt.toPageId, 2);
});

test("EASY allows unlimited backtracks (a fourth succeeds)", async () => {
  const { cookie } = await register(unique("bt2"));
  const created = await createGame(cookie, "CLICK", "EASY");
  assert.equal(created.status, 201);

  for (let i = 1; i <= 4; i += 1) {
    const nav = await move(cookie, created.body.id!, 2);
    assert.equal(nav.status, 200);
    assert.equal(nav.body.clickCount, i);

    const back = await backtrack(cookie, created.body.id!);
    assert.equal(back.status, 200, `backtrack ${i} should succeed`);
    assert.equal(back.body.backtrackCount, i);
    assert.equal(back.body.currentPageId, 1);
  }

  const after = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(after.body.backtrackCount, 4);
  assert.equal(after.body.clickCount, 4);
  assert.equal(after.body.status, "IN_PROGRESS");
  assert.deepEqual(after.body.path, [{ pageId: 1, title: "Page 1" }]);

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 8);
  assert.equal(moves.filter((m) => m.type === "BACKTRACK").length, 4);
});

test("backtracking from the starting page is rejected and mutates nothing", async () => {
  const { cookie } = await register(unique("bt3"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  const { status, body } = await backtrack(cookie, created.body.id!);

  assert.equal(status, 422);
  assert.equal(body.error?.code, "BACKTRACK_NOT_ALLOWED");

  const after = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(after.body.backtrackCount, 0);
  assert.equal(after.body.clickCount, 0);

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 0);
});

test("MEDIUM allows three backtracks and rejects the fourth", async () => {
  const { cookie } = await register(unique("bt4"));
  const created = await createGame(cookie, "CLICK", "MEDIUM");
  assert.equal(created.status, 201);

  await move(cookie, created.body.id!, 2);
  await move(cookie, created.body.id!, 3);
  await move(cookie, created.body.id!, 4);
  await move(cookie, created.body.id!, 5);

  for (let i = 0; i < 3; i += 1) {
    const result = await backtrack(cookie, created.body.id!);
    assert.equal(result.status, 200, `backtrack ${i + 1} should succeed`);
    assert.equal(result.body.backtrackCount, i + 1);
  }

  const fourth = await backtrack(cookie, created.body.id!);

  assert.equal(fourth.status, 422);
  assert.equal(fourth.body.error?.code, "BACKTRACK_LIMIT_REACHED");

  const after = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(after.body.backtrackCount, 3);
  assert.equal(after.body.currentPageId, 2);
});

test("HARD rejects backtracking with BACKTRACK_NOT_ALLOWED", async () => {
  const { cookie } = await register(unique("bt5"));
  const created = await createGame(cookie, "CLICK", "HARD");
  assert.equal(created.status, 201);

  await move(cookie, created.body.id!, 2);

  const { status, body } = await backtrack(cookie, created.body.id!);

  assert.equal(status, 422);
  assert.equal(body.error?.code, "BACKTRACK_NOT_ALLOWED");

  const after = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(after.body.backtrackCount, 0);
  assert.equal(after.body.currentPageId, 2);

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 1);
});

test("navigating to a previously visited page remains a NAVIGATION", async () => {
  const { cookie } = await register(unique("bt6"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  await move(cookie, created.body.id!, 2);
  await move(cookie, created.body.id!, 3);

  const { status, body } = await move(cookie, created.body.id!, 2);

  assert.equal(status, 200);
  assert.deepEqual(body.path, [
    { pageId: 1, title: "Page 1" },
    { pageId: 2, title: "Page 2" },
    { pageId: 3, title: "Page 3" },
    { pageId: 2, title: "Page 2" },
  ]);
  assert.equal(body.backtrackCount, 0);

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 3);
  assert.equal(moves[2].type, "NAVIGATION");
});

// ---------------------------------------------------------------------------
// Path reconstruction
// ---------------------------------------------------------------------------

test("A -> B -> C -> D, backtrack, C -> E reconstructs A -> B -> C -> E", async () => {
  const { cookie } = await register(unique("path1"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  await move(cookie, created.body.id!, 2); // A -> B
  await move(cookie, created.body.id!, 3); // B -> C
  await move(cookie, created.body.id!, 4); // C -> D
  await backtrack(cookie, created.body.id!); // D -> C
  await move(cookie, created.body.id!, 5); // C -> E

  const { status, body } = await get(`/api/games/${created.body.id}`, cookie);

  assert.equal(status, 200);
  assert.deepEqual(body.path, [
    { pageId: 1, title: "Page 1" },
    { pageId: 2, title: "Page 2" },
    { pageId: 3, title: "Page 3" },
    { pageId: 5, title: "Page 5" },
  ]);

  assert.equal(body.moves!.length, 5);
  assert.deepEqual(
    body.moves!.map((m) => m.type),
    ["NAVIGATION", "NAVIGATION", "NAVIGATION", "BACKTRACK", "NAVIGATION"],
  );
});

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

test("navigating to the target page completes the game atomically", async () => {
  const { cookie } = await register(unique("comp1"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  const { status, body } = await move(
    cookie,
    created.body.id!,
    TARGET_PAGE_ID,
  );

  assert.equal(status, 200);
  assert.equal(body.status, "COMPLETED");
  assert.equal(typeof body.completedAt, "string");
  assert.equal(body.clickCount, 1);
  assert.equal(body.currentPageId, TARGET_PAGE_ID);
  assert.equal(body.currentPageTitle, TARGET_PAGE_TITLE);
  assert.equal(body.playStartedAt, null);
  assert.deepEqual(body.path, [
    { pageId: 1, title: "Page 1" },
    { pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE },
  ]);

  const row = await prisma.game.findUniqueOrThrow({
    where: { id: created.body.id! },
  });
  assert.equal(row.status, "COMPLETED");
  assert.notEqual(row.completedAt, null);
  assert.equal(row.playStartedAt, null);
  assert.equal(row.lastHeartbeatAt, null);

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].type, "NAVIGATION");
  assert.equal(moves[0].toPageId, TARGET_PAGE_ID);
});

test("completed games reject further navigation and backtracking", async () => {
  const { cookie } = await register(unique("comp2"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  const winning = await move(cookie, created.body.id!, TARGET_PAGE_ID);
  assert.equal(winning.status, 200);
  assert.equal(winning.body.status, "COMPLETED");

  const moveAfter = await move(cookie, created.body.id!, 2);
  assert.equal(moveAfter.status, 409);
  assert.equal(moveAfter.body.error?.code, "GAME_NOT_IN_PROGRESS");

  const backAfter = await backtrack(cookie, created.body.id!);
  assert.equal(backAfter.status, 409);
  assert.equal(backAfter.body.error?.code, "GAME_NOT_IN_PROGRESS");

  const moves = await persistedMoves(created.body.id!);
  assert.equal(moves.length, 1);
});

test("deleting a completed game is rejected; the game is preserved", async () => {
  const { cookie } = await register(unique("comp3"));
  const created = await createGame(cookie);
  assert.equal(created.status, 201);

  await move(cookie, created.body.id!, TARGET_PAGE_ID);

  const { status, body } = await del(created.body.id!, cookie);
  assert.equal(status, 409);
  assert.equal(body.error?.code, "GAME_NOT_IN_PROGRESS");

  const stillThere = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(stillThere.status, 200);
  assert.equal(stillThere.body.status, "COMPLETED");
});

// ---------------------------------------------------------------------------
// Redirect-to-target completion (real WikipediaService + fake MediaWiki client)
// ---------------------------------------------------------------------------

test("a redirect link to the target completes the game in one navigation", async () => {
  const redirectClient = {
    getArticleLinks: async (pageId: number) => {
      if (pageId === 1) {
        return {
          pageId: 1,
          title: "Page 1",
          length: 2000,
          links: [{ ns: 0, title: "Unina", pageid: 487631 }],
        };
      }
      return { pageId, title: titleFor(pageId), length: 2000, links: [] };
    },
    getArticleHtml: async (pageId: number) => ({
      pageId,
      title: titleFor(pageId),
      html: '<p><a href="/wiki/Unina">Unina</a></p>',
    }),
    resolveTitles: async (sources: TitleResolutionSource[]) => {
      const map = new Map<string, TitleResolution>();
      for (const source of sources) {
        if (source.title === "Unina") {
          map.set(source.title, {
            kind: "REDIRECT",
            canonical: { pageId: TARGET_PAGE_ID, title: TARGET_PAGE_TITLE },
          });
        }
      }
      return map;
    },
  } as unknown as MediaWikiClient;

  const app = await createTestApp(new WikipediaService({ client: redirectClient }));

  try {
    const { cookie } = await register(unique("redir"), app.baseUrl);
    const created = await createGame(cookie, "CLICK", "EASY", app.baseUrl);
    assert.equal(created.status, 201);

    const article = await get(
      `/api/games/${created.body.id}/article`,
      cookie,
      app.baseUrl,
    );
    assert.equal(article.status, 200);
    assert.equal(article.body.links!.length, 1);
    assert.equal(article.body.links![0].pageId, TARGET_PAGE_ID);

    const { status, body } = await move(
      cookie,
      created.body.id!,
      TARGET_PAGE_ID,
      app.baseUrl,
    );

    assert.equal(status, 200);
    assert.equal(body.status, "COMPLETED");
    assert.equal(body.clickCount, 1);
    assert.equal(typeof body.completedAt, "string");
    assert.equal(body.currentPageId, TARGET_PAGE_ID);

    const moves = await persistedMoves(created.body.id!);
    assert.equal(moves.length, 1);
    assert.equal(moves[0].toPageId, TARGET_PAGE_ID);
  } finally {
    await app.close();
  }
});

// ---------------------------------------------------------------------------
// Authoritative playable-link validation (contextual filtering)
// ---------------------------------------------------------------------------

function makeContextualWikipediaService(): WikipediaService {
  const client = {
    getArticleLinks: async (pageId: number) => {
      if (pageId === 1) {
        return {
          pageId: 1,
          title: "Page 1",
          length: 2000,
          links: [
            { ns: 0, title: "B", pageid: 2 },
            { ns: 0, title: "C", pageid: 3 },
          ],
        };
      }
      return { pageId, title: titleFor(pageId), length: 2000, links: [] };
    },
    getArticleHtml: async (pageId: number) => ({
      pageId,
      title: titleFor(pageId),
      html: '<p>Normal <a href="/wiki/B">B</a>.</p><span class="citation">See <a href="/wiki/C">C</a>.</span>',
    }),
    resolveTitles: async (sources: TitleResolutionSource[]) =>
      new Map(
        sources.map((source) => [
          source.title,
          {
            kind: "DIRECT",
            canonical: { pageId: source.pageId, title: source.title },
          } as TitleResolution,
        ]),
      ),
  } as unknown as MediaWikiClient;

  return new WikipediaService({ client });
}

test("a normal body link remains navigable", async () => {
  const app = await createTestApp(makeContextualWikipediaService());
  try {
    const { cookie } = await register(unique("high1"), app.baseUrl);
    const created = await createGame(cookie, "CLICK", "EASY", app.baseUrl);
    assert.equal(created.status, 201);

    const article = await get(
      `/api/games/${created.body.id}/article`,
      cookie,
      app.baseUrl,
    );
    assert.equal(article.status, 200);
    assert.deepEqual(
      article.body.links!.map((link) => link.pageId),
      [2],
    );

    const { status, body } = await move(cookie, created.body.id!, 2, app.baseUrl);

    assert.equal(status, 200);
    assert.equal(body.currentPageId, 2);
    assert.equal(body.clickCount, 1);

    const moves = await persistedMoves(created.body.id!);
    assert.equal(moves.length, 1);
    assert.equal(moves[0].type, "NAVIGATION");
  } finally {
    await app.close();
  }
});

test("a citation-only link is rejected with INVALID_MOVE and mutates nothing", async () => {
  const app = await createTestApp(makeContextualWikipediaService());
  try {
    const { cookie } = await register(unique("high2"), app.baseUrl);
    const created = await createGame(cookie, "CLICK", "EASY", app.baseUrl);
    assert.equal(created.status, 201);

    const article = await get(
      `/api/games/${created.body.id}/article`,
      cookie,
      app.baseUrl,
    );
    assert.equal(article.status, 200);
    assert.equal(article.body.links!.some((link) => link.pageId === 3), false);

    const { status, body } = await move(cookie, created.body.id!, 3, app.baseUrl);

    assert.equal(status, 422);
    assert.equal(body.error?.code, "INVALID_MOVE");

    const after = await get(`/api/games/${created.body.id}`, cookie, app.baseUrl);
    assert.equal(after.body.currentPageId, created.body.currentPageId);
    assert.equal(after.body.clickCount, 0);
    assert.equal(after.body.status, "IN_PROGRESS");

    const moves = await persistedMoves(created.body.id!);
    assert.equal(moves.length, 0);
  } finally {
    await app.close();
  }
});

test("a heading-delimited bibliography-only link is rejected with INVALID_MOVE", async () => {
  const client = {
    getArticleLinks: async (pageId: number) => {
      if (pageId === 1) {
        return {
          pageId: 1,
          title: "Page 1",
          length: 2000,
          links: [
            { ns: 0, title: "Normal", pageid: 2 },
            { ns: 0, title: "Biblio Target", pageid: 3 },
          ],
        };
      }
      return { pageId, title: titleFor(pageId), length: 2000, links: [] };
    },
    getArticleHtml: async (pageId: number) => ({
      pageId,
      title: titleFor(pageId),
      html: '<p><a href="/wiki/Normal">normal</a></p><h2 id="Bibliografia">Bibliografia</h2><ul><li><a href="/wiki/Biblio_Target">book</a></li></ul>',
    }),
    resolveTitles: async (sources: TitleResolutionSource[]) =>
      new Map(
        sources.map((source) => [
          source.title,
          {
            kind: "DIRECT",
            canonical: { pageId: source.pageId, title: source.title },
          } as TitleResolution,
        ]),
      ),
  } as unknown as MediaWikiClient;

  const app = await createTestApp(new WikipediaService({ client }));
  try {
    const { cookie } = await register(unique("biblio"), app.baseUrl);
    const created = await createGame(cookie, "CLICK", "EASY", app.baseUrl);
    assert.equal(created.status, 201);

    const article = await get(
      `/api/games/${created.body.id}/article`,
      cookie,
      app.baseUrl,
    );
    assert.equal(article.status, 200);
    assert.deepEqual(
      article.body.links!.map((link) => link.pageId),
      [2],
    );

    const { status, body } = await move(cookie, created.body.id!, 3, app.baseUrl);

    assert.equal(status, 422);
    assert.equal(body.error?.code, "INVALID_MOVE");

    const moves = await persistedMoves(created.body.id!);
    assert.equal(moves.length, 0);
  } finally {
    await app.close();
  }
});

test("a legitimate section heading containing 'fonti' keeps its links navigable", async () => {
  const client = {
    getArticleLinks: async (pageId: number) => {
      if (pageId === 1) {
        return {
          pageId: 1,
          title: "Page 1",
          length: 2000,
          links: [{ ns: 0, title: "Energy Sources", pageid: 2 }],
        };
      }
      return { pageId, title: titleFor(pageId), length: 2000, links: [] };
    },
    getArticleHtml: async (pageId: number) => ({
      pageId,
      title: titleFor(pageId),
      html: '<h2 id="Fonti_energetiche">Fonti energetiche</h2><p>See <a href="/wiki/Energy_Sources">energy</a>.</p>',
    }),
    resolveTitles: async (sources: TitleResolutionSource[]) =>
      new Map(
        sources.map((source) => [
          source.title,
          {
            kind: "DIRECT",
            canonical: { pageId: source.pageId, title: source.title },
          } as TitleResolution,
        ]),
      ),
  } as unknown as MediaWikiClient;

  const app = await createTestApp(new WikipediaService({ client }));
  try {
    const { cookie } = await register(unique("fontie"), app.baseUrl);
    const created = await createGame(cookie, "CLICK", "EASY", app.baseUrl);
    assert.equal(created.status, 201);

    const { status, body } = await move(cookie, created.body.id!, 2, app.baseUrl);

    assert.equal(status, 200);
    assert.equal(body.currentPageId, 2);
    assert.equal(body.clickCount, 1);

    const moves = await persistedMoves(created.body.id!);
    assert.equal(moves.length, 1);
  } finally {
    await app.close();
  }
});
