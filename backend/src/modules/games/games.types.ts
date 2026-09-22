import type { Game, GameMove } from "../../generated/prisma/client.js";

export interface PageRefDto {
  pageId: number;
  title: string;
}

export interface ArticleDto {
  gameId: string;
  pageId: number;
  title: string;
  contentHtml: string;
  links: { title: string }[];
}

export type GameWithMoves = Game & { moves: GameMove[] };

export interface PreparedGameState {
  game: GameWithMoves;
  article: ArticleDto | null;
}

export interface GameMoveDto {
  sequence: number;
  type: "NAVIGATION" | "BACKTRACK";
  fromPageId: number;
  fromPageTitle: string;
  toPageId: number;
  toPageTitle: string;
  createdAt: string;
}

export interface GameDto {
  id: string;
  mode: "CLICK" | "TIME";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  status: "IN_PROGRESS" | "COMPLETED";
  startPageId: number;
  startPageTitle: string;
  currentPageId: number;
  currentPageTitle: string;
  clickCount: number;
  backtrackCount: number;
  effectivePlayTimeMs: number;
  // Start of the current play interval; null when the game isn't IN_PROGRESS.
  playStartedAt: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  path: PageRefDto[];
  moves: GameMoveDto[];
}

export interface GameListItemDto {
  id: string;
  mode: "CLICK" | "TIME";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  status: "IN_PROGRESS" | "COMPLETED";
  startPageTitle: string;
  currentPageId: number;
  currentPageTitle: string;
  clickCount: number;
  backtrackCount: number;
  effectivePlayTimeMs: number;
  startedAt: string;
  completedAt: string | null;
}
