import { GameDifficulty, GameMode } from '../models/game.model';

// Safe parsing of enum-valued query params used by public History. Unknown or
// missing values return null so callers fall back to a valid default instead
// of forwarding junk to the API. Matching is case-sensitive.

const MODES: readonly GameMode[] = ['CLICK', 'TIME'];
const DIFFICULTIES: readonly GameDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export function parseMode(value: string | null | undefined): GameMode | null {
  return MODES.includes(value as GameMode) ? (value as GameMode) : null;
}

export function parseDifficulty(value: string | null | undefined): GameDifficulty | null {
  return DIFFICULTIES.includes(value as GameDifficulty) ? (value as GameDifficulty) : null;
}

// Well beyond any realistic completed-game history, just to cap absurd values.
const MAX_PAGE = 100_000;

// Only a plain run of digits is accepted: scientific notation, decimals,
// signs and blanks all fall back to page 1.
export function parsePage(value: string | null | undefined): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return 1;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return 1;
  }
  return Math.min(n, MAX_PAGE);
}
