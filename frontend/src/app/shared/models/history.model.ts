import { GameDifficulty, GameMode, GameMoveDto, PageRef } from './game.model';
import { UserSummaryDto } from './user.model';

/** Ranked item in a paginated public History view. */
export interface HistoryEntryDto {
  rank: number;
  gameId: string;
  username: string;
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: string;
}

/** Public detail of a completed game (docs/api.md §3.9). */
export interface CompletedGameDetailDto {
  gameId: string;
  mode: GameMode;
  difficulty: GameDifficulty;
  clickCount: number;
  backtrackCount: number;
  effectivePlayTimeMs: number;
  startPageId: number;
  startPageTitle: string;
  completedAt: string;
  path: PageRef[];
  moves: GameMoveDto[];
  player: UserSummaryDto | null;
}

/** Paginated public History view, ordered according to its mode. */
export interface HistoryListDto {
  mode: GameMode;
  difficulty: GameDifficulty;
  items: HistoryEntryDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Query parameters accepted by a mode-specific History collection endpoint. */
export interface HistoryListQuery {
  difficulty: GameDifficulty;
  page?: number;
  limit?: number;
}
