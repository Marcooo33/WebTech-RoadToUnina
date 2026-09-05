import type {
  GameDifficulty,
  GameMode,
} from "../../generated/prisma/client.js";
import {
  asObject,
  isUuid,
  rejectUnknownKeys,
  validationError,
} from "../../shared/validation.js";

const GAME_MODES = ["CLICK", "TIME"] as const;
const GAME_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const GAME_STATUS_FILTERS = ["IN_PROGRESS", "COMPLETED"] as const;

export type GameStatusFilter = (typeof GAME_STATUS_FILTERS)[number];

export function isGameMode(value: unknown): value is GameMode {
  return (
    typeof value === "string" && (GAME_MODES as readonly string[]).includes(value)
  );
}

export function isGameDifficulty(value: unknown): value is GameDifficulty {
  return (
    typeof value === "string" &&
    (GAME_DIFFICULTIES as readonly string[]).includes(value)
  );
}

export interface CreateGameInput {
  mode: GameMode;
  difficulty: GameDifficulty;
}

export interface MoveInput {
  toPageId: number;
}

/** Route param `:gameId` — a UUID (the `games.id` column type). */
export function parseGameId(value: unknown): string {
  if (!isUuid(value)) {
    throw validationError("Invalid game id");
  }

  return value;
}

/** POST /api/games body. Only `mode` and `difficulty` are client-supplied. */
export function parseCreateGameInput(body: unknown): CreateGameInput {
  const obj = asObject(body, "Invalid game creation request");
  rejectUnknownKeys(
    obj,
    ["mode", "difficulty"],
    "Invalid game creation request",
  );

  if (!isGameMode(obj.mode)) {
    throw validationError("mode must be one of CLICK, TIME");
  }

  if (!isGameDifficulty(obj.difficulty)) {
    throw validationError("difficulty must be one of EASY, MEDIUM, HARD");
  }

  return { mode: obj.mode, difficulty: obj.difficulty };
}

/** Optional `?status=` filter on GET /api/games. */
export function parseGameStatusFilter(
  value: unknown,
): GameStatusFilter | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "IN_PROGRESS" || value === "COMPLETED") {
    return value;
  }

  throw validationError("status must be one of IN_PROGRESS, COMPLETED");
}

/** POST /api/games/:gameId/moves body. */
export function parseMoveInput(body: unknown): MoveInput {
  const obj = asObject(body, "Invalid move request");
  rejectUnknownKeys(obj, ["toPageId"], "Invalid move request");

  const { toPageId } = obj;

  // Number.isSafeInteger already rejects non-numbers, NaN, fractions and values
  // outside the safe-integer range.
  if (typeof toPageId !== "number" || !Number.isSafeInteger(toPageId) || toPageId <= 0) {
    throw validationError("toPageId must be a positive integer");
  }

  return { toPageId };
}
