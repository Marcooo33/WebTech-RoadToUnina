/** Enum string values, uppercase, per docs/api.md §2.8. */
export type GameMode = 'CLICK' | 'TIME';
export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type GameStatus = 'IN_PROGRESS' | 'COMPLETED';
export type GameMoveType = 'NAVIGATION' | 'BACKTRACK';

/** A reference to a Wikipedia page on the active path (docs/api.md §3.3). */
export interface PageRef {
  pageId: number;
  title: string;
}

/** A single chronological game event (docs/api.md §3.4). */
export interface GameMoveDto {
  sequence: number;
  type: GameMoveType;
  fromPageId: number;
  fromPageTitle: string;
  toPageId: number;
  toPageTitle: string;
  createdAt: string;
}

/** Item in the current user's game list (docs/api.md §3.5). */
export interface GameListItemDto {
  id: string;
  mode: GameMode;
  difficulty: GameDifficulty;
  status: GameStatus;
  startPageTitle: string;
  currentPageId: number;
  currentPageTitle: string;
  clickCount: number;
  backtrackCount: number;
  effectivePlayTimeMs: number;
  startedAt: string;
  completedAt: string | null;
}

/** Full representation of an owned game, used to resume (docs/api.md §3.6). */
export interface GameDto {
  id: string;
  mode: GameMode;
  difficulty: GameDifficulty;
  status: GameStatus;
  startPageId: number;
  startPageTitle: string;
  currentPageId: number;
  currentPageTitle: string;
  clickCount: number;
  backtrackCount: number;
  /** Finalized effective play time (ms). Authoritative; the HUD only animates it. */
  effectivePlayTimeMs: number;
  /** Start of the current play interval for an in-progress game; `null` otherwise. */
  playStartedAt: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  path: PageRef[];
  moves: GameMoveDto[];
}
