import { z } from "zod";
import { gameDifficultySchema } from "../games/games.schema.js";

const LEADERBOARD_LIMIT_DEFAULT = 10;
const LEADERBOARD_LIMIT_MAX = 100;

// Same strict query-string pattern used by history.schema.ts: bare positive
// decimals only, no leading zeros, signs, exponents or fractions.
const positiveIntQuerySchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, "must be a positive integer")
  .transform((value) => Number(value))
  .refine(Number.isSafeInteger, {
    message: "must be within JavaScript's safe integer range",
  });

export const leaderboardQuerySchema = z.object({
  // Required (docs/api.md §7.2): a missing/invalid difficulty is 400.
  difficulty: gameDifficultySchema,
  limit: positiveIntQuerySchema
    .refine((value) => value <= LEADERBOARD_LIMIT_MAX, {
      message: `must not exceed ${LEADERBOARD_LIMIT_MAX}`,
    })
    .optional()
    .default(LEADERBOARD_LIMIT_DEFAULT),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
