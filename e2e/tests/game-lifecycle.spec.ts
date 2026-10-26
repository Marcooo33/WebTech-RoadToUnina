import { expect, test } from "@playwright/test";
import {
  createGameInContext,
  registerInContext,
  uniqueUser,
} from "../support/users.js";

test("create a CLICK / EASY game and land on the gameplay screen", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());

  await page.goto("/");
  await expect(
    page.locator("nav").getByRole("link", { name: "New game" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "New game", exact: true }).click();
  await expect(page).toHaveURL(/\/new-game$/);
  await page.getByText("CLICK", { exact: true }).click();
  await page.getByText("EASY", { exact: true }).click();
  await page.getByRole("button", { name: "Start game" }).click();

  await expect(page).toHaveURL(/\/game\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("hud-clicks")).toHaveText("0");
  await expect(page.getByText("Backtracking: unlimited")).toBeVisible();
});

test("delete an in-progress game from the dashboard", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());
  await createGameInContext(context, "CLICK", "EASY");

  await page.goto("/");
  await expect(page.getByTestId("game-row")).toHaveCount(1);

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByTestId("game-row")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No games in progress" }),
  ).toBeVisible();
});
