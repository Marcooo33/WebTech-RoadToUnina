import { Router } from "express";
import { validate } from "../../middleware/validation.middleware.js";
import { createLeaderboardsController } from "./leaderboards.controller.js";
import { leaderboardQuerySchema } from "./leaderboards.schema.js";

/**
 * Public, unauthenticated. Rankings are derived from COMPLETED games only
 * (docs/api.md §7.2); there is no Leaderboard table.
 */
export function createLeaderboardsRouter(): Router {
  const controller = createLeaderboardsController();
  const router = Router();

  router.get(
    "/click",
    validate({ query: leaderboardQuerySchema }),
    controller.clickLeaderboardHandler,
  );
  router.get(
    "/time",
    validate({ query: leaderboardQuerySchema }),
    controller.timeLeaderboardHandler,
  );

  return router;
}
