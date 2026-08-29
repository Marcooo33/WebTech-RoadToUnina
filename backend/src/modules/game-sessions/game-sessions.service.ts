import { SESSION_HEARTBEAT_TIMEOUT_MS } from "../../config/session.js";
import {
  Prisma,
  type Game,
  type GameSession,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import type { SessionDto, SessionResponseDto } from "../games/games.types.js";

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

export function noActiveSession(): ApiError {
  return new ApiError(
    409,
    ErrorCode.NO_ACTIVE_SESSION,
    "The game has no active play session",
  );
}

/**
 * Thrown from inside a gameplay transaction when the game's ACTIVE session is
 * found to have crossed the heartbeat timeout. The gameplay caller catches it,
 * finalizes the session in its own transaction (so the effective-time update
 * persists) and then rejects the gameplay action with NO_ACTIVE_SESSION, per
 * docs/api.md §9.3.
 */
export class SessionExpiredError extends Error {
  constructor(public readonly session: GameSession) {
    super("Play session expired");
    this.name = "SessionExpiredError";
  }
}

/**
 * Thrown from inside a gameplay transaction when the game's ACTIVE session has
 * disappeared since the caller's preliminary check — typically ended by a
 * concurrent completing move, which also bumps `Game.version`. The gameplay
 * caller catches it, classifies the conflict (STALE_VERSION /
 * GAME_NOT_IN_PROGRESS take precedence) and otherwise rejects with
 * NO_ACTIVE_SESSION.
 */
export class NoActiveSessionError extends Error {
  constructor() {
    super("No active play session");
    this.name = "NoActiveSessionError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export function toSessionDto(session: GameSession): SessionDto {
  return {
    id: session.id,
    gameId: session.gameId,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    lastHeartbeatAt: session.lastHeartbeatAt.toISOString(),
  };
}

type GameTiming = Pick<Game, "effectivePlayTimeMs" | "version">;

/**
 * Owns play-session lifecycle and the server-authoritative effective timer.
 *
 * Concurrency model:
 * - Every ACTIVE -> ENDED / ACTIVE -> EXPIRED transition is performed with a
 *   conditional `updateMany({ where: { id, status: "ACTIVE" } })` and only the
 *   request whose affected-row count is 1 accumulates that session's duration
 *   into `Game.effectivePlayTimeMs` and bumps `Game.version`. A session's
 *   duration can therefore never be counted twice.
 * - The one-ACTIVE-session-per-game rule is ultimately enforced by the
 *   `one_active_session_per_game` partial unique index; `P2002` is handled as a
 *   benign race (return the row the winner created).
 */
export class GameSessionService {
  isExpired(session: Pick<GameSession, "lastHeartbeatAt">, now: Date): boolean {
    return (
      now.getTime() - session.lastHeartbeatAt.getTime() >
      SESSION_HEARTBEAT_TIMEOUT_MS
    );
  }

  /** The game's ACTIVE session row (regardless of heartbeat staleness), or null. */
  private async findActiveSession(gameId: string): Promise<GameSession | null> {
    return prisma.gameSession.findFirst({ where: { gameId, status: "ACTIVE" } });
  }

  /**
   * The game's ACTIVE session only when it is still live (last heartbeat within
   * the timeout). Never mutates, so it is safe for GET handlers: a timed-out but
   * not-yet-finalized row reads as "no active session".
   */
  async getLiveActiveSession(
    gameId: string,
    now: Date = new Date(),
  ): Promise<GameSession | null> {
    const session = await this.findActiveSession(gameId);
    if (!session || this.isExpired(session, now)) {
      return null;
    }
    return session;
  }

  /**
   * Batched liveness lookup for the game list. Returns the set of game ids whose
   * ACTIVE session is still live. One query, no N+1.
   */
  async getGamesWithLiveActiveSession(
    gameIds: string[],
    now: Date = new Date(),
  ): Promise<Set<string>> {
    if (gameIds.length === 0) {
      return new Set();
    }

    const sessions = await prisma.gameSession.findMany({
      where: { gameId: { in: gameIds }, status: "ACTIVE" },
      select: { gameId: true, lastHeartbeatAt: true },
    });

    const live = new Set<string>();
    for (const session of sessions) {
      if (!this.isExpired(session, now)) {
        live.add(session.gameId);
      }
    }
    return live;
  }

  private async loadOwnedGame(userId: string, gameId: string): Promise<Game> {
    const game = await prisma.game.findFirst({ where: { id: gameId, userId } });
    if (!game) {
      throw gameNotFound();
    }
    return game;
  }

  private response(game: GameTiming, session: GameSession): SessionResponseDto {
    return {
      session: toSessionDto(session),
      effectivePlayTimeMs: game.effectivePlayTimeMs,
      gameVersion: game.version,
    };
  }

  private async gameTiming(gameId: string): Promise<GameTiming> {
    return prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      select: { effectivePlayTimeMs: true, version: true },
    });
  }

  /**
   * ACTIVE -> EXPIRED. Only the request that atomically flips the row adds the
   * bounded duration (`lastHeartbeatAt - startedAt`) to the game and bumps its
   * version. Idempotent and safe under concurrency.
   */
  async finalizeExpiredSession(sessionId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session || session.status !== "ACTIVE") {
        return;
      }

      const flipped = await tx.gameSession.updateMany({
        where: { id: sessionId, status: "ACTIVE" },
        data: { status: "EXPIRED", endedAt: session.lastHeartbeatAt },
      });
      if (flipped.count === 0) {
        return;
      }

      const durationMs = Math.max(
        0,
        session.lastHeartbeatAt.getTime() - session.startedAt.getTime(),
      );
      await tx.game.update({
        where: { id: session.gameId },
        data: {
          effectivePlayTimeMs: { increment: durationMs },
          version: { increment: 1 },
        },
      });
    }, TX_OPTIONS);
  }

  /**
   * POST /api/games/:gameId/session — idempotent start/resume.
   *
   * Live ACTIVE session -> returned unchanged (refresh, second tab and
   * cross-device hand-off all reuse it). Expired ACTIVE session -> finalized
   * first, then a fresh session is created. No ACTIVE session -> one is created.
   */
  async startOrResume(
    userId: string,
    gameId: string,
  ): Promise<SessionResponseDto> {
    const game = await this.loadOwnedGame(userId, gameId);
    if (game.status !== "IN_PROGRESS") {
      throw gameNotInProgress();
    }

    const existing = await this.findActiveSession(gameId);
    if (existing) {
      if (!this.isExpired(existing, new Date())) {
        return this.response(game, existing);
      }
      await this.finalizeExpiredSession(existing.id);
    }

    return this.createSession(gameId);
  }

  private async createSession(gameId: string): Promise<SessionResponseDto> {
    try {
      const session = await prisma.gameSession.create({ data: { gameId } });
      return this.response(await this.gameTiming(gameId), session);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Another request won the race to create the ACTIVE session (partial
        // unique index `one_active_session_per_game`). Return that one.
        const session = await this.findActiveSession(gameId);
        if (session) {
          return this.response(await this.gameTiming(gameId), session);
        }
      }
      throw error;
    }
  }

  /**
   * POST /api/games/:gameId/session/heartbeat.
   *
   * Updates only `lastHeartbeatAt` and only while the row is still ACTIVE; never
   * touches the `Game` row. A heartbeat that discovers the session already
   * exceeded the timeout finalizes it as EXPIRED and returns NO_ACTIVE_SESSION.
   */
  async heartbeat(userId: string, gameId: string): Promise<SessionResponseDto> {
    const game = await this.loadOwnedGame(userId, gameId);
    if (game.status !== "IN_PROGRESS") {
      throw noActiveSession();
    }

    const now = new Date();
    const session = await this.findActiveSession(gameId);
    if (!session) {
      throw noActiveSession();
    }
    if (this.isExpired(session, now)) {
      await this.finalizeExpiredSession(session.id);
      throw noActiveSession();
    }

    const updated = await prisma.gameSession.updateMany({
      where: { id: session.id, status: "ACTIVE" },
      data: { lastHeartbeatAt: now },
    });
    if (updated.count === 0) {
      // A concurrent end/expiry finalized the row between the read and here.
      throw noActiveSession();
    }

    // Heartbeat does not mutate the Game row, so its timing/version are unchanged.
    return this.response(game, { ...session, lastHeartbeatAt: now });
  }

  /**
   * POST /api/games/:gameId/session/end.
   *
   * Explicitly ends the live ACTIVE session, accumulating `now - startedAt` into
   * effective time and bumping `Game.version`. An already-expired session is
   * finalized as EXPIRED (using `lastHeartbeatAt`) and the call returns
   * NO_ACTIVE_SESSION.
   */
  async end(userId: string, gameId: string): Promise<SessionResponseDto> {
    const game = await this.loadOwnedGame(userId, gameId);
    if (game.status !== "IN_PROGRESS") {
      throw noActiveSession();
    }

    const now = new Date();
    const session = await this.findActiveSession(gameId);
    if (!session) {
      throw noActiveSession();
    }
    if (this.isExpired(session, now)) {
      await this.finalizeExpiredSession(session.id);
      throw noActiveSession();
    }

    return prisma.$transaction(async (tx) => {
      const flipped = await tx.gameSession.updateMany({
        where: { id: session.id, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: now },
      });
      if (flipped.count === 0) {
        // Lost a race to a concurrent end/expiry; that request accounted for it.
        throw noActiveSession();
      }

      const durationMs = Math.max(
        0,
        now.getTime() - session.startedAt.getTime(),
      );
      const timing = await tx.game.update({
        where: { id: gameId },
        data: {
          effectivePlayTimeMs: { increment: durationMs },
          version: { increment: 1 },
        },
        select: { effectivePlayTimeMs: true, version: true },
      });

      const ended = await tx.gameSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      return this.response(timing, ended);
    }, TX_OPTIONS);
  }

  // -------------------------------------------------------------------------
  // Helpers used by the gameplay engine (GamesService.move / .backtrack)
  // -------------------------------------------------------------------------

  /**
   * Preliminary gameplay session check (before expensive Wikipedia work).
   * Returns the live ACTIVE session. An expired session is finalized (time
   * accounted, version bumped) and the call rejects with NO_ACTIVE_SESSION; a
   * missing session rejects with NO_ACTIVE_SESSION. This is intentionally not
   * sufficient on its own — the caller re-validates inside its transaction.
   */
  async assertActiveForGameplay(gameId: string): Promise<GameSession> {
    const session = await this.findActiveSession(gameId);
    if (!session) {
      throw noActiveSession();
    }
    if (this.isExpired(session, new Date())) {
      await this.finalizeExpiredSession(session.id);
      throw noActiveSession();
    }
    return session;
  }

  /**
   * Rejection-path helper: if the game's ACTIVE session has already crossed the
   * heartbeat timeout, finalize it as EXPIRED (accounting its bounded duration
   * and bumping `Game.version`) so an expiry event is not lost when the gameplay
   * action is being rejected for another reason such as STALE_VERSION
   * (docs/api.md §9.3). No-op when there is no session or it is still live.
   */
  async finalizeIfExpired(gameId: string): Promise<void> {
    const session = await this.findActiveSession(gameId);
    if (session && this.isExpired(session, new Date())) {
      await this.finalizeExpiredSession(session.id);
    }
  }

  /**
   * Re-validates the session inside the gameplay transaction, immediately before
   * the authoritative game mutation. Takes a row lock on the ACTIVE session so a
   * concurrent end/expiry serializes behind this transaction.
   *
   * - no ACTIVE row            -> NoActiveSessionError (caller classifies, then rejects)
   * - ACTIVE but past timeout  -> SessionExpiredError (caller finalizes + rejects)
   */
  async requireActiveInTransaction(
    tx: Prisma.TransactionClient,
    gameId: string,
    now: Date,
  ): Promise<GameSession> {
    await tx.$queryRaw`SELECT "id" FROM "game_sessions" WHERE "game_id" = ${gameId}::uuid AND "status" = 'ACTIVE' FOR UPDATE`;

    const session = await tx.gameSession.findFirst({
      where: { gameId, status: "ACTIVE" },
    });
    if (!session) {
      throw new NoActiveSessionError();
    }
    if (this.isExpired(session, now)) {
      throw new SessionExpiredError(session);
    }
    return session;
  }

  /**
   * ACTIVE -> ENDED as part of a completing navigation's own transaction.
   * Returns the bounded duration the caller folds into the SAME
   * `game.updateMany` so completion stays a single `Game.version` increment.
   */
  async endSessionForCompletion(
    tx: Prisma.TransactionClient,
    session: GameSession,
    endedAt: Date,
  ): Promise<number> {
    const flipped = await tx.gameSession.updateMany({
      where: { id: session.id, status: "ACTIVE" },
      data: { status: "ENDED", endedAt },
    });
    if (flipped.count === 0) {
      // Lost the flip to a concurrent completing move / end, which also bumped
      // the version; the caller classifies this as a conflict.
      throw new NoActiveSessionError();
    }
    return Math.max(0, endedAt.getTime() - session.startedAt.getTime());
  }
}

export const gameSessionService = new GameSessionService();
