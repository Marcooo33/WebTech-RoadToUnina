import { expect, test } from "@playwright/test";
import {
  createGameInContext,
  registerInContext,
  uniqueUser,
} from "../support/users.js";
import { PAGE, START_PAGE } from "../support/constants.js";

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
    .locator(`.wiki__body a[data-page-title="${PAGE.golfoDiNapoli.title}"]`)
    .click();

  await expect(page.locator(".wiki__title")).toHaveText(
    PAGE.golfoDiNapoli.title,
  );
  await expect(page.getByTestId("hud-clicks")).toHaveText("1");
  await expect(page.locator(".path__item")).toHaveCount(2);
  await expect(page.locator(".path__item").last()).toContainText(
    PAGE.golfoDiNapoli.title,
  );
});

test("a playable link supports Enter exactly once and focuses the next title", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "CLICK", "EASY");
  await page.goto(`/game/${game.id}`);
  const link = page.locator(
    `.wiki__body a[data-page-title="${PAGE.golfoDiNapoli.title}"]`,
  );
  await expect(link).toHaveAttribute("href", "#wikipedia-article-title");
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".wiki__title")).toHaveText(
    PAGE.golfoDiNapoli.title,
  );
  await expect(page.locator(".wiki__title")).toBeFocused();
  await expect(page.getByTestId("hud-clicks")).toHaveText("1");
  await expect(page.locator(".path__item")).toHaveCount(2);
  await expect(page).toHaveURL(new RegExp(`/game/${game.id}$`));
});
