import assert from "node:assert/strict";
import { test } from "node:test";
import type { GameMove } from "../../generated/prisma/client.js";
import { toGameMoveDto } from "./game-move.js";

test("toGameMoveDto maps a GameMove row to its DTO with an ISO timestamp", () => {
  const createdAt = new Date("2026-08-28T10:01:00.000Z");
  const move = {
    id: "00000000-0000-0000-0000-000000000000",
    gameId: "11111111-1111-1111-1111-111111111111",
    sequence: 3,
    type: "BACKTRACK",
    fromPageId: 400,
    fromPageTitle: "D",
    toPageId: 300,
    toPageTitle: "C",
    createdAt,
  } satisfies GameMove;

  assert.deepEqual(toGameMoveDto(move), {
    sequence: 3,
    type: "BACKTRACK",
    fromPageId: 400,
    fromPageTitle: "D",
    toPageId: 300,
    toPageTitle: "C",
    createdAt: "2026-08-28T10:01:00.000Z",
  });
});
