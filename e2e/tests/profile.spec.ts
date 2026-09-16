import { expect, test } from "@playwright/test";
import { playThroughApi } from "../support/api.js";
import { WIN_PATH } from "../support/constants.js";
import {
  createGameInContext,
  registerInContext,
  uniqueUser,
} from "../support/users.js";

test("a user can update account details and password, then log out from Profile", async ({
  page,
  context,
}) => {
  const user = uniqueUser("profile");
  await registerInContext(context, user);
  await page.goto("/profile");

  const updatedUsername = `${user.username.slice(0, 24)}_new`;
  const updatedEmail = `new_${user.email}`;

  await page.locator("#profile-username").fill(updatedUsername);
  await page.getByRole("button", { name: "Change username" }).click();
  await expect(page.getByText("Username updated.")).toBeVisible();
  await expect(page.locator("nav")).toContainText(updatedUsername);

  await page.locator("#profile-email").fill(updatedEmail);
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByText("Email updated.")).toBeVisible();

  const newPassword = "new-E2E-Password-456";
  await page.locator("#current-password").fill(user.password);
  await page.locator("#new-password").fill(newPassword);
  await page.locator("#confirm-password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password updated.")).toBeVisible();

  await page.locator("main").getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Reach Federico II" }),
  ).toBeVisible();

  await page.goto("/login");
  await page.locator("#identifier").fill(updatedUsername);
  await page.locator("#password").fill(newPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Signed in as")).toContainText(updatedUsername);
});

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
    .getByRole("button", { name: "Delete account" });
  await openDelete.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/profile$/);

  await openDelete.click();
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Reach Federico II" }),
  ).toBeVisible();

  await page.goto(`/history/${completed.id}`);
  await expect(
    page.getByRole("heading", { name: /Deleted user/ }),
  ).toBeVisible();
  await expect(page.getByText("Deleted user", { exact: true })).toBeVisible();
});
