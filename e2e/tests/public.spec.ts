import { expect, test } from "@playwright/test";
import { createGameInContext, registerInContext, uniqueUser } from "../support/users.js";
import { playThroughApi } from "../support/api.js";
import { WIN_PATH } from "../support/constants.js";

const winTitles = WIN_PATH.map((p) => p.title);

test("an anonymous user filters ranked History and opens a completed game", async ({
  browser,
  context,
}) => {
  const user = uniqueUser();
  await registerInContext(context, user);
  // TIME / HARD: a bucket no other completing spec uses (see constants.ts).
  const game = await createGameInContext(context, "TIME", "HARD");
  await playThroughApi(context, game.id, winTitles);

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();

  await anonPage.goto("/history");
  await anonPage.getByRole("tab", { name: "TIME" }).click();
  await anonPage.getByRole("button", { name: "HARD" }).click();
  const row = anonPage.locator("tbody tr", { hasText: user.username });
  await expect(row).toHaveCount(1);

  await row.getByRole("link", { name: "View game" }).click();
  await expect(anonPage).toHaveURL(new RegExp(`/history/${game.id}$`));
  await expect(
    anonPage.getByRole("heading", { name: new RegExp(user.username) }),
  ).toBeVisible();

  await anon.close();
});
