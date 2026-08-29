import { Router } from "express";
import { validate } from "../../middleware/validation.middleware.js";
import { gameParamsSchema } from "../games/games.schema.js";
import { createGameSessionsController } from "./game-sessions.controller.js";
import type { GameSessionService } from "./game-sessions.service.js";

/**
 * Nested under `/api/games/:gameId/session`. `mergeParams` exposes `:gameId`;
 * authentication is already applied by the parent games router.
 */
export function createGameSessionsRouter(service: GameSessionService): Router {
  const controller = createGameSessionsController(service);
  const router = Router({ mergeParams: true });

  router.post(
    "/",
    validate({ params: gameParamsSchema }),
    controller.startOrResumeHandler,
  );
  router.post(
    "/heartbeat",
    validate({ params: gameParamsSchema }),
    controller.heartbeatHandler,
  );
  router.post(
    "/end",
    validate({ params: gameParamsSchema }),
    controller.endHandler,
  );

  return router;
}
