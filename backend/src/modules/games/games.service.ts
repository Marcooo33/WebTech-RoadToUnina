import type { Game } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import type { CreateGameInput } from "./games.schema.js";
import type {
  GameDto,
  GameListItemDto,
  PageRefDto,
} from "./games.types.js";
import type { StartingPageProvider } from "./starting-page.provider.js";

export const MAX_IN_PROGRESS_GAMES = 10;

type GameStatusFilter = "IN_PROGRESS" | "COMPLETED";

function gameNotFound(): ApiError {
  return new ApiError(404, ErrorCode.GAME_NOT_FOUND, "Game not found");
}

export function toGameDto(game: Game): GameDto {
  const path: PageRefDto[] = [
    { pageId: game.startPageId, title: game.startPageTitle },
  ];

  return {
    id: game.id,
    mode: game.mode,
    difficulty: game.difficulty,
    status: game.status,
    startPageId: game.startPageId,
    startPageTitle: game.startPageTitle,
    currentPageId: game.currentPageId,
    currentPageTitle: game.currentPageTitle,
    clickCount: game.clickCount,
    backtrackCount: game.backtrackCount,
    effectivePlayTimeMs: game.effectivePlayTimeMs,
    version: game.version,
    startedAt: game.startedAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
    createdAt: game.createdAt.toISOString(),
    path,
    moves: [],
    activeSession: null,
  };
}

export function toGameListItemDto(game: Game): GameListItemDto {
  return {
    id: game.id,
    mode: game.mode,
    difficulty: game.difficulty,
    status: game.status,
    startPageTitle: game.startPageTitle,
    currentPageId: game.currentPageId,
    currentPageTitle: game.currentPageTitle,
    clickCount: game.clickCount,
    backtrackCount: game.backtrackCount,
    effectivePlayTimeMs: game.effectivePlayTimeMs,
    version: game.version,
    startedAt: game.startedAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
    hasActiveSession: false,
  };
}

export class GamesService {
  constructor(private readonly startingPageProvider: StartingPageProvider) {}

  async create(userId: string, input: CreateGameInput): Promise<Game> {
    const inProgressCount = await prisma.game.count({
      where: { userId, status: "IN_PROGRESS" },
    });

    if (inProgressCount >= MAX_IN_PROGRESS_GAMES) {
      throw new ApiError(
        409,
        ErrorCode.GAME_LIMIT_REACHED,
        "Maximum number of in-progress games reached",
      );
    }

    const startingPage = await this.startingPageProvider.getStartingPage();

    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;

        const lockedCount = await tx.game.count({
          where: { userId, status: "IN_PROGRESS" },
        });

        if (lockedCount >= MAX_IN_PROGRESS_GAMES) {
          throw new ApiError(
            409,
            ErrorCode.GAME_LIMIT_REACHED,
            "Maximum number of in-progress games reached",
          );
        }

        return tx.game.create({
          data: {
            userId,
            mode: input.mode,
            difficulty: input.difficulty,
            startPageId: startingPage.pageId,
            startPageTitle: startingPage.title,
            currentPageId: startingPage.pageId,
            currentPageTitle: startingPage.title,
          },
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }

  async list(userId: string, status?: GameStatusFilter): Promise<Game[]> {
    return prisma.game.findMany({
      where: status ? { userId, status } : { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(userId: string, gameId: string): Promise<Game> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
    });

    if (!game) {
      throw gameNotFound();
    }

    return game;
  }

  async delete(userId: string, gameId: string, version: number): Promise<void> {
    const { count } = await prisma.game.deleteMany({
      where: {
        id: gameId,
        userId,
        status: "IN_PROGRESS",
        version,
      },
    });

    if (count === 1) {
      return;
    }

    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
      select: { status: true, version: true },
    });

    if (!game) {
      throw gameNotFound();
    }

    if (game.status !== "IN_PROGRESS") {
      throw new ApiError(
        409,
        ErrorCode.GAME_NOT_IN_PROGRESS,
        "Game is not in progress",
      );
    }

    throw new ApiError(409, ErrorCode.STALE_VERSION, "Stale version");
  }
}
