import { test, expect } from "@playwright/test";
import { once } from "node:events";
import { assertE2EDatabaseUrl } from "../support/db.js";
import { registerInContext, uniqueUser } from "../support/users.js";

// A private HTTP app lets these tests delay Wikipedia without adding test-only
// endpoints or timing switches to application code. All DB access stays isolated.
for (const replacement of [false, true]) {
  test(`authentication reconciles delayed guest ${replacement ? "replacement" : "creation"}`, async ({
    page,
    context,
  }) => {
    process.env.DATABASE_URL = assertE2EDatabaseUrl(
      process.env.E2E_DATABASE_URL,
    );
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET =
      process.env.E2E_JWT_SECRET ??
      "e2e-test-only-jwt-secret-value-01234567890";
    const { createApp } = await import("../../backend/src/app.js");
    const { prisma } = await import("../../backend/src/lib/prisma.js");
    const { createE2EWikipediaService } =
      await import("../../backend/src/testing/e2e-wikipedia.js");
    const wiki = createE2EWikipediaService();
    const startingPage = wiki.getStartingPage.bind(wiki);
    let delay = !replacement;
    let entered!: () => void;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    wiki.getStartingPage = async () => {
      if (delay) {
        entered();
        await gate;
      }
      return startingPage();
    };
    const server = createApp({ wikipediaService: wiki }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test server address");
    const base = `http://127.0.0.1:${address.port}`;
    await context.route(/\/api\/guest-games(?:\/.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: `${base}${url.pathname}${url.search}`,
        headers: await route.request().allHeaders(),
      });
      await route.fulfill({ response });
    });
    try {
      const user = uniqueUser("pending");
      await registerInContext(context, user);
      await context.request.post("/api/auth/logout", { data: {} });
      await page.goto("/");
      // The initial summary establishes the identity before the delayed POST.
      await expect
        .poll(async () =>
          (await context.cookies()).some(
            (cookie) => cookie.name === "guest_token",
          ),
        )
        .toBe(true);
      await page
        .getByRole("button", { name: "Gioca come ospite", exact: true })
        .click();
      if (replacement) {
        await expect(page).toHaveURL(/\/guest\/game\//);
        await expect(page.locator(".wiki__title")).toBeVisible();
        await page
          .getByRole("button", { name: "Esci dalla partita", exact: true })
          .click();
        await page.getByRole("dialog")
          .getByRole("button", { name: "Esci dalla partita", exact: true })
          .click();
        delay = true;
        await page
          .getByRole("button", { name: "Nuova partita", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Conferma nuova partita", exact: true })
          .click();
      }
      await pending;
      const login = await context.newPage();
      await login.goto("/login");
      await login.locator("#identifier").fill(user.username);
      await login.locator("#password").fill(user.password);
      const busy = login.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/guest-games" &&
          response.status() === 409,
      );
      await login.getByRole("button", { name: "Accedi", exact: true }).click();
      await busy;
      await expect(login).toHaveURL(/\/login$/);
      release();
      await expect(login).toHaveURL(/\/$/);
      // Browser summary uses the application's own header, with no global injection.
      const cookies = (await context.cookies()).filter(
        (cookie) =>
          cookie.domain === "localhost" &&
          (cookie.name === "guest_token" || cookie.name === "access_token"),
      );
      const summary = await context.request.get(`${base}/api/guest-games`, {
        headers: {
          "X-Requested-With": "ROADTOUNINA",
          Cookie: cookies
            .map((cookie) => `${cookie.name}=${cookie.value}`)
            .join("; "),
        },
      });
      expect(summary.status()).toBe(200);
      expect((await summary.json()).game).toBeNull();
      await login.close();
    } finally {
      release();
      await context.unroute(/\/api\/guest-games(?:\/.*)?$/);
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await prisma.$disconnect();
    }
  });
}
