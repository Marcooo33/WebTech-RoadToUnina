import type {
  Game,
  GameMode,
  GameMove,
  Prisma,
  User,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import { toGameMoveDto } from "../games/game-move.js";
import { reconstructActivePath } from "../games/game-path.js";
import type { HistoryQuery } from "./history.validation.js";
import type {
  CompletedGameDetailDto,
  HistoryEntryDto,
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
  };
}

function publicUsername(user: Pick<User, "username" | "deletedAt">): string {
  return user.deletedAt ? "Deleted user" : user.username;
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
    player: game.user.deletedAt ? null : toUserSummaryDto(game.user),
  };
}

type RankableGame = {
  id: string;
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: Date | null;
  user: { username: string; deletedAt: Date | null };
};

/** Maps an already ordered page and keeps ranks global across pagination. */
export function toHistoryEntries(
  orderedGames: RankableGame[],
  startingRank: number,
): HistoryEntryDto[] {
  return orderedGames.map((game, index) => ({
    rank: startingRank + index,
    gameId: game.id,
    username: publicUsername(game.user),
    clickCount: game.clickCount,
    effectivePlayTimeMs: game.effectivePlayTimeMs,
    completedAt: requireCompletedAt(game),
  }));
}

// The score and metric tie-breaks are the game rules. Completion time and id
// keep pagination deterministic when both metrics are equal.
const ORDER_BY: Record<GameMode, Prisma.GameOrderByWithRelationInput[]> = {
  CLICK: [
    { clickCount: "asc" },
    { effectivePlayTimeMs: "asc" },
    { completedAt: "asc" },
    { id: "asc" },
  ],
  TIME: [
    { effectivePlayTimeMs: "asc" },
    { clickCount: "asc" },
    { completedAt: "asc" },
    { id: "asc" },
  ],
};

export async function listCompletedGames(
  mode: GameMode,
  query: HistoryQuery,
): Promise<HistoryListDto> {
  const { difficulty, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    status: "COMPLETED" as const,
    mode,
    difficulty,
  };

  const [total, games] = await prisma.$transaction([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      orderBy: ORDER_BY[mode],
      skip,
      take: limit,
      select: {
        id: true,
        clickCount: true,
        effectivePlayTimeMs: true,
        completedAt: true,
        user: { select: { username: true, deletedAt: true } },
      },
    }),
  ]);

  return {
    mode,
    difficulty,
    items: toHistoryEntries(games, skip + 1),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getCompletedGameDetail(
  gameId: string,
): Promise<CompletedGameDetailDto> {
  const game = await prisma.game.findFirst({
    // A non-COMPLETED game is indistinguishable from a missing one here: the
    // public history endpoint returns the generic NOT_FOUND, never GAME_NOT_FOUND.
    where: { id: gameId, status: "COMPLETED" },
    include: { user: true, moves: { orderBy: { sequence: "asc" } } },
  });

  if (!game) {
    throw new ApiError(404, ErrorCode.NOT_FOUND, "Completed game not found");
  }

  return toCompletedGameDetailDto(game);
}
