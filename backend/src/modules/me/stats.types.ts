/** Best completed result in one mode (docs/api.md §3.13). `null` when the user
 * has no completed games in that mode. */
export interface BestResultDto {
  gameId: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: string;
}

/** Personal statistics derived from the current user's games (docs/api.md §3.13). */
export interface StatisticsDto {
  completedGames: number;
  inProgressGames: number;
  bestClick: BestResultDto | null;
  bestTime: BestResultDto | null;
  averageClicks: number | null;
  averageEffectiveTimeMs: number | null;
}
