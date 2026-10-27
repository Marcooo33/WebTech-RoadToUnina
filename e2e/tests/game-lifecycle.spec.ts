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
    page.locator("nav").getByRole("link", { name: "Nuova partita" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Nuova partita", exact: true }).click();
  await expect(page).toHaveURL(/\/new-game$/);
  await page.getByText("Click", { exact: true }).click();
  await page.getByText("Facile", { exact: true }).click();
  const request = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/api/games"));
  await page.getByRole("button", { name: "Inizia partita" }).click();
  expect((await request).postDataJSON()).toEqual({ mode: "CLICK", difficulty: "EASY" });

  await expect(page).toHaveURL(/\/game\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("hud-clicks")).toHaveText("0");
  await expect(page.getByText("Ritorni indietro: illimitati")).toBeVisible();
});

test("delete an in-progress game from the dashboard", async ({
  page,
  context,
}) => {
  await registerInContext(context, uniqueUser());
  await createGameInContext(context, "CLICK", "EASY");

  await page.goto("/");
  await expect(page.getByTestId("game-row")).toHaveCount(1);

  await page.getByRole("button", { name: "Elimina" }).click();
  await page.getByRole("button", { name: "Elimina", exact: true }).click();

  await expect(page.getByTestId("game-row")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Nessuna partita in corso" }),
  ).toBeVisible();
});
