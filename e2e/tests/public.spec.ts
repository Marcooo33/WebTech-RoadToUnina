import { expect, test } from "@playwright/test";
import { createGameInContext, registerInContext, uniqueUser } from "../support/users.js";
import { playThroughApi } from "../support/api.js";
import { WIN_PATH } from "../support/constants.js";

const winPageIds = WIN_PATH.map((p) => p.pageId);

test("a completed game is visible in the anonymous public history", async ({
  browser,
  context,
}) => {
  const user = uniqueUser();
  await registerInContext(context, user);
  // TIME / HARD: a bucket no other completing spec uses (see constants.ts).
  const game = await createGameInContext(context, "TIME", "HARD");
  await playThroughApi(context, game.id, winPageIds);

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();

  await anonPage.goto("/history");
  const row = anonPage.locator("tbody tr", { hasText: user.username });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("TIME");
  await expect(row).toContainText("HARD");

  await row.getByRole("link", { name: "Details" }).click();
  await expect(anonPage).toHaveURL(new RegExp(`/history/${game.id}$`));
  await expect(
    anonPage.getByRole("heading", { name: new RegExp(user.username) }),
  ).toBeVisible();

  await anon.close();
});

test("a completed game appears on the leaderboard for its mode and difficulty", async ({
  browser,
  context,
}) => {
  const user = uniqueUser();
  await registerInContext(context, user);
  // CLICK / MEDIUM: the only completing spec that touches this bucket, so the
  // asserted row is always rank 1 and can never fall off the top-N board.
  const game = await createGameInContext(context, "CLICK", "MEDIUM");
  await playThroughApi(context, game.id, winPageIds);

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();

  await anonPage.goto("/leaderboard");
  await anonPage.getByRole("tab", { name: "CLICK" }).click();
  await anonPage.getByRole("button", { name: "MEDIUM" }).click();

  const row = anonPage.locator("tbody tr", { hasText: user.username });
  await expect(row).toHaveCount(1);
  await expect(row.locator("td").first()).toHaveText("1"); // rank column

  await anon.close();
});
