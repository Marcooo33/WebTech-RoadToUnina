import { expect, type BrowserContext } from "@playwright/test";

/**
 * API helpers that only *support* browser E2E scenarios: seeding a completed
 * game (`playThroughApi`) and reading authoritative state as a secondary
 * assertion (`getGame`). The primary action and assertion of every spec is
 * performed through the Angular UI.
 */

interface GameState {
  id: string;
  status: string;
  effectivePlayTimeMs: number;
}

async function move(context: BrowserContext, gameId: string, toPageId: number) {
  return context.request.post(`/api/games/${gameId}/moves`, {
    data: { toPageId },
  });
}

export async function getGame(
  context: BrowserContext,
  gameId: string,
): Promise<GameState> {
  const res = await context.request.get(`/api/games/${gameId}`);
  expect(res.ok(), `get game: ${res.status()}`).toBeTruthy();
  return (await res.json()) as GameState;
}

/** Navigate the given page ids in order via the API. Returns the final game state. */
export async function playThroughApi(
  context: BrowserContext,
  gameId: string,
  pageIds: readonly number[],
): Promise<GameState> {
  // Opening the game establishes the effective-time interval server-side.
  await getGame(context, gameId);

  let game: GameState | undefined;
  for (const toPageId of pageIds) {
    const res = await move(context, gameId, toPageId);
    expect(
      res.status(),
      `move to ${toPageId} failed: ${await res.text()}`,
    ).toBe(200);
    game = (await res.json()) as GameState;
  }

  if (!game) {
    throw new Error("playThroughApi called with no page ids");
  }
  return game;
}
