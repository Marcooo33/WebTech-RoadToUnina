import { test } from "node:test";
import assert from "node:assert/strict";
import {
  elapsedMs,
  prepareNavigation,
  prepareBacktrack,
  transitionTiming,
  toGameDto,
} from "../src/modules/games/game-engine.js";
import { createE2EWikipediaService } from "../src/testing/e2e-wikipedia.js";
import type { GameWithMoves } from "../src/modules/games/games.types.js";
const now = new Date("2026-01-01T00:00:00Z");
function game(): GameWithMoves {
  return {
    id: "game",
    mode: "CLICK",
    difficulty: "EASY",
    status: "IN_PROGRESS",
    startPageId: 4100,
    startPageTitle: "Partenope (sirena)",
    currentPageId: 4101,
    currentPageTitle: "Golfo di Napoli",
    clickCount: 1,
    backtrackCount: 0,
    effectivePlayTimeMs: 100,
    playStartedAt: now,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    moves: [
      {
        id: "move",
        gameId: "game",
        sequence: 1,
        type: "NAVIGATION",
        fromPageId: 4100,
        fromPageTitle: "Partenope (sirena)",
        toPageId: 4101,
        toPageTitle: "Golfo di Napoli",
        createdAt: now,
      },
    ],
  };
}
test("elapsed intervals and completion use service arrival, not article preparation time", () => {
  assert.equal(elapsedMs(null, now), 0);
  assert.equal(elapsedMs(new Date(now.getTime() + 100), now), 0);
  const timing = transitionTiming(
    game(),
    new Date(+now + 1000),
    new Date(+now + 9000),
    false,
  );
  assert.equal(timing.elapsed, 1000);
  assert.equal(+timing.playStartedAt!, +now + 9000);
  const completed = transitionTiming(
    game(),
    new Date(+now + 1000),
    new Date(+now + 9000),
    true,
  );
  assert.equal(completed.playStartedAt, null);
  assert.equal(completed.status, "COMPLETED");
});
test("both modes and every difficulty share validated navigation and backtrack rules", async () => {
  const wiki = createE2EWikipediaService();
  for (const mode of ["CLICK", "TIME"] as const)
    for (const difficulty of ["EASY", "MEDIUM", "HARD"] as const) {
      const state = { ...game(), mode, difficulty };
      assert.equal(
        (await prepareNavigation(wiki, state, "Napoli")).destination.pageId,
        4104,
      );
      await assert.rejects(prepareNavigation(wiki, state, "Not linked"), {
        code: "INVALID_MOVE",
      });
      if (difficulty === "HARD")
        await assert.rejects(prepareBacktrack(wiki, state, state.moves), {
          code: "BACKTRACK_NOT_ALLOWED",
        });
      else
        assert.equal(
          (await prepareBacktrack(wiki, state, state.moves)).previous.pageId,
          4100,
        );
      state.backtrackCount = 3;
      if (difficulty === "MEDIUM")
        await assert.rejects(prepareBacktrack(wiki, state, state.moves), {
          code: "BACKTRACK_LIMIT_REACHED",
        });
    }
});
test("resolved target completes without loading a playable target article; DTO reconstructs events", async () => {
  const state = game();
  state.currentPageId = 4104;
  const result = await prepareNavigation(
    createE2EWikipediaService(),
    state,
    "Università degli Studi di Napoli Federico II",
  );
  assert.equal(result.isTarget, true);
  assert.equal(result.article, null);
  const dto = toGameDto(state, state.moves);
  assert.equal(dto.moves.length, 1);
  assert.equal(dto.path.length, 2);
});
