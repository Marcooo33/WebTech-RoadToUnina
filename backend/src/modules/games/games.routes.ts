import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { createGamesController } from "./games.controller.js";
import { GamesService } from "./games.service.js";
import {
  createGameSchema,
  deleteGameQuerySchema,
  gameParamsSchema,
  listGamesQuerySchema,
} from "./games.schema.js";
import type { StartingPageProvider } from "./starting-page.provider.js";

export function createGamesRouter(
  startingPageProvider: StartingPageProvider,
): Router {
  const controller = createGamesController(
    new GamesService(startingPageProvider),
  );
  const router = Router();

  router.use(authenticate);

  router.post(
    "/",
    validate({ body: createGameSchema }),
    controller.createGameHandler,
  );
  router.get(
    "/",
    validate({ query: listGamesQuerySchema }),
    controller.listGamesHandler,
  );
  router.get(
    "/:gameId",
    validate({ params: gameParamsSchema }),
    controller.getGameHandler,
  );
  router.delete(
    "/:gameId",
    validate({ params: gameParamsSchema, query: deleteGameQuerySchema }),
    controller.deleteGameHandler,
  );

  return router;
}
