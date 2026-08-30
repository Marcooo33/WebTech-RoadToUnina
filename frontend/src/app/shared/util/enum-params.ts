import { GameDifficulty, GameMode } from '../models/game.model';

/**
 * Safe parsing of enum-valued query parameters shared by the public history and
 * leaderboard screens. Unknown/missing values return `null` so callers can fall
 * back to a valid default instead of forwarding junk to the API (docs/api.md §2.8,
 * validation is case-sensitive).
 */

const MODES: readonly GameMode[] = ['CLICK', 'TIME'];
const DIFFICULTIES: readonly GameDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export function parseMode(value: string | null | undefined): GameMode | null {
  return MODES.includes(value as GameMode) ? (value as GameMode) : null;
}

export function parseDifficulty(value: string | null | undefined): GameDifficulty | null {
  return DIFFICULTIES.includes(value as GameDifficulty) ? (value as GameDifficulty) : null;
}

/** Upper bound so a hand-crafted `?page=` can never forward an absurd number to
 *  the API. Well beyond any realistic completed-game history. */
const MAX_PAGE = 100_000;

/**
 * Parses a 1-based page parameter. Only a plain run of digits is accepted;
 * scientific notation (`1e3`), decimals, signs and blanks all fall back to page
 * 1, and the result is capped at {@link MAX_PAGE}.
 */
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
