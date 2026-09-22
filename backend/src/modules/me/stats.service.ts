import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import type { BestResultDto, StatisticsDto } from "./stats.types.js";

type BestResultRow = {
  id: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: Date | null;
};

const BEST_RESULT_SELECT = {
  id: true,
  difficulty: true,
  clickCount: true,
  effectivePlayTimeMs: true,
  completedAt: true,
} satisfies Prisma.GameSelect;

// Maps a best-result query row to its DTO. Pure, so it's unit tested without
// touching the database.
export function toBestResult(row: BestResultRow | null): BestResultDto | null {
  if (!row) {
    return null;
  }

  if (!row.completedAt) {
    // COMPLETED => completedAt != NULL (games_completion_consistency).
    throw new ApiError(
      500,
      ErrorCode.INTERNAL_ERROR,
      `Completed game ${row.id} has no completedAt`,
    );
  }

  return {
    gameId: row.id,
    difficulty: row.difficulty,
    clickCount: row.clickCount,
    effectivePlayTimeMs: row.effectivePlayTimeMs,
    completedAt: row.completedAt.toISOString(),
  };
}

// Rounds a Prisma `_avg` result to `decimals` places. `null` passes through
// unchanged, meaning the user has no completed games in that mode.
export function roundAverage(
  value: number | null | undefined,
  decimals: number,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function getUserStatistics(userId: string): Promise<StatisticsDto> {
  const [
    completedGames,
    inProgressGames,
    bestClickRow,
    bestTimeRow,
    clickAgg,
    timeAgg,
  ] = await prisma.$transaction([
    prisma.game.count({ where: { userId, status: "COMPLETED" } }),
    prisma.game.count({ where: { userId, status: "IN_PROGRESS" } }),
    prisma.game.findFirst({
      where: { userId, status: "COMPLETED", mode: "CLICK" },
      orderBy: [
        { clickCount: "asc" },
        { effectivePlayTimeMs: "asc" },
        { completedAt: "asc" },
      ],
      select: BEST_RESULT_SELECT,
    }),
    prisma.game.findFirst({
      where: { userId, status: "COMPLETED", mode: "TIME" },
      orderBy: [
        { effectivePlayTimeMs: "asc" },
        { clickCount: "asc" },
        { completedAt: "asc" },
      ],
      select: BEST_RESULT_SELECT,
    }),
    prisma.game.aggregate({
      where: { userId, status: "COMPLETED", mode: "CLICK" },
      _avg: { clickCount: true },
    }),
    prisma.game.aggregate({
      where: { userId, status: "COMPLETED", mode: "TIME" },
      _avg: { effectivePlayTimeMs: true },
    }),
  ]);

  return {
    completedGames,
    inProgressGames,
    bestClick: toBestResult(bestClickRow),
    bestTime: toBestResult(bestTimeRow),
    averageClicks: roundAverage(clickAgg._avg.clickCount, 1),
    averageEffectiveTimeMs: roundAverage(timeAgg._avg.effectivePlayTimeMs, 0),
  };
}
