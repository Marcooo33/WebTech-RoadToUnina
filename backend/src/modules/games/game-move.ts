import type { GameMove } from "../../generated/prisma/client.js";
import type { GameMoveDto } from "./games.types.js";

// Kept as a standalone pure helper, alongside reconstructActivePath in
// game-path.ts, so read-only consumers like the history module can reuse it
// without importing the whole gameplay service.
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
