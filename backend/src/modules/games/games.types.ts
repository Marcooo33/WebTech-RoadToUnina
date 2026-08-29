import type { Game, GameMove } from "../../generated/prisma/client.js";

export interface PageRefDto {
  pageId: number;
  title: string;
}

export interface ArticleDto {
  gameId: string;
  pageId: number;
  title: string;
  version: number;
  contentHtml: string;
  links: PageRefDto[];
}

export type GameWithMoves = Game & { moves: GameMove[] };

export interface GameMoveDto {
  sequence: number;
  type: "NAVIGATION" | "BACKTRACK";
  fromPageId: number;
  fromPageTitle: string;
  toPageId: number;
  toPageTitle: string;
  createdAt: string;
}

export interface SessionDto {
  id: string;
  gameId: string;
  status: "ACTIVE" | "ENDED" | "EXPIRED";
  startedAt: string;
  endedAt: string | null;
  lastHeartbeatAt: string;
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
  version: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  path: PageRefDto[];
  moves: GameMoveDto[];
  activeSession: SessionDto | null;
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
  version: number;
  startedAt: string;
  completedAt: string | null;
  hasActiveSession: boolean;
}
