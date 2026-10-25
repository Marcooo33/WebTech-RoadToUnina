export type GameMode = 'CLICK' | 'TIME';
export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type GameStatus = 'IN_PROGRESS' | 'COMPLETED';
export type GameMoveType = 'NAVIGATION' | 'BACKTRACK';

export interface PageRef {
  pageId: number;
  title: string;
}

export interface GameMoveDto {
  sequence: number;
  type: GameMoveType;
  fromPageId: number;
  fromPageTitle: string;
  toPageId: number;
  toPageTitle: string;
  createdAt: string;
}

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

// Full game state, used to resume a game after a refresh.
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
  // Authoritative, server-computed; the HUD timer only animates from here.
  effectivePlayTimeMs: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  path: PageRef[];
  moves: GameMoveDto[];
}

export interface PreparedGameStateDto {
  game: GameDto;
  article: import('./article.model').ArticleDto | null;
}

export interface GuestGameSummary {
  game: GameListItemDto | null;
  revision: number | null;
  expiresAt: string | null;
}
export interface GuestGameState extends PreparedGameStateDto {
  revision: number;
  expiresAt: string;
}
