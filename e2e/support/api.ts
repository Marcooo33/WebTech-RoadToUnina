import { expect, type BrowserContext } from "@playwright/test";

/**
 * API helpers that only *support* browser E2E scenarios: seeding a completed
 * game (`playThroughApi`) and reading authoritative state as a secondary
 * assertion (`getGame`). The primary action and assertion of every spec is
 * performed through the Angular UI.
 */

interface GameState {
  id: string;
  version: number;
  status: string;
}

async function startSession(context: BrowserContext, gameId: string): Promise<number> {
  const res = await context.request.post(`/api/games/${gameId}/session`);
  expect(res.ok(), `start session: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { gameVersion: number };
  return body.gameVersion;
}

async function move(
  context: BrowserContext,
  gameId: string,
  toPageId: number,
  version: number,
) {
  return context.request.post(`/api/games/${gameId}/moves`, {
    data: { toPageId, version },
  });
}

export async function getGame(
  context: BrowserContext,
  gameId: string,
): Promise<GameState & { activeSession: unknown }> {
  const res = await context.request.get(`/api/games/${gameId}`);
  expect(res.ok(), `get game: ${res.status()}`).toBeTruthy();
  return (await res.json()) as GameState & { activeSession: unknown };
}

/** Navigate the given page ids in order via the API. Returns the final game state. */
export async function playThroughApi(
  context: BrowserContext,
  gameId: string,
  pageIds: readonly number[],
): Promise<GameState> {
  let version = await startSession(context, gameId);
  let game: GameState | undefined;

  for (const toPageId of pageIds) {
    const res = await move(context, gameId, toPageId, version);
    expect(
      res.status(),
      `move to ${toPageId} failed: ${await res.text()}`,
    ).toBe(200);
    game = (await res.json()) as GameState;
    version = game.version;
  }

  if (!game) {
    throw new Error("playThroughApi called with no page ids");
  }
  return game;
}
