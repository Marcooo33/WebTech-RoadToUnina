import type {
  Game,
  GameMove,
  User,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import { toGameMoveDto } from "../games/game-move.js";
import { reconstructActivePath } from "../games/game-path.js";
import type { HistoryListQuery } from "./history.schema.js";
import type {
  CompletedGameDetailDto,
  CompletedGameSummaryDto,
  HistoryListDto,
  UserSummaryDto,
} from "./history.types.js";

type GameWithPlayer = Game & { user: User };
type GameWithPlayerAndMoves = GameWithPlayer & { moves: GameMove[] };

// COMPLETED => completedAt != NULL is a database invariant
// (`games_completion_consistency`). A COMPLETED row without it is a corrupt
// state, not a client-visible condition: surface it as an internal error rather
// than serializing null or asserting the type away.
function requireCompletedAt(game: Pick<Game, "id" | "completedAt">): string {
  if (!game.completedAt) {
    throw new ApiError(
      500,
      ErrorCode.INTERNAL_ERROR,
      `Completed game ${game.id} has no completedAt`,
    );
  }

  return game.completedAt.toISOString();
}

function toUserSummaryDto(user: User): UserSummaryDto {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl ?? null,
  };
}

function toCompletedGameSummaryDto(
  game: GameWithPlayer,
): CompletedGameSummaryDto {
  return {
    gameId: game.id,
    mode: game.mode,
    difficulty: game.difficulty,
    clickCount: game.clickCount,
    effectivePlayTimeMs: game.effectivePlayTimeMs,
    startPageTitle: game.startPageTitle,
    completedAt: requireCompletedAt(game),
    player: toUserSummaryDto(game.user),
  };
}

function toCompletedGameDetailDto(
  game: GameWithPlayerAndMoves,
): CompletedGameDetailDto {
  const path = reconstructActivePath(
    { pageId: game.startPageId, title: game.startPageTitle },
    game.moves,
  );

  return {
    gameId: game.id,
    mode: game.mode,
    difficulty: game.difficulty,
    clickCount: game.clickCount,
    backtrackCount: game.backtrackCount,
    effectivePlayTimeMs: game.effectivePlayTimeMs,
    startPageId: game.startPageId,
    startPageTitle: game.startPageTitle,
    completedAt: requireCompletedAt(game),
    path,
    moves: game.moves.map(toGameMoveDto),
    player: toUserSummaryDto(game.user),
  };
}

export async function listCompletedGames(
  query: HistoryListQuery,
): Promise<HistoryListDto> {
  const { mode, difficulty, page, limit } = query;

  const where = {
    status: "COMPLETED" as const,
    ...(mode ? { mode } : {}),
    ...(difficulty ? { difficulty } : {}),
  };

  const [total, games] = await prisma.$transaction([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      // completedAt DESC is the contract ordering (docs/api.md §7.1.1); id ASC is
      // a stable tie-break so pagination does not reshuffle same-instant rows.
      orderBy: [{ completedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: { user: true },
    }),
  ]);

  return {
    items: games.map(toCompletedGameSummaryDto),
    page,
    limit,
    total,
  };
}

export async function getCompletedGameDetail(
  gameId: string,
): Promise<CompletedGameDetailDto> {
  const game = await prisma.game.findFirst({
    // A non-COMPLETED game is indistinguishable from a missing one here
    // (docs/api.md §7.1.2 uses the generic NOT_FOUND, never GAME_NOT_FOUND).
    where: { id: gameId, status: "COMPLETED" },
    include: { user: true, moves: { orderBy: { sequence: "asc" } } },
  });

  if (!game) {
    throw new ApiError(404, ErrorCode.NOT_FOUND, "Completed game not found");
  }

  return toCompletedGameDetailDto(game);
}
