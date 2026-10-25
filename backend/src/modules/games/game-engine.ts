import { TARGET_PAGE_ID } from "../../config/game.js";
import type { GameMove } from "../../generated/prisma/client.js";
import { ApiError, ErrorCode } from "../../shared/errors.js";
import type { WikipediaArticleSource } from "../wikipedia/wikipedia.types.js";
import { reconstructActivePath } from "./game-path.js";
import { toGameMoveDto } from "./game-move.js";
import type {
  ArticleDto,
  GameDto,
  GameListItemDto,
  GameState,
} from "./games.types.js";

export const MEDIUM_BACKTRACK_LIMIT = 3;

export async function prepareArticle(
  wikipedia: WikipediaArticleSource,
  gameId: string,
  pageId: number,
): Promise<ArticleDto> {
  const article = await wikipedia.getArticle(pageId);
  return {
    gameId,
    pageId: article.pageId,
    title: article.title,
    contentHtml: article.contentHtml,
    links: article.links.map((link) => ({ title: link.title })),
  };
}

export async function prepareNavigation(
  wikipedia: WikipediaArticleSource,
  game: GameState,
  toTitle: string,
) {
  const destination = await wikipedia.resolveNavigation(
    game.currentPageId,
    toTitle,
  );
  if (!destination)
    throw new ApiError(
      422,
      ErrorCode.INVALID_MOVE,
      "Target page is not a valid playable link",
    );
  const isTarget = destination.pageId === TARGET_PAGE_ID;
  const article = isTarget
    ? null
    : await prepareArticle(wikipedia, game.id, destination.pageId);
  return { destination, isTarget, article };
}

export async function prepareBacktrack(
  wikipedia: WikipediaArticleSource,
  game: GameState,
  moves: GameMove[],
) {
  if (game.difficulty === "HARD")
    throw new ApiError(
      422,
      ErrorCode.BACKTRACK_NOT_ALLOWED,
      "Backtracking is not allowed on HARD difficulty",
    );
  if (
    game.difficulty === "MEDIUM" &&
    game.backtrackCount >= MEDIUM_BACKTRACK_LIMIT
  )
    throw new ApiError(
      422,
      ErrorCode.BACKTRACK_LIMIT_REACHED,
      "Backtracking limit reached",
    );
  const path = reconstructActivePath(
    { pageId: game.startPageId, title: game.startPageTitle },
    moves,
  );
  if (path.length <= 1)
    throw new ApiError(
      422,
      ErrorCode.BACKTRACK_NOT_ALLOWED,
      "Cannot backtrack from the starting page",
    );
  const current = path[path.length - 1];
  const previous = path[path.length - 2];
  return {
    current,
    previous,
    article: await prepareArticle(wikipedia, game.id, previous.pageId),
  };
}

// Sample at transition application, after Wikipedia preparation, for either storage.
export function transitionTiming(
  game: GameState,
  arrivedAt: Date,
  committedAt: Date,
  completed: boolean,
) {
  return {
    elapsed: elapsedMs(game.playStartedAt, arrivedAt),
    playStartedAt: completed ? null : committedAt,
    ...(completed
      ? { status: "COMPLETED" as const, completedAt: committedAt }
      : {}),
  };
}

// Length of the current interval up to `until`; 0 while the game is paused.
export function elapsedMs(playStartedAt: Date | null, until: Date): number {
  if (!playStartedAt) {
    return 0;
  }
  return Math.max(0, until.getTime() - playStartedAt.getTime());
}

export function toGameDto(game: GameState, moves: GameMove[]): GameDto {
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

export function toGameListItemDto(game: GameState): GameListItemDto {
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
