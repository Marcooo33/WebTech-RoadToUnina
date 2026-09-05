import type { GameDifficulty } from "../../generated/prisma/client.js";
import {
  asObject,
  parsePositiveIntParam,
  validationError,
} from "../../shared/validation.js";
import { isGameDifficulty } from "../games/games.validation.js";

const LIMIT_DEFAULT = 10;
const LIMIT_MAX = 100;

export interface LeaderboardQuery {
  difficulty: GameDifficulty;
  limit: number;
}

/**
 * Query for GET /api/leaderboards/{click,time}. `difficulty` is required
 * (docs/api.md §7.2): a missing or invalid one is a 400.
 */
export function parseLeaderboardQuery(query: unknown): LeaderboardQuery {
  const q = asObject(query);

  if (!isGameDifficulty(q.difficulty)) {
    throw validationError("difficulty must be one of EASY, MEDIUM, HARD");
  }

  return {
    difficulty: q.difficulty,
    limit: parsePositiveIntParam(q.limit, "limit", {
      fallback: LIMIT_DEFAULT,
      max: LIMIT_MAX,
    }),
  };
}
