import type {
  GameDifficulty,
} from "../../generated/prisma/client.js";
import {
  asObject,
  parsePositiveIntParam,
  validationError,
} from "../../shared/validation.js";
import { isGameDifficulty } from "../games/games.validation.js";

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

export interface HistoryQuery {
  difficulty: GameDifficulty;
  page: number;
  limit: number;
}

/** Query for GET /api/history/{click,time}: required difficulty + pagination. */
export function parseHistoryQuery(query: unknown): HistoryQuery {
  const q = asObject(query);

  if (!isGameDifficulty(q.difficulty)) {
    throw validationError("difficulty must be one of EASY, MEDIUM, HARD");
  }

  return {
    difficulty: q.difficulty,
    page: parsePositiveIntParam(q.page, "page", { fallback: PAGE_DEFAULT }),
    limit: parsePositiveIntParam(q.limit, "limit", {
      fallback: LIMIT_DEFAULT,
      max: LIMIT_MAX,
    }),
  };
}
