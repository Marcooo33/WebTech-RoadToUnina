import { TARGET_PAGE_ID } from "../../config/game.js";
import {
  Prisma,
  type Game,
  type GameMove,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import type { WikipediaArticleSource } from "../wikipedia/wikipedia.types.js";
import {
  activityData,
  completionTimingData,
  resumeIntervalData,
  transitionTimingData,
} from "./game-timing.js";
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
  PreparedGameState,
} from "./games.types.js";

export const MAX_IN_PROGRESS_GAMES = 10;
export const MEDIUM_BACKTRACK_LIMIT = 3;

const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

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

function gameStateChanged(): ApiError {
  return new ApiError(
    409,
    ErrorCode.GAME_STATE_CHANGED,
    "Game state changed while the operation was being prepared",
  );
}

function sameInstant(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

// Two tabs racing the same game can both grab the same next move sequence.
// Postgres rejects the loser with P2002 on the (game_id, sequence) unique
// index; we just recompute the sequence and retry once.
function isSequenceConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function withSequenceRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isSequenceConflict(error)) {
      return run();
    }
    throw error;
  }
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
    playStartedAt: game.playStartedAt?.toISOString() ?? null,
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

    return prisma.$transaction(async (tx) => {
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
    }, TX_OPTIONS);
  }

  async list(userId: string, status?: GameStatusFilter): Promise<Game[]> {
    return prisma.game.findMany({
      where: status ? { userId, status } : { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  // Loads an owned game to open or resume it. For an IN_PROGRESS game this also
  // prepares the current article and then (re)starts the effective-time
  // interval, so article-loading time is not counted as playable time. There
  // is no separate start/resume endpoint; opening a game IS the resume flow.
  // The short reconciliation transaction below locks the game row so a move,
  // completion, heartbeat or deletion racing the article load can't be lost.
  async get(
    userId: string,
    gameId: string,
    preparationStartedAt: Date,
  ): Promise<PreparedGameState> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
      include: { moves: { orderBy: { sequence: "asc" } } },
    });

    if (!game) {
      throw gameNotFound();
    }

    // A COMPLETED game is immutable, so there is nothing to resume.
    if (game.status !== "IN_PROGRESS") {
      return { game, article: null };
    }

    // Load the article before touching timing: official play time only starts
    // once the article is ready server-side, not while MediaWiki is loading.
    const article = await this.toArticleDto(
      game.id,
      await this.wikipedia.getArticle(game.currentPageId),
    );
    const current = await prisma.$transaction(async (tx) => {
      await this.lockOwnedGame(tx, userId, gameId);
      const state = await tx.game.findFirst({
        where: { id: gameId, userId },
        include: { moves: { orderBy: { sequence: "asc" } } },
      });

      if (!state) throw gameNotFound();
      if (state.status !== "IN_PROGRESS") return state;

      // A concurrent move changed the page while the article was loading. Don't
      // start timing against stale content; let the client retry and get one
      // coherent state instead.
      if (state.currentPageId !== article.pageId) {
        throw gameStateChanged();
      }

      // Any heartbeat received after preparation started is capped at
      // preparationStartedAt, so the time spent preparing the article is never
      // counted as playable time. Moves are already loaded, so we don't need
      // another query after this write.
      const restartedAt = new Date();
      const restarted = await tx.game.update({
        where: { id: gameId },
        data: resumeIntervalData(state, restartedAt, preparationStartedAt),
      });

      return { ...restarted, moves: state.moves };
    }, TX_OPTIONS);

    return {
      game: current,
      article: current.status === "IN_PROGRESS" ? article : null,
    };
  }

  async getArticle(userId: string, gameId: string): Promise<ArticleDto> {
    const game = await this.loadOwnedGame(userId, gameId);
    return this.toArticleDto(
      game.id,
      await this.wikipedia.getArticle(game.currentPageId),
    );
  }

  // Records that the owner is still actively playing by advancing
  // lastHeartbeatAt. There is no session row, nothing else changes, and a
  // completed game rejects the heartbeat.
  async heartbeat(userId: string, gameId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await this.lockOwnedGame(tx, userId, gameId);
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });

      if (game.status !== "IN_PROGRESS") {
        throw gameNotInProgress();
      }

      await tx.game.update({
        where: { id: gameId },
        data: activityData(game, new Date()),
      });
    }, TX_OPTIONS);
  }

  async move(
    userId: string,
    gameId: string,
    input: MoveInput,
    navigationStartedAt: Date,
  ): Promise<PreparedGameState> {
    const game = await this.loadOwnedGame(userId, gameId);

    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

    const destination = await this.wikipedia.resolveNavigation(
      game.currentPageId,
      input.toTitle,
    );

    if (!destination) {
      throw invalidMove();
    }

    const fromPageId = game.currentPageId;
    const fromPageTitle = game.currentPageTitle;
    const isTarget = destination.pageId === TARGET_PAGE_ID;
    const article = isTarget
      ? null
      : this.toArticleDto(
          gameId,
          await this.wikipedia.getArticle(destination.pageId),
        );

    const updated = await withSequenceRetry(() =>
      prisma.$transaction(async (tx) => {
        await this.lockOwnedGame(tx, userId, gameId);
        const current = await tx.game.findUniqueOrThrow({
          where: { id: gameId },
          select: {
            status: true,
            currentPageId: true,
            currentPageTitle: true,
            clickCount: true,
            backtrackCount: true,
            playStartedAt: true,
          },
        });
        if (current.status !== "IN_PROGRESS") {
          throw gameNotInProgress();
        }
        if (
          current.currentPageId !== fromPageId ||
          current.currentPageTitle !== fromPageTitle ||
          current.clickCount !== game.clickCount ||
          current.backtrackCount !== game.backtrackCount ||
          !sameInstant(current.playStartedAt, game.playStartedAt)
        ) {
          throw gameStateChanged();
        }

        await tx.game.update({
          where: { id: gameId },
          data: {
            currentPageId: destination.pageId,
            currentPageTitle: destination.title,
            clickCount: { increment: 1 },
            ...(isTarget
              ? {
                  status: "COMPLETED" as const,
                  completedAt: new Date(),
                  ...completionTimingData(
                    current.playStartedAt,
                    navigationStartedAt,
                  ),
                }
              : {}),
          },
        });

        const sequence = await this.nextSequence(tx, gameId);
        await tx.gameMove.create({
          data: {
            gameId,
            sequence,
            type: "NAVIGATION",
            fromPageId,
            fromPageTitle,
            toPageId: destination.pageId,
            toPageTitle: destination.title,
          },
        });

        const responseState = await this.loadOwnedWithMoves(tx, gameId);
        if (isTarget) return responseState;

        return this.restartPreparedTransition(
          tx,
          responseState,
          current.playStartedAt,
          navigationStartedAt,
        );
      }, TX_OPTIONS),
    );

    return { game: updated, article };
  }

  async backtrack(
    userId: string,
    gameId: string,
    navigationStartedAt: Date,
  ): Promise<PreparedGameState> {
    const game = await this.loadOwnedGame(userId, gameId);

    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

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

    const updated = await withSequenceRetry(() =>
      prisma.$transaction(async (tx) => {
        await this.lockOwnedGame(tx, userId, gameId);
        const state = await tx.game.findUniqueOrThrow({
          where: { id: gameId },
          select: {
            status: true,
            currentPageId: true,
            currentPageTitle: true,
            clickCount: true,
            backtrackCount: true,
            playStartedAt: true,
          },
        });
        if (state.status !== "IN_PROGRESS") {
          throw gameNotInProgress();
        }
        if (
          state.currentPageId !== current.pageId ||
          state.currentPageTitle !== current.title ||
          state.clickCount !== game.clickCount ||
          state.backtrackCount !== game.backtrackCount ||
          !sameInstant(state.playStartedAt, game.playStartedAt)
        ) {
          throw gameStateChanged();
        }

        await tx.game.update({
          where: { id: gameId },
          data: {
            currentPageId: previous.pageId,
            currentPageTitle: previous.title,
            backtrackCount: { increment: 1 },
          },
        });

        const sequence = await this.nextSequence(tx, gameId);
        await tx.gameMove.create({
          data: {
            gameId,
            sequence,
            type: "BACKTRACK",
            fromPageId: current.pageId,
            fromPageTitle: current.title,
            toPageId: previous.pageId,
            toPageTitle: previous.title,
          },
        });

        const responseState = await this.loadOwnedWithMoves(tx, gameId);
        return this.restartPreparedTransition(
          tx,
          responseState,
          state.playStartedAt,
          navigationStartedAt,
        );
      }, TX_OPTIONS),
    );

    return { game: updated, article };
  }

  // Locks one owned game row for the duration of the enclosing transaction.
  private async lockOwnedGame(
    tx: Prisma.TransactionClient,
    userId: string,
    gameId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "games"
      WHERE "id" = ${gameId}::uuid AND "user_id" = ${userId}::uuid
      FOR UPDATE
    `;
    if (rows.length === 0) throw gameNotFound();
  }

  // Final timing write, run after the response state has already been built.
  private async restartPreparedTransition(
    tx: Prisma.TransactionClient,
    state: GameWithMoves,
    previousPlayStartedAt: Date | null,
    navigationStartedAt: Date,
  ): Promise<GameWithMoves> {
    const restartedAt = new Date();
    const restarted = await tx.game.update({
      where: { id: state.id },
      data: transitionTimingData(
        previousPlayStartedAt,
        navigationStartedAt,
        restartedAt,
      ),
    });
    return { ...restarted, moves: state.moves };
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

  private async nextSequence(
    tx: Prisma.TransactionClient,
    gameId: string,
  ): Promise<number> {
    const aggregate = await tx.gameMove.aggregate({
      where: { gameId },
      _max: { sequence: true },
    });

    return (aggregate._max.sequence ?? 0) + 1;
  }

  private async loadOwnedWithMoves(
    tx: Prisma.TransactionClient,
    gameId: string,
  ): Promise<GameWithMoves> {
    const game = await tx.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { moves: { orderBy: { sequence: "asc" } } },
    });

    return game;
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
