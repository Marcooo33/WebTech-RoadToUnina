import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import type { WikipediaArticleSource } from "../wikipedia/wikipedia.types.js";
import { createGamesController } from "./games.controller.js";
import { GamesService } from "./games.service.js";
import type { StartingPageProvider } from "./starting-page.provider.js";

export function createGamesRouter(
  startingPageProvider: StartingPageProvider,
  wikipediaService: WikipediaArticleSource,
): Router {
  const controller = createGamesController(
    new GamesService(startingPageProvider, wikipediaService),
  );
  const router = Router();

  router.use(authenticate);

  // Each handler validates its own params/body at the boundary
  // (see games.validation.ts).
  router.post("/", controller.createGameHandler);
  router.get("/", controller.listGamesHandler);
  router.get("/:gameId", controller.getGameHandler);
  router.get("/:gameId/article", controller.getArticleHandler);
  router.post("/:gameId/moves", controller.moveHandler);
  router.post("/:gameId/backtrack", controller.backtrackHandler);
  router.post("/:gameId/heartbeat", controller.heartbeatHandler);
  router.delete("/:gameId", controller.deleteGameHandler);

  return router;
}
