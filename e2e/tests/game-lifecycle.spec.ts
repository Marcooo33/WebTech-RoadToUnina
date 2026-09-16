import { expect, test } from "@playwright/test";
import { createGameInContext, registerInContext, uniqueUser } from "../support/users.js";

test("create a CLICK / EASY game and land on the gameplay screen", async ({ page, context }) => {
  await registerInContext(context, uniqueUser());

  await page.goto("/");
  await expect(page.locator("nav").getByRole("link", { name: "New game" })).toHaveCount(0);
  await page.getByRole("link", { name: "New game" }).click();
  await expect(page).toHaveURL(/\/new-game$/);
  await page.getByText("CLICK", { exact: true }).click();
  await page.getByText("EASY", { exact: true }).click();
  await page.getByRole("button", { name: "Start game" }).click();

  await expect(page).toHaveURL(/\/game\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("hud-clicks")).toHaveText("0");
  await expect(page.getByText("Backtracking: unlimited")).toBeVisible();
});

test("create a TIME / HARD game — backtracking is unavailable in the HUD", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());

  await page.goto("/new-game");
  await page.getByText("TIME", { exact: true }).click();
  await page.getByText("HARD", { exact: true }).click();
  await page.getByRole("button", { name: "Start game" }).click();

  await expect(page).toHaveURL(/\/game\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Backtracking: not available")).toBeVisible();
  await expect(page.getByRole("button", { name: "Backtrack" })).toHaveCount(0);
});

test("delete an in-progress game from the dashboard", async ({ page, context }) => {
  await registerInContext(context, uniqueUser());
  await createGameInContext(context, "CLICK", "EASY");

  await page.goto("/");
  await expect(page.getByTestId("game-row")).toHaveCount(1);

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes" }).click();

  await expect(page.getByTestId("game-row")).toHaveCount(0);
  await expect(page.getByText("No games in progress yet.")).toBeVisible();
});

test("the dashboard blocks a new game once the 10 in-progress limit is reached", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());
  for (let i = 0; i < 10; i += 1) {
    await createGameInContext(context, "CLICK", "EASY");
  }

  await page.goto("/");
  await expect(page.getByText("In-progress games (10/10)")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("10-game limit");
  await expect(page.getByRole("button", { name: "New game" })).toBeDisabled();
});
