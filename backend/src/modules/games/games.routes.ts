import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validation.middleware.js";
import { createGameSessionsRouter } from "../game-sessions/game-sessions.routes.js";
import { GameSessionService } from "../game-sessions/game-sessions.service.js";
import type { WikipediaArticleSource } from "../wikipedia/wikipedia.types.js";
import { createGamesController } from "./games.controller.js";
import { GamesService } from "./games.service.js";
import {
  backtrackSchema,
  createGameSchema,
  deleteGameQuerySchema,
  gameParamsSchema,
  listGamesQuerySchema,
  moveSchema,
} from "./games.schema.js";
import type { StartingPageProvider } from "./starting-page.provider.js";

export function createGamesRouter(
  startingPageProvider: StartingPageProvider,
  wikipediaService: WikipediaArticleSource,
): Router {
  const sessionService = new GameSessionService();
  const controller = createGamesController(
    new GamesService(startingPageProvider, wikipediaService, sessionService),
    sessionService,
  );
  const router = Router();

  router.use(authenticate);

  router.use("/:gameId/session", createGameSessionsRouter(sessionService));

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
  router.get(
    "/:gameId/article",
    validate({ params: gameParamsSchema }),
    controller.getArticleHandler,
  );
  router.post(
    "/:gameId/moves",
    validate({ params: gameParamsSchema, body: moveSchema }),
    controller.moveHandler,
  );
  router.post(
    "/:gameId/backtrack",
    validate({ params: gameParamsSchema, body: backtrackSchema }),
    controller.backtrackHandler,
  );
  router.delete(
    "/:gameId",
    validate({ params: gameParamsSchema, query: deleteGameQuerySchema }),
    controller.deleteGameHandler,
  );

  return router;
}
