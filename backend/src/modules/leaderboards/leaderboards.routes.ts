import { Router } from "express";
import { createLeaderboardsController } from "./leaderboards.controller.js";

/**
 * Public, unauthenticated. Rankings are derived from COMPLETED games only
 * (docs/api.md §7.2); there is no Leaderboard table. Each handler validates its
 * own query (see leaderboards.validation.ts).
 */
export function createLeaderboardsRouter(): Router {
  const controller = createLeaderboardsController();
  const router = Router();

  router.get("/click", controller.clickLeaderboardHandler);
  router.get("/time", controller.timeLeaderboardHandler);

  return router;
}
