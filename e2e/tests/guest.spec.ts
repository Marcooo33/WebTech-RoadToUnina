import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertE2EDatabaseUrl } from "../support/db.js";
import { uniqueUser, registerInContext } from "../support/users.js";
import { WIN_PATH, PAGE } from "../support/constants.js";
const GUEST_HEADERS = { "X-Requested-With": "ROADTOUNINA" };
async function create(context: BrowserContext) {
  const response = await context.request.post("/api/guest-games", {
    data: {},
    headers: GUEST_HEADERS,
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}
async function win(page: Page) {
  for (const step of WIN_PATH)
    await page
      .locator(`.wiki__body a[data-page-title="${step.title}"]`)
      .click();
  await expect(page.getByTestId("game-result")).toBeVisible();
}
async function databaseGame(id: string) {
  const client = new Client({
    connectionString: assertE2EDatabaseUrl(process.env.E2E_DATABASE_URL),
  });
  await client.connect();
  try {
    const game = await client.query("SELECT * FROM games WHERE id = $1", [id]);
    const moves = await client.query(
      "SELECT * FROM game_moves WHERE game_id = $1 ORDER BY sequence",
      [id],
    );
    return { game: game.rows[0], moves: moves.rows };
  } finally {
    await client.end();
  }
}
test("guest API enforces defaults, identity, request protection and side-effect-free authenticated rejection", async ({
  context,
}) => {
  for (const body of [
    { mode: "CLICK" },
    { difficulty: "EASY" },
    { mode: "TIME", difficulty: "HARD" },
  ])
    expect(
      (
        await context.request.post("/api/guest-games", {
          data: body,
          headers: GUEST_HEADERS,
        })
      ).status(),
    ).toBe(400);
  expect(
    (
      await context.request.post("/api/guest-games", {
        data: {},
        headers: { "X-Requested-With": "" },
      })
    ).status(),
  ).toBe(403);
  for (const endpoint of ["login", "register"]) {
    const missingHeader = await context.request.post(`/api/auth/${endpoint}`, {
      data: {},
    });
    expect(missingHeader.status()).toBe(403);
    expect((await missingHeader.json()).error.code).toBe(
      "REQUEST_HEADER_REQUIRED",
    );
  }
  const state = await create(context);
  expect(state.game.mode).toBe("CLICK");
  expect(state.game.difficulty).toBe("EASY");
  const cookie = (await context.cookies()).find(
    (c) => c.name === "guest_token",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.path).toBe("/api/guest-games");
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 23 * 3600);
  expect((await databaseGame(state.game.id)).game).toBeUndefined();
  expect(
    (
      await context.request.post("/api/guest-games", {
        data: {},
        headers: GUEST_HEADERS,
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await context.request.get(`/api/guest-games/${state.game.id}`, {
        headers: { "X-Requested-With": "" },
      })
    ).status(),
  ).toBe(403);
  await registerInContext(context, uniqueUser());
  expect(
    (
      await context.request.get(`/api/guest-games/${state.game.id}`, {
        headers: GUEST_HEADERS,
      })
    ).status(),
  ).toBe(403);
  const after = await (
    await context.request.get("/api/guest-games", { headers: GUEST_HEADERS })
  ).json();
  expect(after.game.id).toBe(state.game.id);
  expect(after.revision).toBe(state.revision);
  expect(
    (
      await context.request.delete(`/api/guest-games/${state.game.id}`, {
        data: { revision: after.revision },
        headers: GUEST_HEADERS,
      })
    ).status(),
  ).toBe(204);
  expect((await databaseGame(state.game.id)).game).toBeUndefined();
});
test("Play as Guest starts directly; active replacement can be cancelled or confirmed", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play as Guest", exact: true })
    .click();
  await expect(page).toHaveURL(/\/guest\/game\/[a-f0-9-]{36}$/);
  await expect(page.getByTestId("hud-clicks")).toHaveText("0");
  const original = page.url();
  await page.getByRole("link", { name: "Leave game", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("link", { name: "Play as Guest", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Start New", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Resume", exact: true }).click();
  await expect(page).toHaveURL(original);
  await page.getByRole("link", { name: "Leave game", exact: true }).click();
  await page.getByRole("button", { name: "Start New", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm Start New", exact: true })
    .click();
  await expect(page).toHaveURL(/\/guest\/game\/[a-f0-9-]{36}$/);
  expect(page.url()).not.toBe(original);
  expect(
    (
      await (
        await context.request.get("/api/guest-games", {
          headers: GUEST_HEADERS,
        })
      ).json()
    ).game.mode,
  ).toBe("CLICK");
});
test("guest victory registers and automatically persists full backtracking history and statistics", async ({
  page,
  context,
}) => {
  const created = await create(context);
  await page.goto(`/guest/game/${created.game.id}`);
  await page
    .locator(`a[data-page-title="${PAGE.golfoDiNapoli.title}"]`)
    .click();
  await page.getByRole("button", { name: /Backtrack/ }).click();
  await win(page);
  expect((await databaseGame(created.game.id)).game).toBeUndefined();
  await page.getByRole("link", { name: "Register to save result" }).click();
  const user = uniqueUser("guest");
  await page.locator("#username").fill(user.username);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Signed in as")).toContainText(user.username);
  const saved = await databaseGame(created.game.id);
  expect(saved.game.status).toBe("COMPLETED");
  expect(saved.game.mode).toBe("CLICK");
  expect(saved.game.difficulty).toBe("EASY");
  expect(saved.game.click_count).toBe(4);
  expect(saved.game.backtrack_count).toBe(1);
  expect(saved.game.play_started_at).toBeNull();
  expect(saved.moves).toHaveLength(5);
  expect(saved.moves.map((move) => move.sequence)).toEqual([1, 2, 3, 4, 5]);
  expect(saved.moves.map((move) => move.type)).toEqual([
    "NAVIGATION",
    "BACKTRACK",
    "NAVIGATION",
    "NAVIGATION",
    "NAVIGATION",
  ]);
  const detail = await (
    await context.request.get(`/api/history/${created.game.id}`)
  ).json();
  expect(detail.path).toHaveLength(4);
  expect(detail.moves).toHaveLength(5);
  expect(detail.player.username).toBe(user.username);
  expect(
    (await (await context.request.get("/api/me/stats")).json()).completedGames,
  ).toBe(1);
  expect(
    (
      await (
        await context.request.get("/api/history/click?difficulty=EASY")
      ).json()
    ).items.some((item: { gameId: string }) => item.gameId === created.game.id),
  ).toBe(true);
  expect(
    (
      await context.request.post(`/api/guest-games/${created.game.id}/claim`, {
        data: {},
        headers: GUEST_HEADERS,
      })
    ).status(),
  ).toBe(200);
  await registerInContext(context, uniqueUser());
  expect(
    (
      await context.request.post(`/api/guest-games/${created.game.id}/claim`, {
        data: {},
        headers: GUEST_HEADERS,
      })
    ).status(),
  ).toBe(409);
});
test("login claim failures retain authentication and result; retry saves once", async ({
  page,
  context,
}) => {
  const user = uniqueUser();
  await registerInContext(context, user);
  await context.request.post("/api/auth/logout", {
    data: {},
    headers: GUEST_HEADERS,
  });
  const created = await create(context);
  await page.goto(`/guest/game/${created.game.id}`);
  await win(page);
  await page.route("**/api/guest-games/*/claim", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "GUEST_CLAIM_FAILED",
          message: "Temporary database failure",
        },
      }),
    }),
  );
  await page.getByRole("link", { name: "Log in to save result" }).click();
  await page.locator("#identifier").fill(user.username);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("has not been saved", {
    timeout: 10_000,
  });
  expect((await context.request.get("/api/auth/me")).status()).toBe(200);
  expect((await databaseGame(created.game.id)).game).toBeUndefined();
  expect(
    (
      await (
        await context.request.get("/api/guest-games", {
          headers: GUEST_HEADERS,
        })
      ).json()
    ).game.status,
  ).toBe("COMPLETED");
  await page.unroute("**/api/guest-games/*/claim");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await databaseGame(created.game.id)).moves).toHaveLength(3);
});
test("successful login explicitly discards unfinished guest progress", async ({
  page,
  context,
}) => {
  const user = uniqueUser();
  await registerInContext(context, user);
  await context.request.post("/api/auth/logout", {
    data: {},
    headers: GUEST_HEADERS,
  });
  const created = await create(context);
  await page.goto(`/guest/game/${created.game.id}`);
  await page
    .locator(`a[data-page-title="${PAGE.golfoDiNapoli.title}"]`)
    .click();
  await page
    .locator("nav")
    .getByRole("link", { name: "Log in", exact: true })
    .click();
  await page.locator("#identifier").fill(user.username);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(
    (
      await (
        await context.request.get("/api/guest-games", {
          headers: GUEST_HEADERS,
        })
      ).json()
    ).game,
  ).toBeNull();
  expect((await databaseGame(created.game.id)).game).toBeUndefined();
});
test("refresh, reopened cookie storage, stale tabs and missing identity restore safely", async ({
  page,
  context,
  browser,
}) => {
  const created = await create(context);
  await page.goto(`/guest/game/${created.game.id}`);
  await page
    .locator(`a[data-page-title="${PAGE.golfoDiNapoli.title}"]`)
    .click();
  await page.reload();
  await expect(page.locator(".wiki__title")).toHaveText(
    PAGE.golfoDiNapoli.title,
  );
  const old = await (
    await context.request.get("/api/guest-games", { headers: GUEST_HEADERS })
  ).json();
  const second = await context.newPage();
  await second.goto(`/guest/game/${created.game.id}`);
  await expect(second.locator(".wiki__title")).toHaveText(
    PAGE.golfoDiNapoli.title,
  );
  expect(
    (
      await context.request.post(`/api/guest-games/${created.game.id}/moves`, {
        data: { toTitle: "Napoli", revision: old.revision },
        headers: GUEST_HEADERS,
      })
    ).status(),
  ).toBe(409);
  const reopened = await browser.newContext({
    storageState: await context.storageState(),
  });
  const restored = await reopened.newPage();
  await restored.goto(`/guest/game/${created.game.id}`);
  await expect(restored.locator(".wiki__title")).toHaveText(
    PAGE.golfoDiNapoli.title,
  );
  await reopened.close();
  const missing = await browser.newContext();
  const lost = await missing.newPage();
  await lost.goto(`/guest/game/${created.game.id}`);
  await expect(lost).toHaveURL(/\/$/);
  await expect(lost.getByRole("status")).toContainText(
    "expired or is no longer available",
  );
  await missing.close();
});
test("completed result cancellation and failed replacement preserve the result", async ({
  page,
  context,
}) => {
  const created = await create(context);
  await page.goto(`/guest/game/${created.game.id}`);
  await win(page);
  await page.getByRole("link", { name: "Home", exact: true }).last().click();
  await page.getByRole("button", { name: "Start New", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "View Result", exact: true }).click();
  await expect(page.getByTestId("game-result")).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).last().click();
  await page.route("**/api/guest-games", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "NO_STARTING_PAGE",
            message: "Could not find a starting page.",
          },
        }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Start New", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm Start New", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not find a starting page",
  );
  const summary = await (
    await context.request.get("/api/guest-games", { headers: GUEST_HEADERS })
  ).json();
  expect(summary.game.id).toBe(created.game.id);
  expect(summary.game.status).toBe("COMPLETED");
  await page.unroute("**/api/guest-games");
  await context.clearCookies({ name: "guest_token" });
  const user = uniqueUser("lost");
  await page.goto("/register");
  await page.locator("#username").fill(user.username);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("could not be saved");
  expect((await context.request.get("/api/auth/me")).status()).toBe(200);
  await page.getByRole("link", { name: "Go to Dashboard" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("claim transaction rolls back partial history and retries the retained snapshot", async ({
  context,
}) => {
  // Set the allowlisted database before importing any backend environment/Prisma module.
  process.env.DATABASE_URL = assertE2EDatabaseUrl(process.env.E2E_DATABASE_URL);
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET =
    process.env.E2E_JWT_SECRET ?? "e2e-test-only-jwt-secret-value-01234567890";
  const { persistGuestGame } = await import("../../backend/src/app.js");
  const { prisma } = await import("../../backend/src/lib/prisma.js");
  const { GuestGamesService } =
    await import("../../backend/src/modules/guest-games/guest-games.service.js");
  const { createE2EWikipediaService } =
    await import("../../backend/src/testing/e2e-wikipedia.js");
  await registerInContext(context, uniqueUser());
  const user = await (await context.request.get("/api/auth/me")).json();
  let fail = true;
  const service = new GuestGamesService(
    createE2EWikipediaService(),
    async (game, userId) => {
      const snapshot = structuredClone(game);
      if (fail) snapshot.moves[1].sequence = snapshot.moves[0].sequence;
      await persistGuestGame(snapshot, userId);
    },
  );
  try {
    let state = await service.create("transaction-test");
    state = await service.get("transaction-test", state.game.id);
    for (const step of WIN_PATH)
      state = await service.move(
        "transaction-test",
        state.game.id,
        state.revision,
        step.title,
      );
    await expect(
      service.claim("transaction-test", state.game.id, user.id),
    ).rejects.toMatchObject({ code: "GUEST_CLAIM_FAILED" });
    expect((await databaseGame(state.game.id)).game).toBeUndefined();
    expect((await databaseGame(state.game.id)).moves).toHaveLength(0);
    expect(service.summary("transaction-test").game?.status).toBe("COMPLETED");
    fail = false;
    await service.claim("transaction-test", state.game.id, user.id);
    expect((await databaseGame(state.game.id)).moves).toHaveLength(3);
  } finally {
    await prisma.$disconnect();
  }
});

test("failed discard then logout, resume, complete and login claims the result", async ({
  page,
  context,
}) => {
  const user = uniqueUser("discard");
  await registerInContext(context, user);
  await context.request.post("/api/auth/logout", { data: {} });
  const created = await create(context);
  await page.goto(`/guest/game/${created.game.id}`);
  await page.route(`**/api/guest-games/${created.game.id}`, async (route) => {
    if (route.request().method() === "DELETE")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message: "Temporary discard failure",
          },
        }),
      });
    else await route.continue();
  });
  await page
    .locator("nav")
    .getByRole("link", { name: "Log in", exact: true })
    .click();
  await page.locator("#identifier").fill(user.username);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "could not be discarded",
    { timeout: 10_000 },
  );
  await page.unroute(`**/api/guest-games/${created.game.id}`);
  await page.locator("nav").getByRole("button", { name: "Log out" }).click();
  await page.getByRole("link", { name: "Resume", exact: true }).click();
  await win(page);
  await page.getByRole("link", { name: "Log in to save result" }).click();
  await page.locator("#identifier").fill(user.username);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const saved = await databaseGame(created.game.id);
  expect(saved.game.status).toBe("COMPLETED");
  expect(saved.moves).toHaveLength(3);
  expect(
    (
      await context.request.post(`/api/guest-games/${created.game.id}/claim`, {
        data: {},
        headers: GUEST_HEADERS,
      })
    ).status(),
  ).toBe(200);
});
