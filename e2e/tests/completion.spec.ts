import { expect, test } from "@playwright/test";
import { createGameInContext, registerInContext, uniqueUser } from "../support/users.js";
import { getGame } from "../support/api.js";
import { WIN_PATH } from "../support/constants.js";

test("reaching the target page completes the game", async ({ page, context }) => {
  await registerInContext(context, uniqueUser());
  const game = await createGameInContext(context, "CLICK", "EASY");

  await page.goto(`/game/${game.id}`);

  for (const step of WIN_PATH) {
    await page.locator(`.wiki__body a[data-page-title="${step.title}"]`).click();
  }

  await expect(page.getByTestId("game-result")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Target reached" })).toBeVisible();

  const finished = await getGame(context, game.id);
  expect(finished.status).toBe("COMPLETED");
});
