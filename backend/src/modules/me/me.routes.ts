import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createMeController } from "./me.controller.js";

/**
 * Authenticated. Personal statistics for the current user (docs/api.md §8.2);
 * ownership is the authenticated identity, never a client-supplied id.
 */
export function createMeRouter(): Router {
  const controller = createMeController();
  const router = Router();

  router.use(authenticate);
  router.get("/stats", controller.getStatsHandler);

  return router;
}
