import { GameDifficulty, GameMode } from './game.model';

/** A single ranking row (docs/api.md §3.12). */
export interface LeaderboardEntryDto {
  rank: number;
  gameId: string;
  username: string;
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: string;
}

/** Leaderboard response envelope (docs/api.md §7.2). */
export interface LeaderboardDto {
  mode: GameMode;
  difficulty: GameDifficulty;
  items: LeaderboardEntryDto[];
}
