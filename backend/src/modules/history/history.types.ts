import type { GameMoveDto, PageRefDto } from "../games/games.types.js";

/**
 * Public representation of a player (docs/api.md §3.1). Never carries `email`,
 * `passwordHash` or any other credential/private field.
 */
export interface UserSummaryDto {
  id: string;
  username: string;
  avatarUrl: string | null;
}

/** Ranked item in a paginated public History view. */
export interface HistoryEntryDto {
  rank: number;
  gameId: string;
  username: string;
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: string;
}

/** Public detail of a completed game (docs/api.md §3.10). */
export interface CompletedGameDetailDto {
  gameId: string;
  mode: "CLICK" | "TIME";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  clickCount: number;
  backtrackCount: number;
  effectivePlayTimeMs: number;
  startPageId: number;
  startPageTitle: string;
  completedAt: string;
  path: PageRefDto[];
  moves: GameMoveDto[];
  player: UserSummaryDto | null;
}

/** Paginated public History view, ordered according to its mode. */
export interface HistoryListDto {
  mode: "CLICK" | "TIME";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  items: HistoryEntryDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
