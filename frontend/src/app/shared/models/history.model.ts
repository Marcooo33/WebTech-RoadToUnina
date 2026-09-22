import { GameDifficulty, GameMode, GameMoveDto, PageRef } from './game.model';
import { UserSummaryDto } from './user.model';

export interface HistoryEntryDto {
  rank: number;
  gameId: string;
  username: string;
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: string;
}

// Full detail of one completed game, shown on the public history page.
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

// Paginated ranking for one mode/difficulty pair: sorted by clicks for CLICK,
// by effective time for TIME.
export interface HistoryListDto {
  mode: GameMode;
  difficulty: GameDifficulty;
  items: HistoryEntryDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HistoryListQuery {
  difficulty: GameDifficulty;
  page?: number;
  limit?: number;
}
