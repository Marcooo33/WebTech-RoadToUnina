import type { GameMoveDto, PageRefDto } from "../games/games.types.js";

// Public representation of a player: never carries email, passwordHash or
// any other credential/private field.
export interface UserSummaryDto {
  id: string;
  username: string;
}

export interface HistoryEntryDto {
  rank: number;
  gameId: string;
  username: string;
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: string;
}

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

export interface HistoryListDto {
  mode: "CLICK" | "TIME";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  items: HistoryEntryDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
