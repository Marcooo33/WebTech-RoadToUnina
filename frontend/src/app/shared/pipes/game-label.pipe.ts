import { Pipe, PipeTransform } from '@angular/core';
import { GameDifficulty, GameMode, GameMoveType, GameStatus } from '../models/game.model';

export const GAME_LABELS: Record<GameMode | GameDifficulty | GameStatus | GameMoveType, string> = {
  CLICK: 'Click',
  TIME: 'Tempo',
  EASY: 'Facile',
  MEDIUM: 'Media',
  HARD: 'Difficile',
  IN_PROGRESS: 'In corso',
  COMPLETED: 'Completata',
  NAVIGATION: 'Navigazione',
  BACKTRACK: 'Ritorno indietro',
};

@Pipe({ name: 'gameLabel' })
export class GameLabelPipe implements PipeTransform {
  transform(value: keyof typeof GAME_LABELS): string {
    return GAME_LABELS[value];
  }
}
