import { expect, test } from "@playwright/test";
import { registerInContext, uniqueUser } from "../support/users.js";

test("a visitor can register through the form and lands authenticated", async ({ page }) => {
  const user = uniqueUser();

  await page.goto("/register");
  await page.locator("#username").fill(user.username);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`Signed in as`)).toContainText(user.username);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(page.locator("nav").getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "href",
    "/",
  );

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Signed in as")).toContainText(user.username);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Signed in as")).toContainText(user.username);
});

test("a registered user can log out and log back in", async ({ page }) => {
  const user = uniqueUser();

  await page.goto("/register");
  await page.locator("#username").fill(user.username);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Log out" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Reach Federico II" })).toBeVisible();
  await expect(page.locator("nav").getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.locator("nav").getByRole("link", { name: "Dashboard" })).toHaveCount(0);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Reach Federico II" })).toBeVisible();

  await page.goto("/login?redirect=/new-game");
  await page.locator("#identifier").fill(user.username);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Signed in as")).toContainText(user.username);
});

test("login with a wrong password is rejected and stays on the login page", async ({
  page,
  context,
}) => {
  const user = uniqueUser();
  // The account must genuinely exist — registerInContext asserts the 201 — so a
  // silent registration break can't degrade this into "log in as a missing user".
  await registerInContext(context, user);
  await context.clearCookies();

  await page.goto("/login");
  await page.locator("#identifier").fill(user.username);
  await page.locator("#password").fill("wrong-password-999");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("alert")).toContainText(/credential|password|incorrect|invalid/i);
  await expect(page).toHaveURL(/\/login$/);
});
