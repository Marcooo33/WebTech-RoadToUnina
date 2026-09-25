import { TARGET_PAGE_ID } from "../../config/game.js";
import {
  Prisma,
  type Game,
  type GameMove,
  type GameMoveType,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import type { WikipediaArticleSource } from "../wikipedia/wikipedia.types.js";
import { toGameMoveDto } from "./game-move.js";
import { reconstructActivePath } from "./game-path.js";
import type {
  CreateGameInput,
  GameStatusFilter,
  MoveInput,
} from "./games.validation.js";
import type {
  ArticleDto,
  GameDto,
  GameListItemDto,
  GameWithMoves,
  PageRefDto,
  PreparedGameState,
} from "./games.types.js";

export const MAX_IN_PROGRESS_GAMES = 10;
export const MEDIUM_BACKTRACK_LIMIT = 3;

// Play time is measured server-side with two fields on the game:
//   effectivePlayTimeMs - play time already counted
//   playStartedAt       - start of the current interval, null while paused
// Opening the game starts an interval; every move closes it and starts a new
// one; leaving the game page (pause) closes it.

function gameNotFound(): ApiError {
  return new ApiError(404, ErrorCode.GAME_NOT_FOUND, "Game not found");
}

function gameNotInProgress(): ApiError {
  return new ApiError(
    409,
    ErrorCode.GAME_NOT_IN_PROGRESS,
    "Game is not in progress",
  );
}

function invalidMove(): ApiError {
  return new ApiError(
    422,
    ErrorCode.INVALID_MOVE,
    "Target page is not a valid playable link",
  );
}

// Length of the current interval up to `until`; 0 while the game is paused.
function elapsedMs(playStartedAt: Date | null, until: Date): number {
  if (!playStartedAt) {
    return 0;
  }
  return Math.max(0, until.getTime() - playStartedAt.getTime());
}

export function toGameDto(game: Game, moves: GameMove[]): GameDto {
  const path = reconstructActivePath(
    { pageId: game.startPageId, title: game.startPageTitle },
    moves,
  );

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
    startedAt: game.startedAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
    createdAt: game.createdAt.toISOString(),
    path,
    moves: moves.map(toGameMoveDto),
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
    startedAt: game.startedAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
  };
}

export class GamesService {
  constructor(private readonly wikipedia: WikipediaArticleSource) {}

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

    const startingPage = await this.wikipedia.getStartingPage();

    return prisma.game.create({
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
  }

  async list(userId: string, status?: GameStatusFilter): Promise<Game[]> {
    return prisma.game.findMany({
      where: status ? { userId, status } : { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  // Loads an owned game to open or resume it. For an IN_PROGRESS game it also
  // loads the current article and then starts a new play interval.
  async get(userId: string, gameId: string): Promise<PreparedGameState> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
      include: { moves: { orderBy: { sequence: "asc" } } },
    });

    if (!game) {
      throw gameNotFound();
    }

    if (game.status !== "IN_PROGRESS") {
      return { game, article: null };
    }

    // The article is loaded first, so waiting for MediaWiki is not play time.
    const article = this.toArticleDto(
      game.id,
      await this.wikipedia.getArticle(game.currentPageId),
    );

    // If an interval is still open here, the pause sent when the player left
    // never arrived (browser crash, lost connection). It is discarded, so time
    // spent with the game closed is never counted.
    const restarted = await prisma.game.update({
      where: { id: gameId },
      data: { playStartedAt: new Date() },
    });

    return { game: { ...restarted, moves: game.moves }, article };
  }

  async getArticle(userId: string, gameId: string): Promise<ArticleDto> {
    const game = await this.loadOwnedGame(userId, gameId);
    return this.toArticleDto(
      game.id,
      await this.wikipedia.getArticle(game.currentPageId),
    );
  }

  // Called when the player leaves the game page: closes the current interval.
  async pause(userId: string, gameId: string): Promise<void> {
    const game = await this.loadInProgressGame(userId, gameId);

    if (!game.playStartedAt) {
      return;
    }

    // Matching playStartedAt skips the update if a move restarted the
    // interval in the meantime, so the same time is never counted twice.
    await prisma.game.updateMany({
      where: { id: gameId, playStartedAt: game.playStartedAt },
      data: {
        effectivePlayTimeMs: {
          increment: elapsedMs(game.playStartedAt, new Date()),
        },
        playStartedAt: null,
      },
    });
  }

  async move(
    userId: string,
    gameId: string,
    input: MoveInput,
  ): Promise<PreparedGameState> {
    // Play time stops when the move arrives: loading the next article from
    // MediaWiki below is not counted.
    const arrivedAt = new Date();
    const game = await this.loadInProgressGame(userId, gameId);

    const destination = await this.wikipedia.resolveNavigation(
      game.currentPageId,
      input.toTitle,
    );

    if (!destination) {
      throw invalidMove();
    }

    const isTarget = destination.pageId === TARGET_PAGE_ID;
    const article = isTarget
      ? null
      : this.toArticleDto(
          gameId,
          await this.wikipedia.getArticle(destination.pageId),
        );

    const updated = await prisma.$transaction(async (tx) => {
      await this.updateInProgressGame(tx, gameId, {
        currentPageId: destination.pageId,
        currentPageTitle: destination.title,
        clickCount: { increment: 1 },
        effectivePlayTimeMs: {
          increment: elapsedMs(game.playStartedAt, arrivedAt),
        },
        ...(isTarget
          ? {
              status: "COMPLETED" as const,
              completedAt: new Date(),
              playStartedAt: null,
            }
          : { playStartedAt: new Date() }),
      });

      await this.recordMove(
        tx,
        gameId,
        "NAVIGATION",
        { pageId: game.currentPageId, title: game.currentPageTitle },
        destination,
      );

      return this.loadWithMoves(tx, gameId);
    });

    return { game: updated, article };
  }

  async backtrack(userId: string, gameId: string): Promise<PreparedGameState> {
    const arrivedAt = new Date();
    const game = await this.loadInProgressGame(userId, gameId);

    if (game.difficulty === "HARD") {
      throw new ApiError(
        422,
        ErrorCode.BACKTRACK_NOT_ALLOWED,
        "Backtracking is not allowed on HARD difficulty",
      );
    }

    if (
      game.difficulty === "MEDIUM" &&
      game.backtrackCount >= MEDIUM_BACKTRACK_LIMIT
    ) {
      throw new ApiError(
        422,
        ErrorCode.BACKTRACK_LIMIT_REACHED,
        "Backtracking limit reached",
      );
    }

    const moves = await prisma.gameMove.findMany({
      where: { gameId },
      orderBy: { sequence: "asc" },
    });

    const path = reconstructActivePath(
      { pageId: game.startPageId, title: game.startPageTitle },
      moves,
    );

    if (path.length <= 1) {
      throw new ApiError(
        422,
        ErrorCode.BACKTRACK_NOT_ALLOWED,
        "Cannot backtrack from the starting page",
      );
    }

    const current = path[path.length - 1];
    const previous = path[path.length - 2];
    const article = this.toArticleDto(
      gameId,
      await this.wikipedia.getArticle(previous.pageId),
    );

    const updated = await prisma.$transaction(async (tx) => {
      await this.updateInProgressGame(tx, gameId, {
        currentPageId: previous.pageId,
        currentPageTitle: previous.title,
        backtrackCount: { increment: 1 },
        effectivePlayTimeMs: {
          increment: elapsedMs(game.playStartedAt, arrivedAt),
        },
        playStartedAt: new Date(),
      });

      await this.recordMove(tx, gameId, "BACKTRACK", current, previous);

      return this.loadWithMoves(tx, gameId);
    });

    return { game: updated, article };
  }

  async delete(userId: string, gameId: string): Promise<void> {
    const { count } = await prisma.game.deleteMany({
      where: { id: gameId, userId, status: "IN_PROGRESS" },
    });

    if (count === 1) {
      return;
    }

    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
      select: { status: true },
    });

    if (!game) {
      throw gameNotFound();
    }

    throw gameNotInProgress();
  }

  private async loadOwnedGame(userId: string, gameId: string): Promise<Game> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
    });

    if (!game) {
      throw gameNotFound();
    }

    return game;
  }

  private async loadInProgressGame(
    userId: string,
    gameId: string,
  ): Promise<Game> {
    const game = await this.loadOwnedGame(userId, gameId);

    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

    return game;
  }

  // Updates the game only while it is still IN_PROGRESS, so a move that
  // arrives after the game was completed or deleted (e.g. from another tab)
  // rolls back the whole transaction instead of changing a finished game.
  private async updateInProgressGame(
    tx: Prisma.TransactionClient,
    gameId: string,
    data: Prisma.GameUpdateManyMutationInput,
  ): Promise<void> {
    const { count } = await tx.game.updateMany({
      where: { id: gameId, status: "IN_PROGRESS" },
      data,
    });

    if (count === 0) {
      throw gameNotInProgress();
    }
  }

  private async recordMove(
    tx: Prisma.TransactionClient,
    gameId: string,
    type: GameMoveType,
    from: PageRefDto,
    to: PageRefDto,
  ): Promise<void> {
    const aggregate = await tx.gameMove.aggregate({
      where: { gameId },
      _max: { sequence: true },
    });

    await tx.gameMove.create({
      data: {
        gameId,
        sequence: (aggregate._max.sequence ?? 0) + 1,
        type,
        fromPageId: from.pageId,
        fromPageTitle: from.title,
        toPageId: to.pageId,
        toPageTitle: to.title,
      },
    });
  }

  private async loadWithMoves(
    tx: Prisma.TransactionClient,
    gameId: string,
  ): Promise<GameWithMoves> {
    return tx.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { moves: { orderBy: { sequence: "asc" } } },
    });
  }

  private toArticleDto(
    gameId: string,
    article: Awaited<ReturnType<WikipediaArticleSource["getArticle"]>>,
  ): ArticleDto {
    return {
      gameId,
      pageId: article.pageId,
      title: article.title,
      contentHtml: article.contentHtml,
      links: article.links.map((link) => ({ title: link.title })),
    };
  }
}
