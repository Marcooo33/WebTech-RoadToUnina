import { z } from "zod";

export const gameModeSchema = z.enum(["CLICK", "TIME"]);
export const gameDifficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export const gameStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED"]);

export const createGameSchema = z
  .object({
    mode: gameModeSchema,
    difficulty: gameDifficultySchema,
  })
  .strict();

export const listGamesQuerySchema = z.object({
  status: gameStatusSchema.optional(),
});

export const gameParamsSchema = z.object({
  gameId: z.string().uuid(),
});

const versionQuerySchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "version must be a non-negative integer")
  .transform((value) => Number(value))
  .refine(Number.isSafeInteger, {
    message: "version must be within JavaScript's safe integer range",
  });

export const deleteGameQuerySchema = z.object({
  version: versionQuerySchema,
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type ListGamesQuery = z.infer<typeof listGamesQuerySchema>;
export type GameParams = z.infer<typeof gameParamsSchema>;
export type DeleteGameQuery = z.infer<typeof deleteGameQuerySchema>;
