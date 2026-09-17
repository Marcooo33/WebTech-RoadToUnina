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

interface PreparedGameState {
  game: GameState;
}

async function move(context: BrowserContext, gameId: string, toTitle: string) {
  return context.request.post(`/api/games/${gameId}/moves`, {
    data: { toTitle },
  });
}

export async function getGame(
  context: BrowserContext,
  gameId: string,
): Promise<GameState> {
  const res = await context.request.get(`/api/games/${gameId}`);
  expect(res.ok(), `get game: ${res.status()}`).toBeTruthy();
  return ((await res.json()) as PreparedGameState).game;
}

/** Navigate the given titles in order via the API. Returns the final game state. */
export async function playThroughApi(
  context: BrowserContext,
  gameId: string,
  titles: readonly string[],
): Promise<GameState> {
  // Opening the game establishes the effective-time interval server-side.
  await getGame(context, gameId);

  let game: GameState | undefined;
  for (const toTitle of titles) {
    const res = await move(context, gameId, toTitle);
    expect(res.status(), `move to ${toTitle} failed: ${await res.text()}`).toBe(
      200,
    );
    game = ((await res.json()) as PreparedGameState).game;
  }

  if (!game) {
    throw new Error("playThroughApi called with no titles");
  }
  return game;
}
