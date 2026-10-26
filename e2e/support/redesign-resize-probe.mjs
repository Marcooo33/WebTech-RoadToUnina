/** Presentation-only phase 6 implementation probe. No backend or database access.
 * Run: node e2e/support/redesign-resize-probe.mjs before|modal-before|after
 * Every API is fulfilled locally; non-local requests are aborted. This is an
 * implementation regression probe, separate from the independent final gate.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const mode = process.argv[2] ?? "before";
assert(["before", "modal-before", "after"].includes(mode));
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const origin = new URL(process.env.REDESIGN_BASE_URL ?? "http://127.0.0.1:4400")
  .origin;
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const output = path.resolve(
  process.env.REDESIGN_OUTPUT_DIR ??
    path.join(root, "docs/redesign-evidence/phase-6"),
);
fs.mkdirSync(output, { recursive: true });
const id = "00000000-0000-4000-8000-000000000201";
const target = {
  pageId: 2930935,
  title: "Università degli Studi di Napoli Federico II",
};
const pages = [
  { pageId: 1, title: "Roma" },
  { pageId: 2, title: "Napoli" },
];
const now = "2026-10-26T00:00:00Z";
const user = {
  id: "player",
  username: "navigatore_e2e",
  email: "navigator@example.test",
  createdAt: now,
};
const playing = {
  id,
  mode: "CLICK",
  difficulty: "EASY",
  status: "IN_PROGRESS",
  startPageId: 1,
  startPageTitle: "Roma",
  currentPageId: 2,
  currentPageTitle: "Napoli",
  clickCount: 1,
  backtrackCount: 0,
  effectivePlayTimeMs: 18000,
  startedAt: now,
  completedAt: null,
  createdAt: now,
  path: pages,
  moves: [],
};
const article = {
  gameId: id,
  pageId: 2,
  title: "Napoli",
  links: [{ title: "Roma" }],
  contentHtml:
    '<p>Introduzione con <a data-page-title="Roma">Roma</a>.</p><h2 id="rtu-section-body">Storia</h2>' +
    "<p>Articolo italiano di test per verificare lettura, percorso e focus.</p>".repeat(
      35,
    ),
};
const route = [pages[0]];
const moves = Array.from({ length: 31 }, (_, index) => {
  const from = route.at(-1);
  const to = index === 30 ? target : pages[(index + 1) % 2];
  route.push(to);
  return {
    sequence: index + 1,
    type: "NAVIGATION",
    fromPageId: from.pageId,
    fromPageTitle: from.title,
    toPageId: to.pageId,
    toPageTitle: to.title,
    createdAt: now,
  };
});
const detail = {
  ...playing,
  gameId: id,
  player: { id: user.id, username: user.username },
  status: "COMPLETED",
  completedAt: now,
  currentPageId: target.pageId,
  currentPageTitle: target.title,
  clickCount: 31,
  path: route,
  moves,
};
const calls = [];
const results = {};
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.route("**/*", async (request) => {
    const url = new URL(request.request().url());
    if (url.origin !== origin) return request.abort();
    if (!url.pathname.startsWith("/api/")) return request.continue();
    calls.push({ method: request.request().method(), path: url.pathname });
    const json = (value) => request.fulfill({ json: value });
    if (url.pathname === "/api/auth/me") return json(user);
    if (url.pathname === "/api/guest-games")
      return json({ game: null, revision: null, expiresAt: null });
    if (
      url.pathname === "/api/history/click" ||
      url.pathname === "/api/history/time"
    )
      return json({
        mode: "CLICK",
        difficulty: "EASY",
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    if (url.pathname === `/api/history/${id}`) return json(detail);
    if (url.pathname.endsWith("/pause"))
      return request.fulfill({ status: 204 });
    if (url.pathname === `/api/games/${id}`)
      return json({ game: playing, article });
    return request.fulfill({
      status: 503,
      json: {
        error: {
          code: "TEST_BLOCKED",
          message: "Isolated implementation probe.",
        },
      },
    });
  });
  const page = await context.newPage();
  const settled = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  const focused = () =>
    page.evaluate(() => {
      const element = document.activeElement;
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        className: element.className,
        visible:
          element !== document.body &&
          element.getClientRects().length > 0 &&
          rect.top < innerHeight &&
          rect.bottom > 0 &&
          rect.left < innerWidth &&
          rect.right > 0,
        rect: rect.toJSON(),
        text: element.textContent?.trim().slice(0, 100),
      };
    });
  await page.goto(origin + "/history");
  const toggle = page.locator(".nav__toggle");
  await toggle.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await settled();
  const resizedMenuFocus = await focused();
  await page.keyboard.press("Escape");
  await settled();
  results.menu = {
    afterResize: resizedMenuFocus,
    afterEscape: await focused(),
    expanded: await toggle.getAttribute("aria-expanded"),
  };
  await page.setViewportSize({ width: 390, height: 900 });
  await settled();
  results.menu.reopenedOnMobile = await toggle.getAttribute("aria-expanded");
  await page.screenshot({
    path: path.join(output, `implementation-${mode}-menu.png`),
  });

  await page.goto(origin + `/game/${id}`);
  await page.locator(".wiki__title").waitFor();
  await page.getByRole("button", { name: /^Path/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.setViewportSize({ width: 1440, height: 900 });
  await settled();
  await page.getByRole("button", { name: "Close path" }).click();
  await settled();
  results.path = {
    focused: await focused(),
    summaryFocused: await page
      .locator(".game__desktop-path summary")
      .evaluate((element) => element === document.activeElement),
  };
  await page.screenshot({
    path: path.join(output, `implementation-${mode}-path.png`),
  });

  // A stale open menu may survive the resize even though focus left its
  // hidden trigger. Its Escape listener must defer to a native modal.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(origin + "/profile");
  await page.locator(".danger-zone button").waitFor();
  await toggle.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await settled();
  await page.locator(".danger-zone button").click();
  await page.getByRole("dialog").waitFor();
  const modalMenuOpen = await toggle.getAttribute("aria-expanded");
  await page.keyboard.press("Escape");
  await settled();
  results.modal = {
    menuBeforeEscape: modalMenuOpen,
    closedOnFirstEscape: await page
      .locator("dialog")
      .evaluate((element) => !element.open),
    menuAfterEscape: await toggle.getAttribute("aria-expanded"),
    focused: await focused(),
  };
  await page.screenshot({
    path: path.join(output, `implementation-${mode}-modal.png`),
  });
  if (!results.modal.closedOnFirstEscape)
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

  // At 1040px Navbar is already desktop while the game's Path trigger is
  // still available. This reaches the same stale-menu/modal interaction via UI.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(origin + `/game/${id}`);
  await page.locator(".wiki__title").waitFor();
  await settled();
  await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await toggle.click();
  await page.setViewportSize({ width: 1040, height: 900 });
  await settled();
  await page.getByRole("button", { name: /^Path/ }).click();
  await page.getByRole("dialog").waitFor();
  const pathMenuOpen = await toggle.getAttribute("aria-expanded");
  await page.keyboard.press("Escape");
  await settled();
  results.pathModal = {
    menuBeforeEscape: pathMenuOpen,
    closedOnFirstEscape: await page
      .locator("dialog")
      .evaluate((element) => !element.open),
    menuAfterEscape: await toggle.getAttribute("aria-expanded"),
    focused: await focused(),
  };
  await page.screenshot({
    path: path.join(output, `implementation-${mode}-path-modal.png`),
  });
  if (!results.pathModal.closedOnFirstEscape)
    await page.getByRole("button", { name: "Close path" }).click();

  results.indices = [];
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + `/history/${id}`);
    await page.locator(".moves-section summary").click();
    const measurements = await page
      .locator('.moves tbody th[scope="row"]')
      .evaluateAll((cells) =>
        cells
          .filter((cell) => Number(cell.textContent) >= 10)
          .map((cell) => {
            const range = document.createRange();
            range.selectNodeContents(cell);
            const tops = [
              ...new Set(
                [...range.getClientRects()]
                  .filter((rect) => rect.width > 0 && rect.height > 0)
                  .map((rect) => Math.round(rect.top * 100) / 100),
              ),
            ];
            return { text: cell.textContent.trim(), lines: tops.length };
          }),
      );
    const pageWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    results.indices.push({ width, pageWidth, cells: measurements });
    await page
      .locator('.moves tbody th[scope="row"]')
      .nth(9)
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(output, `implementation-${mode}-indices-${width}.png`),
    });
  }
  await context.close();
  fs.writeFileSync(
    path.join(output, `implementation-${mode}.json`),
    JSON.stringify({ results, calls }, null, 2) + "\n",
  );
  console.log(JSON.stringify(results, null, 2));
  if (mode === "after") {
    assert.equal(results.menu.expanded, "false");
    assert.equal(results.menu.reopenedOnMobile, "false");
    assert(results.menu.afterEscape.visible);
    assert(results.path.summaryFocused);
    assert.equal(results.modal.menuBeforeEscape, "true");
    assert(results.modal.closedOnFirstEscape);
    assert.equal(results.modal.menuAfterEscape, "false");
    assert.equal(results.pathModal.menuBeforeEscape, "true");
    assert(results.pathModal.closedOnFirstEscape);
    assert.equal(results.pathModal.menuAfterEscape, "false");
    assert.equal(results.pathModal.focused.className, "hud__path-toggle");
    for (const row of results.indices) {
      assert.equal(row.pageWidth, row.width);
      assert(row.cells.every((cell) => cell.lines === 1));
    }
    console.log("PASS isolated resize focus and move index regression probe");
  }
} finally {
  await browser.close();
}
