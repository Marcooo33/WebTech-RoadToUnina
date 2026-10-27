import { expect, test } from "@playwright/test";
import { createGameInContext, registerInContext, uniqueUser } from "../support/users.js";
import { PAGE } from "../support/constants.js";

test("EASY backtracking steps the active path back without spending a click", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "CLICK", "EASY");

  await page.goto(`/game/${game.id}`);
  await page.locator(`.wiki__body a[data-page-title="${PAGE.golfoDiNapoli.title}"]`).click();
  await expect(page.locator(".wiki__title")).toHaveText(PAGE.golfoDiNapoli.title);
  await page.locator(`.wiki__body a[data-page-title="${PAGE.storiaDiNapoli.title}"]`).click();
  await expect(page.locator(".wiki__title")).toHaveText(PAGE.storiaDiNapoli.title);
  await expect(page.locator(".path__item")).toHaveCount(3);
  await expect(page.getByTestId("hud-clicks")).toHaveText("2");

  await page.getByRole("button", { name: "Torna indietro" }).click();

  await expect(page.locator(".wiki__title")).toHaveText(PAGE.golfoDiNapoli.title);
  await expect(page.locator(".path__item")).toHaveCount(2);
  await expect(page.getByTestId("hud-clicks")).toHaveText("2");
});
