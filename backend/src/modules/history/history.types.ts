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

/** Item in the public completed-game history list (docs/api.md §3.10). */
export interface CompletedGameSummaryDto {
  gameId: string;
  mode: "CLICK" | "TIME";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  clickCount: number;
  effectivePlayTimeMs: number;
  startPageTitle: string;
  completedAt: string;
  player: UserSummaryDto;
}

/** Public detail of a completed game (docs/api.md §3.11). */
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
  player: UserSummaryDto;
}

/** Paginated public history list envelope (docs/api.md §2.7 / §7.1.1). */
export interface HistoryListDto {
  items: CompletedGameSummaryDto[];
  page: number;
  limit: number;
  total: number;
}
