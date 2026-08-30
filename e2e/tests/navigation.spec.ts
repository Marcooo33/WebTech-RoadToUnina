import { expect, test } from "@playwright/test";
import { createGameInContext, registerInContext, uniqueUser } from "../support/users.js";
import { errorCode, move, startSession } from "../support/api.js";
import { PAGE, START_PAGE, UNLINKED_PAGE_ID } from "../support/constants.js";

test("following a playable link is a navigation click and advances the path", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "CLICK", "EASY");

  await page.goto(`/game/${game.id}`);
  await expect(page.locator(".wiki__title")).toHaveText(START_PAGE.title);
  await expect(page.locator(".path__item")).toHaveCount(1);
  await expect(page.getByTestId("hud-clicks")).toHaveText("0");

  await page
    .locator(`.wiki__body a[data-page-id="${PAGE.golfoDiNapoli.pageId}"]`)
    .click();

  await expect(page.locator(".wiki__title")).toHaveText(PAGE.golfoDiNapoli.title);
  await expect(page.getByTestId("hud-clicks")).toHaveText("1");
  await expect(page.locator(".path__item")).toHaveCount(2);
  await expect(page.locator(".path__item").last()).toContainText(PAGE.golfoDiNapoli.title);
});

test("a forged navigation to an unlinked page is rejected by the server", async ({ context }) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "CLICK", "EASY");
  const version = await startSession(context, game.id);

  const response = await move(context, game.id, UNLINKED_PAGE_ID, version);

  expect(response.status()).toBe(422);
  expect(await errorCode(response)).toBe("INVALID_MOVE");
});
