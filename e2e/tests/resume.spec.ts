import { expect, test } from "@playwright/test";
import { createGameInContext, registerInContext, uniqueUser } from "../support/users.js";
import { PAGE } from "../support/constants.js";

test("resuming an in-progress game restores its authoritative state", async ({ page, context }) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "CLICK", "EASY");

  await page.goto(`/game/${game.id}`);
  await page.locator(`.wiki__body a[data-page-id="${PAGE.golfoDiNapoli.pageId}"]`).click();
  await expect(page.locator(".wiki__title")).toHaveText(PAGE.golfoDiNapoli.title);
  await page.locator(`.wiki__body a[data-page-id="${PAGE.napoli.pageId}"]`).click();
  await expect(page.locator(".wiki__title")).toHaveText(PAGE.napoli.title);
  await expect(page.getByTestId("hud-clicks")).toHaveText("2");

  // Leave the game and come back — state persists via Game + GameMove.
  await page.goto("/dashboard");
  const row = page.getByTestId("game-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(PAGE.napoli.title);
  await row.getByRole("link", { name: "Resume" }).click();

  await expect(page).toHaveURL(new RegExp(`/game/${game.id}$`));
  await expect(page.locator(".wiki__title")).toHaveText(PAGE.napoli.title);
  await expect(page.getByTestId("hud-clicks")).toHaveText("2");
  await expect(page.locator(".path__item")).toHaveCount(3);
});
