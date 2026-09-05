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

const pageIdSchema = z
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger, {
    message: "page id must be within JavaScript's safe integer range",
  });

export const moveSchema = z
  .object({
    toPageId: pageIdSchema,
  })
  .strict();

export const backtrackSchema = z.object({}).strict();

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type ListGamesQuery = z.infer<typeof listGamesQuerySchema>;
export type GameParams = z.infer<typeof gameParamsSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type BacktrackInput = z.infer<typeof backtrackSchema>;
