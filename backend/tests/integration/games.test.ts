import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import type { StartingPageProvider } from "../../src/modules/games/starting-page.provider.js";
import type { WikipediaArticleSource } from "../../src/modules/wikipedia/wikipedia.types.js";

let server: Server;
let baseUrl: string;
const createdUserIds: string[] = [];

interface ErrorBody {
  error?: { code?: string; message?: string };
}

interface RegisterBody {
  id?: string;
  username?: string;
}

interface GameBody {
  game?: GameBody;
  article?: unknown;
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
  path?: { pageId: number; title: string }[];
  moves?: unknown[];
  items?: GameListItemBody[];
  error?: { code?: string; message?: string };
}

function unwrapPreparedBody(body: GameBody): GameBody {
  return body.game ? { ...body.game, article: body.article } : body;
}

interface GameListItemBody {
  id?: string;
  mode?: string;
  difficulty?: string;
  status?: string;
  startPageTitle?: string;
  clickCount?: number;
}

function unique(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function parseSetCookie(setCookie: string): {
  name: string;
  value: string;
  attributes: Record<string, string>;
} {
  const [first, ...rest] = setCookie.split(";");
  const [name, value] = first.split("=");

  const attributes: Record<string, string> = {};
  for (const part of rest) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      attributes[trimmed.toLowerCase()] = "";
    } else {
      attributes[trimmed.slice(0, eq).toLowerCase()] = trimmed.slice(eq + 1);
    }
  }

  return { name, value, attributes };
}

async function register(username: string): Promise<{
  userId: string;
  cookie: string;
}> {
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
): Promise<{ status: number; body: GameBody }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) {
    headers.Cookie = `access_token=${cookie}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  return {
    status: res.status,
    body: text ? unwrapPreparedBody(JSON.parse(text) as GameBody) : {},
  };
}

async function get(
  path: string,
  cookie?: string,
): Promise<{ status: number; body: GameBody }> {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.Cookie = `access_token=${cookie}`;
  }

  const res = await fetch(`${baseUrl}${path}`, { headers });
  const text = await res.text();
  return {
    status: res.status,
    body: text ? unwrapPreparedBody(JSON.parse(text) as GameBody) : {},
  };
}

async function del(
  path: string,
  cookie?: string,
): Promise<{ status: number; body: GameBody }> {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.Cookie = `access_token=${cookie}`;
  }

  const res = await fetch(`${baseUrl}${path}`, { method: "DELETE", headers });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as GameBody) : {} };
}

async function createGame(
  cookie: string,
  mode = "CLICK",
  difficulty = "EASY",
): Promise<{ status: number; body: GameBody }> {
  return post("/api/games", { mode, difficulty }, cookie);
}

const fakeStartingPageProvider: StartingPageProvider = {
  async getStartingPage() {
    return { pageId: 1, title: "ROADTOUNINA test start page" };
  },
};

const fakeWikipedia: WikipediaArticleSource = {
  async getArticle(pageId) {
    return {
      pageId,
      title: "ROADTOUNINA test start page",
      contentHtml: "<p>Test article</p>",
      links: [],
    };
  },
  async resolveNavigation() {
    return null;
  },
};

before(async () => {
  server = createApp({
    startingPageProvider: fakeStartingPageProvider,
    wikipediaService: fakeWikipedia,
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

test("authenticated user can create a CLICK / EASY game", async () => {
  const { cookie } = await register(unique("c1"));

  const { status, body } = await createGame(cookie, "CLICK", "EASY");

  assert.equal(status, 201);
  assert.equal(typeof body.id, "string");
  assert.equal(body.mode, "CLICK");
  assert.equal(body.difficulty, "EASY");
  assert.equal(body.status, "IN_PROGRESS");
  assert.equal(body.clickCount, 0);
  assert.equal(body.backtrackCount, 0);
  assert.equal(body.effectivePlayTimeMs, 0);
  assert.equal(body.playStartedAt, null);
  assert.equal(body.completedAt, null);
  assert.equal(typeof body.startedAt, "string");
  assert.equal(typeof body.createdAt, "string");
  assert.equal(typeof body.startPageId, "number");
  assert.equal(typeof body.startPageTitle, "string");
  assert.equal(typeof body.currentPageId, "number");
  assert.equal(typeof body.currentPageTitle, "string");
  assert.deepEqual(body.path, [
    { pageId: body.startPageId, title: body.startPageTitle },
  ]);
  assert.deepEqual(body.moves, []);
});

test("authenticated user can create a TIME / HARD game", async () => {
  const { cookie } = await register(unique("c2"));

  const { status, body } = await createGame(cookie, "TIME", "HARD");

  assert.equal(status, 201);
  assert.equal(body.mode, "TIME");
  assert.equal(body.difficulty, "HARD");
  assert.equal(body.status, "IN_PROGRESS");
});

test("invalid mode is rejected with 400 VALIDATION_ERROR", async () => {
  const { cookie } = await register(unique("c3"));

  const { status, body } = await post(
    "/api/games",
    { mode: "CLICKING", difficulty: "EASY" },
    cookie,
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("invalid difficulty is rejected with 400 VALIDATION_ERROR", async () => {
  const { cookie } = await register(unique("c4"));

  const { status, body } = await post(
    "/api/games",
    { mode: "CLICK", difficulty: "EXTREME" },
    cookie,
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("lower-case enum values are rejected (case-sensitive)", async () => {
  const { cookie } = await register(unique("c5"));

  const { status, body } = await post(
    "/api/games",
    { mode: "click", difficulty: "easy" },
    cookie,
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("client-supplied authoritative fields are rejected with 400 VALIDATION_ERROR", async () => {
  const { cookie } = await register(unique("c6"));

  const { status, body } = await post(
    "/api/games",
    { mode: "CLICK", difficulty: "EASY", status: "COMPLETED", clickCount: 42 },
    cookie,
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("unauthenticated game creation is rejected with 401 AUTHENTICATION_REQUIRED", async () => {
  const { status, body } = await post("/api/games", {
    mode: "CLICK",
    difficulty: "EASY",
  });

  assert.equal(status, 401);
  assert.equal(body.error?.code, "AUTHENTICATION_REQUIRED");
});

test("user can list their games", async () => {
  const { cookie } = await register(unique("l1"));

  await createGame(cookie, "CLICK", "EASY");
  await createGame(cookie, "TIME", "HARD");

  const { status, body } = await get("/api/games", cookie);

  assert.equal(status, 200);
  assert.ok(Array.isArray(body.items));
  assert.equal(body.items.length, 2);
});

test("list supports the optional status filter", async () => {
  const { cookie } = await register(unique("l2"));

  await createGame(cookie, "CLICK", "EASY");

  const inProgress = await get("/api/games?status=IN_PROGRESS", cookie);
  assert.equal(inProgress.status, 200);
  assert.equal(inProgress.body.items?.length, 1);

  const completed = await get("/api/games?status=COMPLETED", cookie);
  assert.equal(completed.status, 200);
  assert.equal(completed.body.items?.length, 0);
});

test("list rejects an invalid status filter with 400 VALIDATION_ERROR", async () => {
  const { cookie } = await register(unique("l3"));

  const { status, body } = await get("/api/games?status=DONE", cookie);

  assert.equal(status, 400);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("one user's list does not contain another user's games", async () => {
  const userA = await register(unique("la"));
  const userB = await register(unique("lb"));

  await createGame(userA.cookie, "CLICK", "EASY");
  await createGame(userB.cookie, "TIME", "MEDIUM");

  const listA = await get("/api/games", userA.cookie);
  const listB = await get("/api/games", userB.cookie);

  assert.equal(listA.status, 200);
  assert.equal(listA.body.items?.length, 1);
  assert.equal(listA.body.items?.[0].mode, "CLICK");

  assert.equal(listB.status, 200);
  assert.equal(listB.body.items?.length, 1);
  assert.equal(listB.body.items?.[0].mode, "TIME");
});

test("owner can retrieve their game", async () => {
  const { cookie } = await register(unique("g1"));

  const created = await createGame(cookie, "CLICK", "EASY");
  assert.equal(created.status, 201);

  const { status, body } = await get(`/api/games/${created.body.id}`, cookie);

  assert.equal(status, 200);
  assert.equal(body.id, created.body.id);
  assert.equal(body.mode, "CLICK");
});

test("another user receives 404 GAME_NOT_FOUND for a game they do not own", async () => {
  const owner = await register(unique("go"));
  const other = await register(unique("gt"));

  const created = await createGame(owner.cookie, "CLICK", "EASY");

  const { status, body } = await get(`/api/games/${created.body.id}`, other.cookie);

  assert.equal(status, 404);
  assert.equal(body.error?.code, "GAME_NOT_FOUND");
});

test("missing game returns 404 GAME_NOT_FOUND", async () => {
  const { cookie } = await register(unique("gm"));

  const missingId = randomUUID();
  const { status, body } = await get(`/api/games/${missingId}`, cookie);

  assert.equal(status, 404);
  assert.equal(body.error?.code, "GAME_NOT_FOUND");
});

test("invalid gameId returns 400 VALIDATION_ERROR", async () => {
  const { cookie } = await register(unique("gi"));

  const { status, body } = await get("/api/games/not-a-uuid", cookie);

  assert.equal(status, 400);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("owner can delete an IN_PROGRESS game", async () => {
  const { cookie } = await register(unique("d1"));

  const created = await createGame(cookie, "CLICK", "EASY");
  assert.equal(created.status, 201);

  const { status } = await del(`/api/games/${created.body.id}`, cookie);

  assert.equal(status, 204);

  const afterDelete = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(afterDelete.status, 404);
  assert.equal(afterDelete.body.error?.code, "GAME_NOT_FOUND");
});

test("another user cannot delete a game and receives 404 GAME_NOT_FOUND", async () => {
  const owner = await register(unique("do"));
  const other = await register(unique("dt"));

  const created = await createGame(owner.cookie, "CLICK", "EASY");

  const { status, body } = await del(
    `/api/games/${created.body.id}`,
    other.cookie,
  );

  assert.equal(status, 404);
  assert.equal(body.error?.code, "GAME_NOT_FOUND");
});

test("deletion of a COMPLETED game is rejected with 409 GAME_NOT_IN_PROGRESS", async () => {
  const { cookie } = await register(unique("dc"));

  const created = await createGame(cookie, "CLICK", "EASY");
  assert.equal(created.status, 201);

  await prisma.game.update({
    where: { id: created.body.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  const { status, body } = await del(`/api/games/${created.body.id}`, cookie);

  assert.equal(status, 409);
  assert.equal(body.error?.code, "GAME_NOT_IN_PROGRESS");

  const stillThere = await get(`/api/games/${created.body.id}`, cookie);
  assert.equal(stillThere.status, 200);
  assert.equal(stillThere.body.status, "COMPLETED");
  assert.equal(typeof stillThere.body.completedAt, "string");
});

test("deletion does not accept a legacy version query parameter", async () => {
  const { cookie } = await register(unique("dv"));

  const created = await createGame(cookie, "CLICK", "EASY");
  assert.equal(created.status, 201);

  // The query param is simply ignored now — deletion succeeds on ownership +
  // IN_PROGRESS alone.
  const { status } = await del(`/api/games/${created.body.id}?version=99`, cookie);
  assert.equal(status, 204);
});

test("concurrent delete attempts against the same game cannot both succeed", async () => {
  const { cookie } = await register(unique("dconc"));

  const created = await createGame(cookie, "CLICK", "EASY");
  assert.equal(created.status, 201);

  const results = await Promise.all([
    del(`/api/games/${created.body.id}`, cookie),
    del(`/api/games/${created.body.id}`, cookie),
  ]);

  const successes = results.filter((r) => r.status === 204);
  assert.equal(successes.length, 1);

  const failures = results.filter((r) => r.status !== 204);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].status, 404);
  assert.equal(failures[0].body.error?.code, "GAME_NOT_FOUND");
});

test("creation of the 11th IN_PROGRESS game is rejected with 409 GAME_LIMIT_REACHED", async () => {
  const { cookie, userId } = await register(unique("limit"));

  for (let i = 0; i < 10; i += 1) {
    const created = await createGame(cookie, "CLICK", "EASY");
    assert.equal(created.status, 201);
  }

  const eleventh = await createGame(cookie, "TIME", "HARD");

  assert.equal(eleventh.status, 409);
  assert.equal(eleventh.body.error?.code, "GAME_LIMIT_REACHED");

  const count = await prisma.game.count({
    where: { userId, status: "IN_PROGRESS" },
  });
  assert.equal(count, 10);
});

test("concurrent creation attempts cannot result in more than 10 IN_PROGRESS games", async () => {
  const { cookie, userId } = await register(unique("conc"));

  for (let i = 0; i < 5; i += 1) {
    const seeded = await createGame(cookie, "CLICK", "EASY");
    assert.equal(seeded.status, 201);
  }

  const attempts = 6;
  const results = await Promise.all(
    Array.from({ length: attempts }, () => createGame(cookie, "TIME", "HARD")),
  );

  const created = results.filter((r) => r.status === 201);
  const rejected = results.filter((r) => r.status === 409);

  assert.equal(created.length, 5);
  assert.equal(rejected.length, 1);
  for (const r of rejected) {
    assert.equal(r.body.error?.code, "GAME_LIMIT_REACHED");
  }

  const count = await prisma.game.count({
    where: { userId, status: "IN_PROGRESS" },
  });
  assert.equal(count, 10);
});
