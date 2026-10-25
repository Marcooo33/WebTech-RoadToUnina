import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  GameWithMoves,
  GuestGameState,
  GuestGameSummary,
} from "../games/games.types.js";
import {
  elapsedMs,
  prepareArticle,
  prepareBacktrack,
  prepareNavigation,
  toGameDto,
  toGameListItemDto,
  transitionTiming,
} from "../games/game-engine.js";
import type { WikipediaArticleSource } from "../wikipedia/wikipedia.types.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";

export const GUEST_TTL_MS = 24 * 60 * 60_000;
export const MAX_GUEST_ENTRIES = 500;
export const MAX_GUEST_MOVES = 1000;
export const GUEST_REQUEST_LIMIT = 120;
export const GUEST_REQUEST_WINDOW_MS = 60_000;
interface Entry {
  game: GameWithMoves | null;
  revision: number;
  lastActivityAt: number;
  busy: boolean;
  requests?: { count: number; until: number };
  receipt?: { gameId: string; userId: string };
}
export type ClaimWriter = (
  game: GameWithMoves,
  userId: string,
) => Promise<void>;
const missing = () =>
  new ApiError(
    404,
    ErrorCode.GAME_NOT_FOUND,
    "Your guest game expired or is no longer available.",
  );
const changed = () =>
  new ApiError(
    409,
    ErrorCode.GUEST_GAME_CHANGED,
    "The guest game changed in another tab. Reload and try again.",
  );

// One process-local store. No persistence is consulted until a completed game is claimed.
export class GuestGamesService {
  private readonly entries = new Map<string, Entry>();
  private readonly creationAttempts = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(
    private readonly wikipedia: WikipediaArticleSource,
    private readonly writeClaim: ClaimWriter,
    private readonly now = () => new Date(),
    private readonly capacity = MAX_GUEST_ENTRIES,
  ) {}

  static newToken(): string {
    return randomBytes(32).toString("hex");
  }
  private key(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
  private entry(token: string): Entry | undefined {
    const key = this.key(token);
    const entry = this.entries.get(key);
    if (
      entry &&
      !entry.busy &&
      this.now().getTime() - entry.lastActivityAt >= GUEST_TTL_MS
    ) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }
  cleanup(): void {
    for (const [key, entry] of this.entries) {
      if (
        !entry.busy &&
        this.now().getTime() - entry.lastActivityAt >= GUEST_TTL_MS
      )
        this.entries.delete(key);
    }
    for (const [ip, attempt] of this.creationAttempts)
      if (attempt.until <= this.now().getTime())
        this.creationAttempts.delete(ip);
  }
  throttle(ip: string): void {
    this.cleanup();
    let attempt = this.creationAttempts.get(ip);
    if (!attempt) {
      if (this.creationAttempts.size >= 1000)
        this.creationAttempts.delete(
          this.creationAttempts.keys().next().value!,
        );
      attempt = { count: 0, until: this.now().getTime() + 10 * 60_000 };
      this.creationAttempts.set(ip, attempt);
    }
    if (++attempt.count > 10)
      throw new ApiError(
        429,
        ErrorCode.GUEST_RATE_LIMITED,
        "Too many guest game starts. Try again in ten minutes.",
      );
  }
  expiresAt(token: string): string | null {
    const entry = this.entry(token);
    return entry
      ? new Date(entry.lastActivityAt + GUEST_TTL_MS).toISOString()
      : null;
  }
  summary(token: string): GuestGameSummary {
    const entry = this.entry(token);
    if (entry?.busy)
      throw new ApiError(
        409,
        ErrorCode.GUEST_GAME_BUSY,
        "A guest operation is still in progress. Please retry.",
      );
    return {
      game: entry?.game ? toGameListItemDto(entry.game) : null,
      revision: entry?.game ? entry.revision : null,
      expiresAt: entry?.game ? this.expiresAt(token) : null,
    };
  }
  private touch(entry: Entry): void {
    entry.lastActivityAt = this.now().getTime();
  }
  private state(
    entry: Entry,
    article: GuestGameState["article"] = null,
  ): GuestGameState {
    return {
      game: toGameDto(entry.game!, entry.game!.moves),
      article,
      revision: entry.revision,
      expiresAt: new Date(entry.lastActivityAt + GUEST_TTL_MS).toISOString(),
    };
  }
  private async locked<T>(
    token: string,
    gameId: string,
    revision: number | undefined,
    action: (entry: Entry) => Promise<T>,
    gameplay = true,
  ): Promise<T> {
    const entry = this.entry(token);
    if (
      !entry ||
      (entry.game?.id !== gameId && entry.receipt?.gameId !== gameId)
    )
      throw missing();
    if (gameplay) {
      const now = this.now().getTime();
      if (!entry.requests || entry.requests.until <= now)
        entry.requests = { count: 0, until: now + GUEST_REQUEST_WINDOW_MS };
      if (++entry.requests.count > GUEST_REQUEST_LIMIT)
        throw new ApiError(
          429,
          ErrorCode.GUEST_RATE_LIMITED,
          "Too many guest gameplay requests. Please retry in one minute.",
        );
    }
    if (entry.busy)
      throw new ApiError(
        409,
        ErrorCode.GUEST_GAME_BUSY,
        "Another guest operation is in progress. Please try again.",
      );
    if (revision !== undefined && revision !== entry.revision) throw changed();
    entry.busy = true;
    try {
      return await action(entry);
    } finally {
      entry.busy = false;
    }
  }
  private inProgress(entry: Entry): GameWithMoves {
    if (!entry.game || entry.game.status !== "IN_PROGRESS")
      throw new ApiError(
        409,
        ErrorCode.GAME_NOT_IN_PROGRESS,
        "Game is not in progress",
      );
    return entry.game;
  }
  async create(
    token: string,
    replacement?: { gameId: string; revision: number },
  ): Promise<GuestGameState> {
    let entry = this.entry(token);
    if (entry?.busy)
      throw new ApiError(
        409,
        ErrorCode.GUEST_GAME_BUSY,
        "Another guest operation is in progress.",
      );
    if (entry?.game && !replacement)
      throw new ApiError(
        409,
        ErrorCode.GUEST_GAME_EXISTS,
        "Resume your guest game or confirm starting a new one.",
      );
    if (
      replacement &&
      (entry?.game?.id !== replacement.gameId ||
        entry.revision !== replacement.revision)
    )
      throw changed();
    const isNew = !entry;
    if (!entry) {
      this.cleanup();
      if (this.entries.size >= this.capacity)
        throw new ApiError(
          503,
          ErrorCode.GUEST_CAPACITY_REACHED,
          "Guest games are temporarily full. Please try again later.",
        );
      // Synchronous insertion also prevents concurrent starts for the same identity.
      entry = {
        game: null,
        revision: 0,
        lastActivityAt: this.now().getTime(),
        busy: false,
      };
      this.entries.set(this.key(token), entry);
    }
    entry.busy = true;
    try {
      const start = await this.wikipedia.getStartingPage();
      const now = this.now();
      entry.game = {
        id: randomUUID(),
        mode: "CLICK",
        difficulty: "EASY",
        status: "IN_PROGRESS",
        startPageId: start.pageId,
        startPageTitle: start.title,
        currentPageId: start.pageId,
        currentPageTitle: start.title,
        clickCount: 0,
        backtrackCount: 0,
        effectivePlayTimeMs: 0,
        playStartedAt: null,
        startedAt: now,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        moves: [],
      };
      entry.receipt = undefined;
      entry.revision++;
      this.touch(entry);
      return this.state(entry);
    } catch (error) {
      if (isNew) this.entries.delete(this.key(token));
      throw error;
    } finally {
      entry.busy = false;
    }
  }
  async get(
    token: string,
    gameId: string,
    authenticated = false,
  ): Promise<GuestGameState> {
    return this.locked(token, gameId, undefined, async (entry) => {
      const game = entry.game;
      if (!game) throw missing();
      if (authenticated && game.status === "IN_PROGRESS")
        throw new ApiError(
          403,
          ErrorCode.GUEST_PLAY_REQUIRES_ANONYMOUS,
          "Log out to play as a guest. Your game has not been changed.",
        );
      this.touch(entry);
      const article =
        game.status === "IN_PROGRESS"
          ? await prepareArticle(this.wikipedia, game.id, game.currentPageId)
          : null;
      if (article) {
        game.playStartedAt = this.now();
        game.updatedAt = this.now();
        entry.revision++;
      }
      return this.state(entry, article);
    });
  }
  async article(token: string, gameId: string) {
    return this.locked(token, gameId, undefined, async (entry) => {
      if (!entry.game) throw missing();
      return prepareArticle(this.wikipedia, gameId, entry.game.currentPageId);
    });
  }
  async move(
    token: string,
    gameId: string,
    revision: number,
    toTitle?: string,
  ): Promise<GuestGameState> {
    const arrivedAt = this.now();
    return this.locked(token, gameId, revision, async (entry) => {
      const game = this.inProgress(entry);
      if (game.moves.length >= MAX_GUEST_MOVES)
        throw new ApiError(
          409,
          ErrorCode.GUEST_MOVE_LIMIT_REACHED,
          "This guest game reached its 1000-move limit. Start a new game to play again.",
        );
      // Touch only accepted actions; invalid moves must not renew inactivity.
      const prepared =
        toTitle !== undefined
          ? await prepareNavigation(this.wikipedia, game, toTitle)
          : await prepareBacktrack(this.wikipedia, game, game.moves);
      const destination =
        "destination" in prepared ? prepared.destination : prepared.previous;
      const completed = "isTarget" in prepared && prepared.isTarget;
      const now = this.now();
      const timing = transitionTiming(game, arrivedAt, now, completed);
      const move = {
        id: randomUUID(),
        gameId,
        sequence: game.moves.length + 1,
        type:
          toTitle !== undefined
            ? ("NAVIGATION" as const)
            : ("BACKTRACK" as const),
        fromPageId: game.currentPageId,
        fromPageTitle: game.currentPageTitle,
        toPageId: destination.pageId,
        toPageTitle: destination.title,
        createdAt: now,
      };
      game.currentPageId = destination.pageId;
      game.currentPageTitle = destination.title;
      game.clickCount += toTitle !== undefined ? 1 : 0;
      game.backtrackCount += toTitle === undefined ? 1 : 0;
      game.effectivePlayTimeMs += timing.elapsed;
      game.playStartedAt = timing.playStartedAt;
      if (completed) {
        game.status = "COMPLETED";
        game.completedAt = now;
      }
      game.updatedAt = now;
      game.moves.push(move);
      entry.revision++;
      this.touch(entry);
      return this.state(entry, prepared.article);
    });
  }
  async pause(token: string, gameId: string, revision: number): Promise<void> {
    return this.locked(token, gameId, revision, async (entry) => {
      const game = this.inProgress(entry);
      if (!game.playStartedAt) return;
      game.effectivePlayTimeMs += elapsedMs(game.playStartedAt, this.now());
      game.playStartedAt = null;
      game.updatedAt = this.now();
      entry.revision++;
      this.touch(entry);
    });
  }
  async discard(
    token: string,
    gameId: string,
    revision: number,
    unfinishedOnly = false,
  ): Promise<void> {
    return this.locked(
      token,
      gameId,
      revision,
      async (entry) => {
        if (unfinishedOnly && entry.game?.status !== "IN_PROGRESS")
          throw changed();
        this.entries.delete(this.key(token));
      },
      false,
    );
  }
  async claim(
    token: string,
    gameId: string,
    userId: string,
  ): Promise<{ gameId: string; status: "COMPLETED"; replay: boolean }> {
    return this.locked(
      token,
      gameId,
      undefined,
      async (entry) => {
        if (entry.receipt) {
          if (entry.receipt.userId !== userId)
            throw new ApiError(
              409,
              ErrorCode.GUEST_GAME_ALREADY_CLAIMED,
              "This result was already saved to another account.",
            );
          return { gameId, status: "COMPLETED", replay: true };
        }
        if (!entry.game || entry.game.status !== "COMPLETED")
          throw new ApiError(
            409,
            ErrorCode.GUEST_GAME_NOT_COMPLETED,
            "Only completed guest games can be saved.",
          );
        this.touch(entry);
        try {
          await this.writeClaim(entry.game, userId);
        } catch (error) {
          console.error(
            "Guest claim failed",
            error instanceof Error ? error.message : "database error",
          );
          throw new ApiError(
            503,
            ErrorCode.GUEST_CLAIM_FAILED,
            "You are logged in, but your guest result has not been saved. Please retry.",
          );
        }
        entry.receipt = { gameId, userId };
        entry.game = null;
        return { gameId, status: "COMPLETED", replay: false };
      },
      false,
    );
  }
}
