import { expect, test } from "@playwright/test";
import {
  createGameInContext,
  loginInContext,
  registerInContext,
  uniqueUser,
} from "../support/users.js";
import { getGame } from "../support/api.js";
import { countActiveSessions } from "../support/db.js";

const DB_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:55432/roadtounina_e2e";

test("one game opened from two browsers keeps exactly one ACTIVE session", async ({
  page,
  context,
  browser,
}) => {
  const user = uniqueUser();
  await registerInContext(context, user);
  const game = await createGameInContext(context, "CLICK", "EASY");

  // Browser 1 loads the game — the game page starts a play session.
  await page.goto(`/game/${game.id}`);
  await expect(page.getByTestId("hud-clicks")).toBeVisible();

  // Browser 2 — a genuinely separate context, same account — resumes the game.
  const other = await browser.newContext();
  await loginInContext(other, user);
  const otherPage = await other.newPage();
  await otherPage.goto(`/game/${game.id}`);
  await expect(otherPage.getByTestId("hud-clicks")).toBeVisible();

  // Invariant after a sequential resume.
  expect(await countActiveSessions(DB_URL, game.id)).toBe(1);

  // Now hammer start/resume from both contexts *concurrently* — the race the
  // one_active_session_per_game partial unique index + idempotent startOrResume
  // are meant to survive. Every response must be OK and the DB must still hold a
  // single ACTIVE row.
  const burst = await Promise.all([
    ...Array.from({ length: 4 }, () => context.request.post(`/api/games/${game.id}/session`)),
    ...Array.from({ length: 4 }, () => other.request.post(`/api/games/${game.id}/session`)),
  ]);
  for (const res of burst) {
    expect(res.status(), await res.text()).toBe(200);
  }
  expect(await countActiveSessions(DB_URL, game.id)).toBe(1);

  // Both browsers observe the same single active session.
  const fromFirst = await getGame(context, game.id);
  const fromSecond = await getGame(other, game.id);
  const idFrom = (g: { activeSession: unknown }) =>
    (g.activeSession as { id?: string } | null)?.id ?? null;
  expect(idFrom(fromFirst)).not.toBeNull();
  expect(idFrom(fromSecond)).toBe(idFrom(fromFirst));

  await other.close();
});
