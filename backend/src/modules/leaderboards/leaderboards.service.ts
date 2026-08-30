import type {
  GameDifficulty,
  GameMode,
  Prisma,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import type { LeaderboardDto, LeaderboardEntryDto } from "./leaderboards.types.js";
import type { LeaderboardQuery } from "./leaderboards.schema.js";

// A COMPLETED row always has completedAt (games_completion_consistency). A
// COMPLETED row without it is a corrupt state, surfaced as an internal error.
type RankableGame = {
  id: string;
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: Date | null;
  user: { username: string };
};

function requireCompletedAt(game: Pick<RankableGame, "id" | "completedAt">): string {
  if (!game.completedAt) {
    throw new ApiError(
      500,
      ErrorCode.INTERNAL_ERROR,
      `Completed game ${game.id} has no completedAt`,
    );
  }

  return game.completedAt.toISOString();
}

/**
 * Assigns a sequential rank (list position, 1-based) to each already-ordered
 * game and maps it to its API DTO. Pure — no DB access — so ranking is unit
 * tested without seeding. Tied scores get consecutive distinct ranks; ordering
 * determinism comes from the query's tie-break chain, not from shared ranks.
 */
export function toLeaderboardEntries(
  orderedGames: RankableGame[],
): LeaderboardEntryDto[] {
  return orderedGames.map((game, index) => ({
    rank: index + 1,
    gameId: game.id,
    username: game.user.username,
    clickCount: game.clickCount,
    effectivePlayTimeMs: game.effectivePlayTimeMs,
    completedAt: requireCompletedAt(game),
  }));
}

// docs/api.md §7.2: click ranks by clickCount then effectivePlayTimeMs; time
// ranks by effectivePlayTimeMs then clickCount. `completedAt` then `id` are the
// deterministic final tie-break (earlier achiever first).
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

export async function getLeaderboard(
  mode: GameMode,
  query: LeaderboardQuery,
): Promise<LeaderboardDto> {
  const difficulty: GameDifficulty = query.difficulty;

  const games = await prisma.game.findMany({
    where: { status: "COMPLETED", mode, difficulty },
    orderBy: ORDER_BY[mode],
    take: query.limit,
    select: {
      id: true,
      clickCount: true,
      effectivePlayTimeMs: true,
      completedAt: true,
      user: { select: { username: true } },
    },
  });

  return {
    mode,
    difficulty,
    items: toLeaderboardEntries(games),
  };
}
