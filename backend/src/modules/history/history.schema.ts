import { z } from "zod";
import { gameDifficultySchema, gameModeSchema } from "../games/games.schema.js";

const HISTORY_PAGE_DEFAULT = 1;
const HISTORY_LIMIT_DEFAULT = 20;
const HISTORY_LIMIT_MAX = 100;

// Query strings, validated with the same strict pattern used by
// `versionQuerySchema` in games.schema.ts: only bare non-negative decimals,
// no leading zeros, no signs, no exponents or fractions.
const positiveIntQuerySchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, "must be a positive integer")
  .transform((value) => Number(value))
  .refine(Number.isSafeInteger, {
    message: "must be within JavaScript's safe integer range",
  });

export const historyListQuerySchema = z.object({
  mode: gameModeSchema.optional(),
  difficulty: gameDifficultySchema.optional(),
  page: positiveIntQuerySchema.optional().default(HISTORY_PAGE_DEFAULT),
  limit: positiveIntQuerySchema
    .refine((value) => value <= HISTORY_LIMIT_MAX, {
      message: `must not exceed ${HISTORY_LIMIT_MAX}`,
    })
    .optional()
    .default(HISTORY_LIMIT_DEFAULT),
});

export type HistoryListQuery = z.infer<typeof historyListQuerySchema>;
