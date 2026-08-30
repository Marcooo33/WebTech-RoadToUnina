import { GameDifficulty, GameMode, GameMoveDto, PageRef } from './game.model';
import { UserSummaryDto } from './user.model';

/** Item in the public completed-game history list (docs/api.md §3.10). */
export interface CompletedGameSummaryDto {
  gameId: string;
  mode: GameMode;
  difficulty: GameDifficulty;
  clickCount: number;
  effectivePlayTimeMs: number;
  startPageTitle: string;
  completedAt: string;
  player: UserSummaryDto;
}

/** Public detail of a completed game (docs/api.md §3.11). */
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
  player: UserSummaryDto;
}

/** Paginated public history list envelope (docs/api.md §7.1.1). */
export interface HistoryListDto {
  items: CompletedGameSummaryDto[];
  page: number;
  limit: number;
  total: number;
}

/** Query parameters accepted by `GET /api/history` (docs/api.md §7.1.1). */
export interface HistoryListQuery {
  mode?: GameMode;
  difficulty?: GameDifficulty;
  page?: number;
  limit?: number;
}
