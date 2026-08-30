import { expect, test } from "@playwright/test";
import { createGameInContext, registerInContext, uniqueUser } from "../support/users.js";
import { backtrack, errorCode, playThroughApi, startSession } from "../support/api.js";
import { DEEP_PATH, PAGE } from "../support/constants.js";

test("EASY backtracking steps the active path back without spending a click", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "CLICK", "EASY");

  await page.goto(`/game/${game.id}`);
  await page.locator(`.wiki__body a[data-page-id="${PAGE.golfoDiNapoli.pageId}"]`).click();
  await expect(page.locator(".wiki__title")).toHaveText(PAGE.golfoDiNapoli.title);
  await page.locator(`.wiki__body a[data-page-id="${PAGE.storiaDiNapoli.pageId}"]`).click();
  await expect(page.locator(".wiki__title")).toHaveText(PAGE.storiaDiNapoli.title);
  await expect(page.locator(".path__item")).toHaveCount(3);
  await expect(page.getByTestId("hud-clicks")).toHaveText("2");

  await page.getByRole("button", { name: "Backtrack" }).click();

  await expect(page.locator(".wiki__title")).toHaveText(PAGE.golfoDiNapoli.title);
  await expect(page.locator(".path__item")).toHaveCount(2);
  await expect(page.getByTestId("hud-clicks")).toHaveText("2");
});

test("MEDIUM rejects the 4th backtrack", async ({ context }) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "CLICK", "MEDIUM");

  const state = await playThroughApi(
    context,
    game.id,
    DEEP_PATH.map((p) => p.pageId),
  );
  let version = state.version;

  for (let i = 0; i < 3; i += 1) {
    const res = await backtrack(context, game.id, version);
    expect(res.status(), `backtrack ${i + 1}`).toBe(200);
    version = ((await res.json()) as { version: number }).version;
  }

  const fourth = await backtrack(context, game.id, version);
  expect(fourth.status()).toBe(422);
  expect(await errorCode(fourth)).toBe("BACKTRACK_LIMIT_REACHED");
});

test("HARD rejects any backtrack", async ({ context }) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "TIME", "HARD");
  const version = await startSession(context, game.id);

  const res = await backtrack(context, game.id, version);
  expect(res.status()).toBe(422);
  expect(await errorCode(res)).toBe("BACKTRACK_NOT_ALLOWED");
});
