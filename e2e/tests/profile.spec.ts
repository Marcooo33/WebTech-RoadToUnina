import { expect, test } from "@playwright/test";
import { playThroughApi } from "../support/api.js";
import { WIN_PATH } from "../support/constants.js";
import {
  createGameInContext,
  registerInContext,
  uniqueUser,
} from "../support/users.js";

test("account deletion requires confirmation and preserves anonymized completed History", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = uniqueUser("deleted");
  await registerInContext(context, user);
  const completed = await createGameInContext(context, "CLICK", "EASY");
  await playThroughApi(
    context,
    completed.id,
    WIN_PATH.map((step) => step.title),
  );
  await createGameInContext(context, "TIME", "HARD");

  await page.goto("/profile");
  const openDelete = page
    .locator("main")
    .getByRole("button", { name: "Elimina account" });
  await openDelete.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Annulla" })).toBeVisible();
  await dialog.getByRole("button", { name: "Annulla" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/profile$/);

  await openDelete.click();
  await dialog.getByRole("button", { name: "Elimina account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Tutti i link portano alla Federico II." }),
  ).toBeVisible();

  await page.goto(`/history/${completed.id}`);
  await expect(
    page.getByRole("heading", { name: /Utente eliminato/ }),
  ).toBeVisible();
  await expect(page.getByText("Utente eliminato", { exact: true })).toBeVisible();
});
