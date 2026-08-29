import { TARGET_PAGE_ID } from "../../config/game.js";
import {
  Prisma,
  type Game,
  type GameMove,
  type GameSession,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import {
  GameSessionService,
  NoActiveSessionError,
  SessionExpiredError,
  noActiveSession,
  toSessionDto,
} from "../game-sessions/game-sessions.service.js";
import { WikipediaService } from "../wikipedia/wikipedia.service.js";
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
  GameMoveDto,
  GameWithMoves,
} from "./games.types.js";
import type { StartingPageProvider } from "./starting-page.provider.js";

export const MAX_IN_PROGRESS_GAMES = 10;
export const MEDIUM_BACKTRACK_LIMIT = 3;

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

function staleVersion(): ApiError {
  return new ApiError(409, ErrorCode.STALE_VERSION, "Stale version");
}

function invalidMove(): ApiError {
  return new ApiError(
    422,
    ErrorCode.INVALID_MOVE,
    "Target page is not a valid playable link",
  );
}

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

export function toGameDto(
  game: Game,
  moves: GameMove[],
  activeSession: GameSession | null,
): GameDto {
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
    version: game.version,
    startedAt: game.startedAt.toISOString(),
    completedAt: game.completedAt?.toISOString() ?? null,
    createdAt: game.createdAt.toISOString(),
    path,
    moves: moves.map(toGameMoveDto),
    activeSession: activeSession ? toSessionDto(activeSession) : null,
  };
}

export function toGameListItemDto(
  game: Game,
  hasActiveSession: boolean,
): GameListItemDto {
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
    hasActiveSession,
  };
}

export class GamesService {
  constructor(
    private readonly startingPageProvider: StartingPageProvider,
    private readonly wikipedia: WikipediaService,
    private readonly sessions: GameSessionService,
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

  async get(userId: string, gameId: string): Promise<GameWithMoves> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
      include: { moves: { orderBy: { sequence: "asc" } } },
    });

    if (!game) {
      throw gameNotFound();
    }

    return game;
  }

  async getArticle(userId: string, gameId: string): Promise<ArticleDto> {
    const game = await this.loadOwnedGame(userId, gameId);
    const article = await this.wikipedia.getArticle(game.currentPageId);

    return {
      gameId: game.id,
      pageId: article.pageId,
      title: article.title,
      version: game.version,
      contentHtml: article.contentHtml,
      links: article.links.map((link) => ({ pageId: link.pageId, title: link.title })),
    };
  }

  async move(
    userId: string,
    gameId: string,
    input: MoveInput,
  ): Promise<GameWithMoves> {
    const game = await this.loadOwnedGame(userId, gameId);

    if (input.version !== game.version) {
      // docs/api.md §9.3: an already-expired session is still finalized on the
      // rejection path, so effective play time stays fair even when the losing
      // request is also stale.
      await this.sessions.finalizeIfExpired(gameId);
      throw staleVersion();
    }

    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

    // Preliminary live-session check. An expired session is finalized here
    // (effective time + version) and the move is rejected with NO_ACTIVE_SESSION
    // (docs/api.md §9.3). This runs before Wikipedia work so difficulty/link
    // validation can never short-circuit expiration handling.
    await this.sessions.assertActiveForGameplay(gameId);

    const links = await this.wikipedia.getValidInternalLinks(game.currentPageId);
    const destination = links.find((link) => link.pageId === input.toPageId);

    if (!destination) {
      // The game may have changed while the links were being resolved; a
      // stale request must surface as a version conflict, not a rule error.
      await this.assertVersionUnchanged(userId, gameId, input.version);
      throw invalidMove();
    }

    const fromPageId = game.currentPageId;
    const fromPageTitle = game.currentPageTitle;
    const isTarget = input.toPageId === TARGET_PAGE_ID;

    try {
      return await prisma.$transaction(
        async (tx) => {
          // Captured inside the transaction: under connection-pool contention the
          // callback can start seconds after $transaction() is called, and the
          // expiry check, completedAt and the completion duration must all
          // reflect the moment the work actually runs.
          const now = new Date();

          // Re-validate the session inside the transaction, with a row lock, so
          // a session ended/expired since the preliminary check cannot be moved
          // against. SessionExpiredError is handled outside the transaction.
          const session = await this.sessions.requireActiveInTransaction(
            tx,
            gameId,
            now,
          );

          // On completion the still-active session is closed in this same
          // transaction and its duration folded into the one version bump.
          const completionDurationMs = isTarget
            ? await this.sessions.endSessionForCompletion(tx, session, now)
            : 0;

          const result = await tx.game.updateMany({
            where: {
              id: gameId,
              userId,
              status: "IN_PROGRESS",
              version: input.version,
            },
            data: {
              currentPageId: input.toPageId,
              currentPageTitle: destination.title,
              clickCount: { increment: 1 },
              version: { increment: 1 },
              ...(isTarget
                ? {
                    status: "COMPLETED" as const,
                    completedAt: now,
                    effectivePlayTimeMs: { increment: completionDurationMs },
                  }
                : {}),
            },
          });

          if (result.count === 0) {
            await this.classifyConflict(tx, userId, gameId, input.version);
          }

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
        },
        { maxWait: 10_000, timeout: 30_000 },
      );
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await this.sessions.finalizeExpiredSession(error.session.id);
        throw noActiveSession();
      }
      if (error instanceof NoActiveSessionError) {
        // The session vanished mid-transaction — typically ended by a concurrent
        // completing move, which also bumped the version. A stale version or a
        // now-completed game takes precedence over NO_ACTIVE_SESSION.
        await this.assertNoGameConflict(prisma, userId, gameId, input.version);
        throw noActiveSession();
      }
      throw error;
    }
  }

  async backtrack(
    userId: string,
    gameId: string,
    input: BacktrackInput,
  ): Promise<GameWithMoves> {
    const game = await this.loadOwnedGame(userId, gameId);

    if (input.version !== game.version) {
      // docs/api.md §9.3: an already-expired session is still finalized on the
      // rejection path, so effective play time stays fair even when the losing
      // request is also stale.
      await this.sessions.finalizeIfExpired(gameId);
      throw staleVersion();
    }

    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

    // Session precondition is checked before the difficulty/path rules so an
    // expired session is finalized and rejected (docs/api.md §9.3) rather than
    // being masked by a BACKTRACK_NOT_ALLOWED / BACKTRACK_LIMIT_REACHED error.
    await this.sessions.assertActiveForGameplay(gameId);

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
      await this.assertVersionUnchanged(userId, gameId, input.version);
      throw new ApiError(
        422,
        ErrorCode.BACKTRACK_NOT_ALLOWED,
        "Cannot backtrack from the starting page",
      );
    }

    const current = path[path.length - 1];
    const previous = path[path.length - 2];

    try {
      return await prisma.$transaction(
        async (tx) => {
          // Captured inside the transaction so an expiry that occurs while the
          // callback is queued under pool contention is still detected.
          const now = new Date();
          await this.sessions.requireActiveInTransaction(tx, gameId, now);

          const result = await tx.game.updateMany({
            where: {
              id: gameId,
              userId,
              status: "IN_PROGRESS",
              version: input.version,
            },
            data: {
              currentPageId: previous.pageId,
              currentPageTitle: previous.title,
              backtrackCount: { increment: 1 },
              version: { increment: 1 },
            },
          });

          if (result.count === 0) {
            await this.classifyConflict(tx, userId, gameId, input.version);
          }

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
        },
        { maxWait: 10_000, timeout: 30_000 },
      );
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await this.sessions.finalizeExpiredSession(error.session.id);
        throw noActiveSession();
      }
      if (error instanceof NoActiveSessionError) {
        // The session vanished mid-transaction — typically ended by a concurrent
        // completing move, which also bumped the version. A stale version or a
        // now-completed game takes precedence over NO_ACTIVE_SESSION.
        await this.assertNoGameConflict(prisma, userId, gameId, input.version);
        throw noActiveSession();
      }
      throw error;
    }
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

    if (game.version !== version) {
      throw staleVersion();
    }

    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

    throw staleVersion();
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

  // Re-checks the persisted version after asynchronous Wikipedia/article work.
  // A request whose version changed while resolving the article must surface as
  // STALE_VERSION rather than a later gameplay rule error.
  private async assertVersionUnchanged(
    userId: string,
    gameId: string,
    expectedVersion: number,
  ): Promise<void> {
    const game = await prisma.game.findFirst({
      where: { id: gameId, userId },
      select: { version: true },
    });

    if (!game) {
      throw gameNotFound();
    }

    if (game.version !== expectedVersion) {
      throw staleVersion();
    }
  }

  // Throws the conflict that explains why an optimistic gameplay write matched
  // no row. A stale version takes precedence over status so a request that loses
  // a race against a completing move is reported as STALE_VERSION, not
  // GAME_NOT_IN_PROGRESS. Returns normally only when version and status still
  // look current. Accepts either a transaction client or the base `prisma`
  // client so it can also be used after a rolled-back transaction.
  private async assertNoGameConflict(
    db: Prisma.TransactionClient,
    userId: string,
    gameId: string,
    expectedVersion: number,
  ): Promise<void> {
    const game = await db.game.findFirst({
      where: { id: gameId, userId },
      select: { status: true, version: true },
    });

    if (!game) {
      throw gameNotFound();
    }

    if (game.version !== expectedVersion) {
      throw staleVersion();
    }

    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }
  }

  private async classifyConflict(
    tx: Prisma.TransactionClient,
    userId: string,
    gameId: string,
    expectedVersion: number,
  ): Promise<never> {
    await this.assertNoGameConflict(tx, userId, gameId, expectedVersion);
    // Nothing obviously wrong — treat as a narrowly-lost optimistic-lock race.
    throw staleVersion();
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
