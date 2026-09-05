import type {
  GameDifficulty,
  GameMode,
} from "../../generated/prisma/client.js";
import {
  asObject,
  parsePositiveIntParam,
  validationError,
} from "../../shared/validation.js";
import { isGameDifficulty, isGameMode } from "../games/games.validation.js";

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

export interface HistoryListQuery {
  mode?: GameMode;
  difficulty?: GameDifficulty;
  page: number;
  limit: number;
}

/** Query for GET /api/history: optional `mode` / `difficulty` filters + pagination. */
export function parseHistoryListQuery(query: unknown): HistoryListQuery {
  const q = asObject(query);

  const mode = parseOptionalMode(q.mode);
  const difficulty = parseOptionalDifficulty(q.difficulty);

  return {
    ...(mode ? { mode } : {}),
    ...(difficulty ? { difficulty } : {}),
    page: parsePositiveIntParam(q.page, "page", { fallback: PAGE_DEFAULT }),
    limit: parsePositiveIntParam(q.limit, "limit", {
      fallback: LIMIT_DEFAULT,
      max: LIMIT_MAX,
    }),
  };
}

function parseOptionalMode(value: unknown): GameMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isGameMode(value)) {
    return value;
  }
  throw validationError("mode must be one of CLICK, TIME");
}

function parseOptionalDifficulty(value: unknown): GameDifficulty | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (isGameDifficulty(value)) {
    return value;
  }
  throw validationError("difficulty must be one of EASY, MEDIUM, HARD");
}
