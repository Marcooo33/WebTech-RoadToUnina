import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import {
  createGameHandler,
  deleteGameHandler,
  getGameHandler,
  listGamesHandler,
} from "./games.controller.js";
import {
  createGameSchema,
  deleteGameQuerySchema,
  gameParamsSchema,
  listGamesQuerySchema,
} from "./games.schema.js";

export const gamesRouter = Router();

gamesRouter.use(authenticate);

gamesRouter.post("/", validate({ body: createGameSchema }), createGameHandler);
gamesRouter.get("/", validate({ query: listGamesQuerySchema }), listGamesHandler);
gamesRouter.get(
  "/:gameId",
  validate({ params: gameParamsSchema }),
  getGameHandler,
);
gamesRouter.delete(
  "/:gameId",
  validate({ params: gameParamsSchema, query: deleteGameQuerySchema }),
  deleteGameHandler,
);
