import { GameDifficulty } from './game.model';

export interface BestResultDto {
  gameId: string;
  difficulty: GameDifficulty;
  clickCount: number;
  effectivePlayTimeMs: number;
  completedAt: string;
}

export interface StatisticsDto {
  completedGames: number;
  inProgressGames: number;
  bestClick: BestResultDto | null;
  bestTime: BestResultDto | null;
  averageClicks: number | null;
  averageEffectiveTimeMs: number | null;
}
