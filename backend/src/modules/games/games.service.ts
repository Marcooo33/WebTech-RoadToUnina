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
} from "./game-timing.js";
import { toGameMoveDto } from "./game-move.js";
import { reconstructActivePath } from "./game-path.js";
import type {
  BacktrackInput,
  CreateGameInput,
  MoveInput,
} from "./games.schema.js";
import type {
  ArticleDto,
  GameDto,
  GameListItemDto,
  GameWithMoves,
} from "./games.types.js";
import type { StartingPageProvider } from "./starting-page.provider.js";

export const MAX_IN_PROGRESS_GAMES = 10;
export const MEDIUM_BACKTRACK_LIMIT = 3;

const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

type GameStatusFilter = "IN_PROGRESS" | "COMPLETED";

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

/**
 * `true` for a unique-constraint violation (P2002). The only such constraint a
 * gameplay write can hit is `game_moves (game_id, sequence)` when two requests
 * for the same game race for the next move number — the loser simply recomputes
 * the sequence and retries once. This is not concurrency control, just integrity
 * handling for a rare multi-tab double-submit.
 */
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
  constructor(
    private readonly startingPageProvider: StartingPageProvider,
    private readonly wikipedia: WikipediaArticleSource,
  ) {}

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

  /**
   * Loads an owned game to open/resume it. For an IN_PROGRESS game this also
   * (re)establishes the effective-time interval: any pending interval is
   * finalized up to its last heartbeat and a fresh interval is started now.
   * This is the "normal game-loading/resume flow" — there is no separate
   * start/resume endpoint (docs/game-rules.md §12, docs/api.md §5.3).
   *
   * The resume write is conditional on the game still being IN_PROGRESS, so a
   * winning move (or a deletion) that commits between the read below and the
   * write cannot be clobbered: if the row no longer qualifies the update simply
   * matches nothing and the current authoritative state is returned as-is.
   */
  async get(userId: string, gameId: string): Promise<GameWithMoves> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
      include: { moves: { orderBy: { sequence: "asc" } } },
    });

    if (!game) {
      throw gameNotFound();
    }

    // A COMPLETED game is immutable — nothing to resume, return the read as-is.
    if (game.status !== "IN_PROGRESS") {
      return game;
    }

    await prisma.game.updateMany({
      where: { id: gameId, status: "IN_PROGRESS" },
      data: resumeIntervalData(game, new Date()),
    });

    // Re-read the authoritative state: normally the row we just resumed, or —
    // if a winning move / deletion raced us — the untouched current state.
    const current = await prisma.game.findFirst({
      where: { id: gameId, userId },
      include: { moves: { orderBy: { sequence: "asc" } } },
    });

    if (!current) {
      throw gameNotFound();
    }

    return current;
  }

  async getArticle(userId: string, gameId: string): Promise<ArticleDto> {
    const game = await this.loadOwnedGame(userId, gameId);
    const article = await this.wikipedia.getArticle(game.currentPageId);

    return {
      gameId: game.id,
      pageId: article.pageId,
      title: article.title,
      contentHtml: article.contentHtml,
      links: article.links.map((link) => ({
        pageId: link.pageId,
        title: link.title,
      })),
    };
  }

  /**
   * POST /api/games/:gameId/heartbeat — the only timing-specific endpoint.
   * Records that the owner is still actively playing by advancing
   * `lastHeartbeatAt`. It is not a session: no row is created, nothing else
   * changes. A completed game rejects the heartbeat.
   */
  async heartbeat(userId: string, gameId: string): Promise<void> {
    const game = await this.loadOwnedGame(userId, gameId);

    // Reject a heartbeat aimed at an already-completed game.
    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

    // Conditional write: if a winning move completed the game between the read
    // and here, this matches no row and the completed game keeps its cleared
    // timing fields.
    await prisma.game.updateMany({
      where: { id: gameId, status: "IN_PROGRESS" },
      data: activityData(game, new Date()),
    });
  }

  async move(
    userId: string,
    gameId: string,
    input: MoveInput,
  ): Promise<GameWithMoves> {
    const game = await this.loadOwnedGame(userId, gameId);

    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

    const links = await this.wikipedia.getValidInternalLinks(game.currentPageId);
    const destination = links.find((link) => link.pageId === input.toPageId);

    if (!destination) {
      throw invalidMove();
    }

    const fromPageId = game.currentPageId;
    const fromPageTitle = game.currentPageTitle;
    const isTarget = input.toPageId === TARGET_PAGE_ID;

    return withSequenceRetry(() =>
      prisma.$transaction(async (tx) => {
        // Captured inside the transaction: under connection-pool contention the
        // callback can start seconds after $transaction() is called, and both
        // the activity timestamp and any completion timing must reflect the
        // moment the work actually runs.
        const now = new Date();

        const current = await tx.game.findUniqueOrThrow({
          where: { id: gameId },
          select: { status: true, playStartedAt: true },
        });
        if (current.status !== "IN_PROGRESS") {
          throw gameNotInProgress();
        }

        // A normal move just refreshes the activity timestamp; the winning move
        // instead finalizes the interval and clears both timing fields
        // (`completionTimingData` sets `lastHeartbeatAt: null`).
        const timingData = isTarget
          ? {
              status: "COMPLETED" as const,
              completedAt: now,
              ...completionTimingData(current.playStartedAt, now),
            }
          : { lastHeartbeatAt: now };

        await tx.game.update({
          where: { id: gameId },
          data: {
            currentPageId: input.toPageId,
            currentPageTitle: destination.title,
            clickCount: { increment: 1 },
            ...timingData,
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
            toPageId: input.toPageId,
            toPageTitle: destination.title,
          },
        });

        return this.loadOwnedWithMoves(tx, gameId);
      }, TX_OPTIONS),
    );
  }

  async backtrack(
    userId: string,
    gameId: string,
    _input: BacktrackInput,
  ): Promise<GameWithMoves> {
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

    return withSequenceRetry(() =>
      prisma.$transaction(async (tx) => {
        const now = new Date();

        const state = await tx.game.findUniqueOrThrow({
          where: { id: gameId },
          select: { status: true },
        });
        if (state.status !== "IN_PROGRESS") {
          throw gameNotInProgress();
        }

        await tx.game.update({
          where: { id: gameId },
          data: {
            currentPageId: previous.pageId,
            currentPageTitle: previous.title,
            backtrackCount: { increment: 1 },
            lastHeartbeatAt: now,
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

        return this.loadOwnedWithMoves(tx, gameId);
      }, TX_OPTIONS),
    );
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
}
