import type { GameMove } from "../../generated/prisma/client.js";
import type { GameMoveDto } from "./games.types.js";

/**
 * Maps a persisted `GameMove` row to its API DTO (docs/api.md §3.4).
 *
 * Kept as a standalone pure helper — alongside `reconstructActivePath` in
 * `game-path.ts` — so read-only consumers (e.g. the public history module) can
 * reuse it without importing the gameplay service graph.
 */
export function toGameMoveDto(move: GameMove): GameMoveDto {
  return {
    sequence: move.sequence,
    type: move.type,
    fromPageId: move.fromPageId,
    fromPageTitle: move.fromPageTitle,
    toPageId: move.toPageId,
    toPageTitle: move.toPageTitle,
    createdAt: move.createdAt.toISOString(),
  };
}
